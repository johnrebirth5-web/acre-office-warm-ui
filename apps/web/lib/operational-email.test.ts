import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAbsoluteAppUrl,
  normalizeOperationalEmailRecipients,
  resolveFinanceNotificationEmail,
  sendOperationalEmail
} from "./operational-email";

test("normalizeOperationalEmailRecipients removes blanks and deduplicates case-insensitively", () => {
  assert.deepEqual(
    normalizeOperationalEmailRecipients([
      "pay@acreny.us",
      "",
      " PAY@acreny.us ",
      null,
      "agent@example.com"
    ]),
    ["pay@acreny.us", "agent@example.com"]
  );
});

test("resolveFinanceNotificationEmail defaults to the Acre pay mailbox", () => {
  assert.equal(resolveFinanceNotificationEmail({} as NodeJS.ProcessEnv), "pay@acreny.us");
  assert.equal(
    resolveFinanceNotificationEmail({ ACRE_FINANCE_NOTIFICATION_EMAIL: " finance@example.com " } as unknown as NodeJS.ProcessEnv),
    "finance@example.com"
  );
});

test("buildAbsoluteAppUrl resolves relative Acre links against the request base", () => {
  assert.equal(
    buildAbsoluteAppUrl("https://acresystem.us/", "/office/accounting?statementId=stmt_1"),
    "https://acresystem.us/office/accounting?statementId=stmt_1"
  );
  assert.equal(
    buildAbsoluteAppUrl("https://acresystem.us", "https://example.com/manual"),
    "https://example.com/manual"
  );
});

test("sendOperationalEmail prefers Resend when ACRE_RESEND_API_KEY is configured", async () => {
  let capturedResendInput: Record<string, unknown> | null = null;
  let smtpCalled = false;

  const result = await sendOperationalEmail(
    {
      organizationId: "org_1",
      to: ["pay@acreny.us", "PAY@acreny.us"],
      subject: "Operational reminder",
      heading: "Reminder",
      bodyLines: ["Line one"],
      action: {
        label: "Open Acre",
        url: "https://acresystem.us/office"
      }
    },
    {
      env: { ACRE_RESEND_API_KEY: "resend_key" } as unknown as NodeJS.ProcessEnv,
      getOfficeEmailDeliverySettingsSnapshot: async () =>
        ({
          settings: {
            source: "database",
            isEnabled: true,
            fromEmail: "ops@acresystem.us",
            fromName: "Acre Ops",
            replyTo: "reply@acresystem.us"
          }
        }) as never,
      sendResendEmail: async (input) => {
        capturedResendInput = input as unknown as Record<string, unknown>;
      },
      sendSmtpEmail: async () => {
        smtpCalled = true;
      }
    }
  );

  assert.equal(result.deliveredCount, 1);
  assert.equal(smtpCalled, false);
  assert.deepEqual(capturedResendInput?.["to"], ["pay@acreny.us"]);
  assert.equal(capturedResendInput?.["from"], "\"Acre Ops\" <ops@acresystem.us>");
  assert.equal(capturedResendInput?.["replyTo"], "reply@acresystem.us");
});

test("sendOperationalEmail falls back to SMTP when Resend is not configured", async () => {
  let capturedSmtpInput: Record<string, unknown> | null = null;

  const result = await sendOperationalEmail(
    {
      organizationId: "org_1",
      to: ["agent@example.com"],
      subject: "Operational reminder",
      heading: "Reminder",
      bodyLines: ["Line one"]
    },
    {
      env: {} as unknown as NodeJS.ProcessEnv,
      resolveOrganizationSignatureSmtpConfig: async () =>
        ({
          config: {
            host: "smtp.example.com",
            port: 587,
            secure: false,
            user: "smtp-user",
            password: "smtp-password",
            fromEmail: "ops@acresystem.us",
            fromName: "Acre Ops",
            defaultReplyTo: null
          }
        }) as never,
      sendSmtpEmail: async (input) => {
        capturedSmtpInput = input as unknown as Record<string, unknown>;
      }
    }
  );

  assert.equal(result.deliveredCount, 1);
  assert.deepEqual(capturedSmtpInput?.["to"], ["agent@example.com"]);
  assert.equal(capturedSmtpInput?.["from"], "\"Acre Ops\" <ops@acresystem.us>");
});
