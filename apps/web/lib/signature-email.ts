import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { getOfficeEmailDeliverySettingsSnapshot, resolveOrganizationSignatureSmtpConfig } from "@acre/db";
import { Resend } from "resend";

type SignatureEmailInput = {
  organizationId: string;
  to: string;
  subject: string;
  message: string;
  signingLink: string;
  documentTitle: string;
  expiresAt?: string | null;
  senderDisplayName?: string | null;
  replyTo?: string | null;
};

type SignatureCompletionEmailInput = {
  organizationId: string;
  to: string;
  documentTitle: string;
  signerName: string;
  signerEmail: string;
  signedFileName: string;
  signedPdfBytes: Uint8Array;
};

type SignatureDownloadLinkEmailInput = {
  organizationId: string;
  to: string;
  documentTitle: string;
  recipientName?: string | null;
  downloadLink: string;
  expiresAt?: Date | string | null;
  replyTo?: string | null;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  defaultReplyTo: string | null;
};

type SignatureSenderProfile = {
  fromEmail: string;
  fromName: string;
  defaultReplyTo: string | null;
};

type SignatureMailContext =
  | {
      provider: "smtp";
      config: SmtpConfig;
      transport: ReturnType<typeof nodemailer.createTransport>;
    }
  | {
      provider: "resend";
      profile: SignatureSenderProfile;
      client: Resend;
    };

const globalForSignatureMail = globalThis as typeof globalThis & {
  __acreSignatureMailer?: {
    key: string;
    transport: ReturnType<typeof nodemailer.createTransport>;
  };
  __acreResendClient?: {
    key: string;
    client: Resend;
  };
};

function buildTransportKey(config: SmtpConfig) {
  return JSON.stringify([
    config.host,
    config.port,
    config.secure,
    config.user,
    config.password,
    config.fromEmail,
    config.fromName,
    config.defaultReplyTo
  ]);
}

