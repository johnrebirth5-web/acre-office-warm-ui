import nodemailer from "nodemailer";

type SignatureEmailInput = {
  to: string;
  subject: string;
  message: string;
  signingLink: string;
  documentTitle: string;
  expiresAt?: string | null;
  senderDisplayName?: string | null;
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

const globalForSignatureMail = globalThis as typeof globalThis & {
  __acreSignatureMailer?: ReturnType<typeof nodemailer.createTransport>;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function getSignatureSmtpConfig(): SmtpConfig {
  const host = process.env.ACRE_SMTP_HOST?.trim();
  const user = process.env.ACRE_SMTP_USER?.trim();
  const password = process.env.ACRE_SMTP_PASSWORD?.trim();
  const fromEmail = process.env.ACRE_SIGNATURE_FROM_EMAIL?.trim();

  if (!host || !user || !password || !fromEmail) {
    throw new Error(
      "Signature email delivery is not configured. Set ACRE_SMTP_HOST, ACRE_SMTP_USER, ACRE_SMTP_PASSWORD, and ACRE_SIGNATURE_FROM_EMAIL."
    );
  }

  const port = Number(process.env.ACRE_SMTP_PORT?.trim() || "587");

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: parseBooleanEnv(process.env.ACRE_SMTP_SECURE, port === 465),
    user,
    password,
    fromEmail,
    fromName: process.env.ACRE_SIGNATURE_FROM_NAME?.trim() || "Acre Signatures",
    defaultReplyTo: process.env.ACRE_SIGNATURE_REPLY_TO?.trim() || null
  };
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

function getSignatureMailer() {
  if (globalForSignatureMail.__acreSignatureMailer) {
    return globalForSignatureMail.__acreSignatureMailer;
  }

  const config = getSignatureSmtpConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    }
  });

  if (process.env.NODE_ENV !== "production") {
    globalForSignatureMail.__acreSignatureMailer = transport;
  }

  return transport;
}

export async function sendSignatureRequestEmail(input: SignatureEmailInput) {
  const config = getSignatureSmtpConfig();
  const transport = getSignatureMailer();

  await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: buildSignatureEmailHtml(input),
    text: buildSignatureEmailText(input),
    replyTo: input.replyTo?.trim() || config.defaultReplyTo || undefined
  });
}
