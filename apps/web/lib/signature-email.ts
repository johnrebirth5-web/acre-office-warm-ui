import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import { resolveOrganizationSignatureSmtpConfig } from "@acre/db";

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
  to?: string | null;
  documentTitle: string;
  signerName: string;
  signerEmail: string;
  signedFileName: string;
  signedPdfBytes: Uint8Array;
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

const globalForSignatureMail = globalThis as typeof globalThis & {
  __acreSignatureMailer?: {
    key: string;
    transport: ReturnType<typeof nodemailer.createTransport>;
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

async function resolveSignatureMailerContext(organizationId: string) {
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
    config,
    transport: await getSignatureMailer(config)
  };
}

export async function sendSignatureRequestEmail(input: SignatureEmailInput) {
  const { config, transport } = await resolveSignatureMailerContext(input.organizationId);

  await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: buildSignatureEmailHtml(input),
    text: buildSignatureEmailText(input),
    replyTo: input.replyTo?.trim() || config.defaultReplyTo || undefined
  });
}

export async function sendSignatureCompletionEmail(input: SignatureCompletionEmailInput) {
  const { config, transport } = await resolveSignatureMailerContext(input.organizationId);
  const recipient = input.to?.trim() || config.defaultReplyTo || "";

  if (!recipient) {
    return false;
  }

  await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
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