function formatFromAddress(fromName: string, fromEmail: string) {
  const safeName = fromName.replace(/"/g, "'");
  return `"${safeName}" <${fromEmail}>`;
}

export function resolveSignatureSenderDisplayName(senderDisplayName: string | null | undefined, fallbackDisplayName: string) {
  return senderDisplayName?.trim() || fallbackDisplayName.trim() || "your Acre agent";
}

export function resolveSignatureRequestReplyTo(senderReplyTo: string | null | undefined) {
  return senderReplyTo?.trim() || null;
}

async function resolvePreferredSmtpHost(host: string) {
  if (isIP(host)) {
    return host;
  }

  try {
    const addresses = await resolve4(host);
    if (addresses[0]) {
      return addresses[0];
    }
  } catch (_error) {
    // Fall back to the configured host when IPv4 lookup is unavailable.
  }

  return host;
}

function getResendClient(apiKey: string) {
  if (globalForSignatureMail.__acreResendClient?.key === apiKey) {
    return globalForSignatureMail.__acreResendClient.client;
  }

  const client = new Resend(apiKey);

  globalForSignatureMail.__acreResendClient = {
    key: apiKey,
    client
  };

  return client;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSignatureEmailHtml(input: SignatureEmailInput) {
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br />");
  const safeDocumentTitle = escapeHtml(input.documentTitle);
  const safeSender = escapeHtml(input.senderDisplayName?.trim() || "your Acre agent");
  const expiryLine = input.expiresAt ? `<p style="margin:0;color:#6b7280;">This link expires on ${escapeHtml(input.expiresAt)}.</p>` : "";

  return `
    <div style="background:#f4f6fb;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f0;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;border-bottom:1px solid #e5edf7;background:linear-gradient(135deg,#f8fafc,#eef4ff);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Acre Signature Request</p>
          <h1 style="margin:0;font-size:28px;line-height:1.2;">${safeDocumentTitle}</h1>
        </div>
        <div style="padding:28px 32px;display:grid;gap:16px;">
          <p style="margin:0;font-size:15px;line-height:1.7;">${safeMessage}</p>
          <div style="padding:18px;border-radius:16px;background:#f8fafc;border:1px solid #dbe3f0;">
            <p style="margin:0 0 10px;font-size:13px;color:#475569;">Requested by ${safeSender}</p>
            ${expiryLine}
          </div>
          <div>
            <a href="${escapeHtml(input.signingLink)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;">
              Review and sign document
            </a>
          </div>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#1d4ed8;word-break:break-all;">${escapeHtml(input.signingLink)}</p>
        </div>
      </div>
    </div>
  `;
}

function buildSignatureEmailText(input: SignatureEmailInput) {
  const expiryLine = input.expiresAt ? `\nLink expires on: ${input.expiresAt}` : "";

  return `${input.message}

Document: ${input.documentTitle}
Requested by: ${input.senderDisplayName?.trim() || "your Acre agent"}${expiryLine}

Review and sign:
${input.signingLink}
`;
}

function buildSignatureCompletionEmailHtml(input: SignatureCompletionEmailInput) {
  const safeDocumentTitle = escapeHtml(input.documentTitle);
  const safeSignerName = escapeHtml(input.signerName);
  const safeSignerEmail = escapeHtml(input.signerEmail);

  return `
    <div style="background:#f4f6fb;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f0;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;border-bottom:1px solid #e5edf7;background:linear-gradient(135deg,#f8fafc,#eef4ff);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Acre Signature Completed</p>
          <h1 style="margin:0;font-size:28px;line-height:1.2;">${safeDocumentTitle}</h1>
        </div>
        <div style="padding:28px 32px;display:grid;gap:16px;">
          <p style="margin:0;font-size:15px;line-height:1.7;">${safeSignerName} completed this signature request.</p>
          <div style="padding:18px;border-radius:16px;background:#f8fafc;border:1px solid #dbe3f0;">
            <p style="margin:0 0 10px;font-size:13px;color:#475569;">Signer</p>
            <p style="margin:0;font-size:15px;font-weight:600;">${safeSignerName}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#64748b;">${safeSignerEmail}</p>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">The finalized signed PDF is attached to this email for your records.</p>
        </div>
      </div>
    </div>
  `;
}

function buildSignatureCompletionEmailText(input: SignatureCompletionEmailInput) {
  return `${input.signerName} completed the signature request for ${input.documentTitle}.

Signer email: ${input.signerEmail}

The finalized signed PDF is attached to this email.
`;
}

function formatDownloadExpiry(expiresAt: Date | string | null | undefined) {
  if (!expiresAt) {
    return null;
  }

  return expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
}

function buildSignatureDownloadLinkEmailHtml(input: SignatureDownloadLinkEmailInput) {
  const safeDocumentTitle = escapeHtml(input.documentTitle);
  const safeRecipientName = escapeHtml(input.recipientName?.trim() || "there");
  const safeDownloadLink = escapeHtml(input.downloadLink);
  const expiryLine = formatDownloadExpiry(input.expiresAt);

  return `
    <div style="background:#f4f6fb;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f0;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;border-bottom:1px solid #e5edf7;background:#f8fafc;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Acre Signed Document</p>
          <h1 style="margin:0;font-size:28px;line-height:1.2;">${safeDocumentTitle}</h1>
        </div>
        <div style="padding:28px 32px;display:grid;gap:16px;">
          <p style="margin:0;font-size:15px;line-height:1.7;">Hi ${safeRecipientName}, your signed document is ready. Use the secure link below to download the PDF.</p>
          ${expiryLine ? `<p style="margin:0;color:#6b7280;">This link expires on ${escapeHtml(expiryLine)}.</p>` : ""}
          <div>
            <a href="${safeDownloadLink}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;">
              Download signed PDF
            </a>
          </div>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#1d4ed8;word-break:break-all;">${safeDownloadLink}</p>
        </div>
      </div>
    </div>
  `;
}

function buildSignatureDownloadLinkEmailText(input: SignatureDownloadLinkEmailInput) {
  const expiryLine = formatDownloadExpiry(input.expiresAt);

  return `Your signed document is ready.

Document: ${input.documentTitle}
${expiryLine ? `Link expires on: ${expiryLine}\n` : ""}
Download signed PDF:
${input.downloadLink}
`;
}

async function getSignatureMailer(config: SmtpConfig) {
  const resolvedHost = await resolvePreferredSmtpHost(config.host);
  const transportKey = `${buildTransportKey(config)}:${resolvedHost}`;

  if (globalForSignatureMail.__acreSignatureMailer?.key === transportKey) {
    return globalForSignatureMail.__acreSignatureMailer.transport;
  }

  const transport = nodemailer.createTransport({
    host: resolvedHost,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    },
    tls: isIP(resolvedHost)
      ? {
          servername: config.host
        }
      : undefined
  });

  if (process.env.NODE_ENV !== "production") {
    globalForSignatureMail.__acreSignatureMailer = {
      key: transportKey,
      transport
    };
  }

  return transport;
}

async function resolveSignatureSenderProfile(organizationId: string): Promise<SignatureSenderProfile> {
  const snapshot = await getOfficeEmailDeliverySettingsSnapshot({
    organizationId
  });

  if (snapshot.settings.source === "database" && !snapshot.settings.isEnabled) {
    throw new Error("Signature email delivery is disabled in Settings > Email delivery.");
  }

  const fromEmail = snapshot.settings.fromEmail.trim();

  if (!fromEmail) {
    throw new Error(
      "Signature email delivery is not configured. Ask an administrator to configure Settings > Email delivery."
    );
  }

  return {
    fromEmail,
    fromName: snapshot.settings.fromName.trim() || "Acre Signatures",
    defaultReplyTo: snapshot.settings.replyTo.trim() || null
  };
}

function resolveMailSenderProfile(context: SignatureMailContext): SignatureSenderProfile {
  return context.provider === "resend" ? context.profile : context.config;
}

function resolveMailReplyTo(replyTo: string | null | undefined, defaultReplyTo: string | null) {
  return replyTo?.trim() || defaultReplyTo || undefined;
}

async function resolveSignatureMailerContext(organizationId: string): Promise<SignatureMailContext> {
  const resendApiKey = process.env.ACRE_RESEND_API_KEY?.trim();

  if (resendApiKey) {
    return {
      provider: "resend",
      profile: await resolveSignatureSenderProfile(organizationId),
      client: getResendClient(resendApiKey)
    };
  }

  const resolved = await resolveOrganizationSignatureSmtpConfig({
    organizationId
  });
  const config: SmtpConfig = {
    host: resolved.config.host,
    port: resolved.config.port,
    secure: resolved.config.secure,
    user: resolved.config.user,
    password: resolved.config.password,
    fromEmail: resolved.config.fromEmail,
    fromName: resolved.config.fromName,
    defaultReplyTo: resolved.config.defaultReplyTo
  };

  return {
    provider: "smtp",
    config,
    transport: await getSignatureMailer(config)
  };
}

export async function sendSignatureRequestEmail(input: SignatureEmailInput) {
  const context = await resolveSignatureMailerContext(input.organizationId);
  const senderProfile = resolveMailSenderProfile(context);
  const from = formatFromAddress(senderProfile.fromName, senderProfile.fromEmail);
  const replyTo = resolveMailReplyTo(input.replyTo, senderProfile.defaultReplyTo);

  if (context.provider === "resend") {
    const { error } = await context.client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: buildSignatureEmailHtml(input),
      text: buildSignatureEmailText(input),
      replyTo
    });

    if (error) {
      throw new Error(error.message || "Signature request email could not be sent.");
    }

    return;
  }

  await context.transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: buildSignatureEmailHtml(input),
    text: buildSignatureEmailText(input),
    replyTo
  });
}

