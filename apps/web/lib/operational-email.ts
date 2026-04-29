import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import {
  getOfficeEmailDeliverySettingsSnapshot,
  resolveOrganizationSignatureSmtpConfig,
  type AgentPayoutStatementEmailContext,
  type OfficeTransactionDetail
} from "@acre/db";
import { Resend } from "resend";

const defaultFinanceNotificationEmail = "pay@acreny.us";

type OperationalEmailAction = {
  label: string;
  url: string;
};

type OperationalEmailInput = {
  organizationId: string;
  to: Array<string | null | undefined>;
  subject: string;
  heading: string;
  bodyLines: Array<string | null | undefined>;
  action?: OperationalEmailAction | null;
};

type OperationalSenderProfile = {
  fromEmail: string;
  fromName: string;
  defaultReplyTo: string | null;
};

type OperationalSmtpConfig = OperationalSenderProfile & {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

type OperationalResendEmailInput = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type OperationalSmtpEmailInput = {
  config: OperationalSmtpConfig;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendOperationalEmailDependencies = {
  env?: NodeJS.ProcessEnv;
  getOfficeEmailDeliverySettingsSnapshot?: typeof getOfficeEmailDeliverySettingsSnapshot;
  resolveOrganizationSignatureSmtpConfig?: typeof resolveOrganizationSignatureSmtpConfig;
  sendResendEmail?: (input: OperationalResendEmailInput) => Promise<void>;
  sendSmtpEmail?: (input: OperationalSmtpEmailInput) => Promise<void>;
};

type OperationalEmailDependencies = {
  email?: SendOperationalEmailDependencies;
};

type TransactionEmailInput = {
  organizationId: string;
  baseUrl: string;
  financeEmail?: string | null;
  transaction: Pick<
    OfficeTransactionDetail,
    "id" | "title" | "address" | "city" | "state" | "status" | "ownerName" | "ownerEmail" | "officeName"
  >;
  actorName: string;
  actorEmail: string;
};

type PayoutStatementEmailInput = {
  organizationId: string;
  baseUrl: string;
  financeEmail?: string | null;
  statement: AgentPayoutStatementEmailContext;
};

type PayoutStatementReviewEmailInput = PayoutStatementEmailInput & {
  response: "confirm" | "request_revision";
  message?: string | null;
};

function formatFromAddress(fromName: string, fromEmail: string) {
  const safeName = fromName.replace(/"/g, "'");
  return `"${safeName}" <${fromEmail}>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatOptionalValue(value: string | null | undefined) {
  return value?.trim() || "-";
}

function formatPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || input.email?.trim() || "Acre user";
}

function buildLineList(lines: Array<string | null | undefined>) {
  return lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line));
}

export function resolveFinanceNotificationEmail(env: NodeJS.ProcessEnv = process.env) {
  return env.ACRE_FINANCE_NOTIFICATION_EMAIL?.trim() || defaultFinanceNotificationEmail;
}

export function normalizeOperationalEmailRecipients(recipients: Array<string | null | undefined>) {
  const normalized = new Map<string, string>();

  for (const recipient of recipients) {
    const value = recipient?.trim();

    if (!value) {
      continue;
    }

    const key = value.toLowerCase();

    if (!normalized.has(key)) {
      normalized.set(key, value);
    }
  }

  return Array.from(normalized.values());
}

export function buildAbsoluteAppUrl(baseUrl: string, href: string) {
  const trimmedHref = href.trim();

  if (!trimmedHref) {
    return baseUrl.replace(/\/+$/, "");
  }

  try {
    return new URL(trimmedHref).toString();
  } catch {
    return new URL(trimmedHref, `${baseUrl.replace(/\/+$/, "")}/`).toString();
  }
}

function buildOperationalEmailHtml(input: {
  heading: string;
  bodyLines: string[];
  action?: OperationalEmailAction | null;
}) {
  const safeHeading = escapeHtml(input.heading);
  const paragraphs = input.bodyLines
    .map((line) => `<p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(line)}</p>`)
    .join("");
  const action = input.action
    ? `<p style="margin:6px 0 0;"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(input.action.label)}</a></p>`
    : "";

  return `
    <div style="background:#f6f8fb;padding:28px 16px;font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe3f0;border-radius:14px;overflow:hidden;">
        <div style="padding:22px 26px;border-bottom:1px solid #e5edf7;background:#f8fafc;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Acre Back Office</p>
          <h1 style="margin:0;font-size:23px;line-height:1.25;color:#0f172a;">${safeHeading}</h1>
        </div>
        <div style="padding:24px 26px;display:grid;gap:14px;">
          ${paragraphs}
          ${action}
        </div>
      </div>
    </div>
  `;
}

function buildOperationalEmailText(input: {
  heading: string;
  bodyLines: string[];
  action?: OperationalEmailAction | null;
}) {
  return [
    input.heading,
    "",
    ...input.bodyLines,
    ...(input.action ? ["", `${input.action.label}: ${input.action.url}`] : [])
  ].join("\n");
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
    // Keep the configured host when IPv4 lookup is unavailable.
  }

  return host;
}

async function sendResendEmail(input: OperationalResendEmailInput) {
  const client = new Resend(input.apiKey);
  const { error } = await client.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo
  });

  if (error) {
    throw new Error(error.message || "Operational email reminder could not be sent.");
  }
}

async function sendSmtpEmail(input: OperationalSmtpEmailInput) {
  const resolvedHost = await resolvePreferredSmtpHost(input.config.host);
  const transport = nodemailer.createTransport({
    host: resolvedHost,
    port: input.config.port,
    secure: input.config.secure,
    auth: {
      user: input.config.user,
      pass: input.config.password
    },
    tls: isIP(resolvedHost)
      ? {
          servername: input.config.host
        }
      : undefined
  });

  await transport.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo
  });
}

async function resolveResendSenderProfile(
  organizationId: string,
  dependencies: SendOperationalEmailDependencies
): Promise<OperationalSenderProfile> {
  const snapshot = await (
    dependencies.getOfficeEmailDeliverySettingsSnapshot ?? getOfficeEmailDeliverySettingsSnapshot
  )({
    organizationId
  });

  if (snapshot.settings.source === "database" && !snapshot.settings.isEnabled) {
    throw new Error("Operational email delivery is disabled in Settings > Email delivery.");
  }

  const fromEmail = snapshot.settings.fromEmail.trim();

  if (!fromEmail) {
    throw new Error("Operational email delivery is not configured. Add sender defaults in Settings > Email delivery.");
  }

  return {
    fromEmail,
    fromName: snapshot.settings.fromName.trim() || "Acre Back Office",
    defaultReplyTo: snapshot.settings.replyTo.trim() || null
  };
}

async function resolveSmtpConfig(
  organizationId: string,
  dependencies: SendOperationalEmailDependencies
): Promise<OperationalSmtpConfig> {
  const resolved = await (
    dependencies.resolveOrganizationSignatureSmtpConfig ?? resolveOrganizationSignatureSmtpConfig
  )({
    organizationId
  });

  return {
    host: resolved.config.host,
    port: resolved.config.port,
    secure: resolved.config.secure,
    user: resolved.config.user,
    password: resolved.config.password,
    fromEmail: resolved.config.fromEmail,
    fromName: resolved.config.fromName || "Acre Back Office",
    defaultReplyTo: resolved.config.defaultReplyTo
  };
}

export async function sendOperationalEmail(
  input: OperationalEmailInput,
  dependencies: SendOperationalEmailDependencies = {}
) {
  const recipients = normalizeOperationalEmailRecipients(input.to);

  if (recipients.length === 0) {
    return { deliveredCount: 0 };
  }

  const bodyLines = buildLineList(input.bodyLines);
  const html = buildOperationalEmailHtml({
    heading: input.heading,
    bodyLines,
    action: input.action
  });
  const text = buildOperationalEmailText({
    heading: input.heading,
    bodyLines,
    action: input.action
  });
  const env = dependencies.env ?? process.env;
  const resendApiKey = env.ACRE_RESEND_API_KEY?.trim();

  if (resendApiKey) {
    const profile = await resolveResendSenderProfile(input.organizationId, dependencies);
    await (dependencies.sendResendEmail ?? sendResendEmail)({
      apiKey: resendApiKey,
      from: formatFromAddress(profile.fromName, profile.fromEmail),
      to: recipients,
      subject: input.subject,
      html,
      text,
      replyTo: profile.defaultReplyTo || undefined
    });

    return { deliveredCount: recipients.length };
  }

  const config = await resolveSmtpConfig(input.organizationId, dependencies);
  await (dependencies.sendSmtpEmail ?? sendSmtpEmail)({
    config,
    from: formatFromAddress(config.fromName, config.fromEmail),
    to: recipients,
    subject: input.subject,
    html,
    text,
    replyTo: config.defaultReplyTo || undefined
  });

  return { deliveredCount: recipients.length };
}

export async function captureOperationalEmailWarning(label: string, send: () => Promise<unknown>) {
  try {
    await send();
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    const warning = `Operational email reminder failed for ${label}: ${detail}`;
    console.warn(warning);
    return warning;
  }
}

export function appendOperationalEmailWarning<T extends Record<string, unknown>>(
  payload: T,
  emailWarning: string | null
) {
  return emailWarning ? { ...payload, emailWarning } : payload;
}

export function buildOperationalEmailActorName(context: {
  currentUser?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}) {
  return formatPersonName(context.currentUser ?? {});
}

function buildTransactionLabel(transaction: Pick<OfficeTransactionDetail, "title" | "address" | "city" | "state">) {
  return transaction.title?.trim() || [transaction.address, transaction.city, transaction.state].filter(Boolean).join(", ");
}

function buildTransactionAction(baseUrl: string, transactionId: string): OperationalEmailAction {
  return {
    label: "Open transaction",
    url: buildAbsoluteAppUrl(baseUrl, `/office/transactions/${transactionId}`)
  };
}

export async function sendAgentTransactionCreatedOperationalEmail(
  input: TransactionEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);
  const transactionLabel = buildTransactionLabel(input.transaction);
  const action = buildTransactionAction(input.baseUrl, input.transaction.id);

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail],
      subject: `New agent transaction created: ${transactionLabel}`,
      heading: "Agent created a transaction",
      bodyLines: [
        `${input.actorName} created a new transaction in Acre.`,
        `Transaction: ${transactionLabel}`,
        `Status: ${input.transaction.status}`,
        `Owner: ${formatOptionalValue(input.transaction.ownerName)}`,
        `Office: ${formatOptionalValue(input.transaction.officeName)}`
      ],
      action
    },
    dependencies.email
  );

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [input.actorEmail],
      subject: `Transaction created in Acre: ${transactionLabel}`,
      heading: "Your transaction was created",
      bodyLines: [
        `Acre recorded your new transaction.`,
        `Transaction: ${transactionLabel}`,
        `Status: ${input.transaction.status}`,
        `Finance also received a reminder at ${financeEmail}.`
      ],
      action
    },
    dependencies.email
  );
}

export async function sendTransactionClosedOperationalEmail(
  input: TransactionEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);
  const transactionLabel = buildTransactionLabel(input.transaction);

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail, input.transaction.ownerEmail],
      subject: `Transaction closed: ${transactionLabel}`,
      heading: "Transaction marked Closed",
      bodyLines: [
        `${input.actorName} marked this transaction Closed in Acre.`,
        `Transaction: ${transactionLabel}`,
        `Owner: ${formatOptionalValue(input.transaction.ownerName)}`,
        `Office: ${formatOptionalValue(input.transaction.officeName)}`,
        "This is a workflow reminder only."
      ],
      action: buildTransactionAction(input.baseUrl, input.transaction.id)
    },
    dependencies.email
  );
}

function getPayoutInvoiceLine(statement: AgentPayoutStatementEmailContext) {
  return statement.invoiceNumbers.length > 0 ? `Invoices: ${statement.invoiceNumbers.join(", ")}` : "Invoices: -";
}

function buildPayoutWorkspaceAction(baseUrl: string, statement: AgentPayoutStatementEmailContext): OperationalEmailAction {
  return {
    label: "Open payout statement",
    url: buildAbsoluteAppUrl(baseUrl, statement.workspaceHref)
  };
}

function buildPayoutSelfServiceAction(baseUrl: string, statement: AgentPayoutStatementEmailContext): OperationalEmailAction {
  return {
    label: "Review payout statement",
    url: buildAbsoluteAppUrl(baseUrl, statement.selfServiceHref)
  };
}

export async function sendPayoutStatementGeneratedOperationalEmail(
  input: PayoutStatementEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail],
      subject: `Payout statement generated: ${input.statement.agentLabel}`,
      heading: "Payout statement generated",
      bodyLines: [
        `Agent: ${input.statement.agentLabel}`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `Period: ${input.statement.periodLabel}`,
        getPayoutInvoiceLine(input.statement),
        "This draft was generated in Acre and has not been sent to the agent yet."
      ],
      action: buildPayoutWorkspaceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );
}

export async function sendPayoutStatementSentOperationalEmail(
  input: PayoutStatementEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [input.statement.agentEmail],
      subject: `Review your Acre payout statement: ${input.statement.totalStatementAmountLabel}`,
      heading: "Your payout statement is ready",
      bodyLines: [
        `Finance sent your payout statement for review.`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `Period: ${input.statement.periodLabel}`,
        getPayoutInvoiceLine(input.statement),
        "Open Acre to confirm it or request changes."
      ],
      action: buildPayoutSelfServiceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail],
      subject: `Payout statement sent to agent: ${input.statement.agentLabel}`,
      heading: "Payout statement sent to agent",
      bodyLines: [
        `Agent: ${input.statement.agentLabel}`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `Review status: ${input.statement.reviewStatusLabel}`,
        getPayoutInvoiceLine(input.statement)
      ],
      action: buildPayoutWorkspaceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );
}

export async function sendPayoutStatementReviewOperationalEmail(
  input: PayoutStatementReviewEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);
  const requestedRevision = input.response === "request_revision";
  const financeHeading = requestedRevision ? "Agent requested payout statement changes" : "Agent confirmed payout statement";
  const agentHeading = requestedRevision ? "Your change request was submitted" : "Your payout statement was confirmed";
  const messageLine = input.message?.trim() ? `Agent message: ${input.message.trim()}` : null;

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail],
      subject: requestedRevision
        ? `Payout statement changes requested: ${input.statement.agentLabel}`
        : `Payout statement confirmed: ${input.statement.agentLabel}`,
      heading: financeHeading,
      bodyLines: [
        `Agent: ${input.statement.agentLabel}`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `Review status: ${input.statement.reviewStatusLabel}`,
        getPayoutInvoiceLine(input.statement),
        messageLine
      ],
      action: buildPayoutWorkspaceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [input.statement.agentEmail],
      subject: requestedRevision ? "Acre received your payout statement change request" : "Acre recorded your payout statement confirmation",
      heading: agentHeading,
      bodyLines: [
        `Acre recorded your response for this payout statement.`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `Review status: ${input.statement.reviewStatusLabel}`,
        messageLine
      ],
      action: buildPayoutSelfServiceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );
}

export async function sendPayoutStatementQuickBooksPostedOperationalEmail(
  input: PayoutStatementEmailInput,
  dependencies: OperationalEmailDependencies = {}
) {
  const financeEmail = input.financeEmail?.trim() || resolveFinanceNotificationEmail(dependencies.email?.env);

  await sendOperationalEmail(
    {
      organizationId: input.organizationId,
      to: [financeEmail],
      subject: `QuickBooks unpaid bill posted: ${input.statement.agentLabel}`,
      heading: "Payout statement posted to QuickBooks",
      bodyLines: [
        `Agent: ${input.statement.agentLabel}`,
        `Total payout: ${input.statement.totalStatementAmountLabel}`,
        `QuickBooks bill: ${formatOptionalValue(input.statement.quickBooksBillDocNumber || input.statement.quickBooksBillId)}`,
        getPayoutInvoiceLine(input.statement),
        "This created an unpaid QuickBooks bill only. It does not mean the agent has been paid."
      ],
      action: buildPayoutWorkspaceAction(input.baseUrl, input.statement)
    },
    dependencies.email
  );
}