export async function sendSignatureCompletionEmail(input: SignatureCompletionEmailInput) {
  const context = await resolveSignatureMailerContext(input.organizationId);
  const recipient = input.to.trim();

  if (!recipient) {
    return false;
  }

  if (context.provider === "resend") {
    const senderProfile = resolveMailSenderProfile(context);
    const { error } = await context.client.emails.send({
      from: formatFromAddress(senderProfile.fromName, senderProfile.fromEmail),
      to: recipient,
      subject: `Signature completed: ${input.documentTitle}`,
      html: buildSignatureCompletionEmailHtml(input),
      text: buildSignatureCompletionEmailText(input),
      attachments: [
        {
          filename: input.signedFileName,
          content: Buffer.from(input.signedPdfBytes)
        }
      ]
    });

    if (error) {
      throw new Error(error.message || "Signature completion email could not be sent.");
    }

    return true;
  }

  const senderProfile = resolveMailSenderProfile(context);
  await context.transport.sendMail({
    from: formatFromAddress(senderProfile.fromName, senderProfile.fromEmail),
    to: recipient,
    subject: `Signature completed: ${input.documentTitle}`,
    html: buildSignatureCompletionEmailHtml(input),
    text: buildSignatureCompletionEmailText(input),
    attachments: [
      {
        filename: input.signedFileName,
        content: Buffer.from(input.signedPdfBytes),
        contentType: "application/pdf"
      }
    ]
  });

  return true;
}

export async function sendSignatureDownloadLinkEmail(input: SignatureDownloadLinkEmailInput) {
  const context = await resolveSignatureMailerContext(input.organizationId);
  const recipient = input.to.trim();

  if (!recipient) {
    return false;
  }

  const senderProfile = resolveMailSenderProfile(context);
  const from = formatFromAddress(senderProfile.fromName, senderProfile.fromEmail);
  const replyTo = resolveMailReplyTo(input.replyTo, senderProfile.defaultReplyTo);

  if (context.provider === "resend") {
    const { error } = await context.client.emails.send({
      from,
      to: recipient,
      subject: `Signed document ready: ${input.documentTitle}`,
      html: buildSignatureDownloadLinkEmailHtml(input),
      text: buildSignatureDownloadLinkEmailText(input),
      replyTo
    });

    if (error) {
      throw new Error(error.message || "Signed document email could not be sent.");
    }

    return true;
  }

  await context.transport.sendMail({
    from,
    to: recipient,
    subject: `Signed document ready: ${input.documentTitle}`,
    html: buildSignatureDownloadLinkEmailHtml(input),
    text: buildSignatureDownloadLinkEmailText(input),
    replyTo
  });

  return true;
}

type SignatureCompletionBatchEmailInput = Omit<SignatureCompletionEmailInput, "to"> & {
  recipients: string[];
};

export async function sendSignatureCompletionEmails(input: SignatureCompletionBatchEmailInput) {
  const recipients = [...new Set(input.recipients.map((recipient) => recipient.trim()).filter(Boolean))];

  if (!recipients.length) {
    return { deliveredCount: 0 };
  }

  const failures: string[] = [];
  let deliveredCount = 0;

  for (const recipient of recipients) {
    try {
      await sendSignatureCompletionEmail({
        ...input,
        to: recipient
      });
      deliveredCount += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown error";
      failures.push(`${recipient}: ${detail}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Signature completion email failed for ${failures.join("; ")}`);
  }

  return { deliveredCount };
}
