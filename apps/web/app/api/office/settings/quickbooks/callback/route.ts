import { canManageOfficeSettings } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getRequestSessionContext,
  getSessionCookieSettings,
} from "../../../../../../lib/auth-session";
import {
  getQuickBooksOfficeMapping,
  quickBooksOAuthStateCookieName,
  readQuickBooksOAuthConfig,
} from "../../../../../../lib/quickbooks-setup";

type QuickBooksTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function buildOperatorPage(input: {
  officeLabel: string;
  officeSlug: string;
  quickBooksCompanyName: string;
  realmId: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number | null;
  refreshTokenExpiresInSeconds: number | null;
}) {
  const refreshTokenExpiresLabel =
    input.refreshTokenExpiresInSeconds === null
      ? "Not returned by Intuit"
      : `${Math.round(input.refreshTokenExpiresInSeconds / 86400)} days`;
  const accessTokenExpiresLabel =
    input.accessTokenExpiresInSeconds === null
      ? "Not returned by Intuit"
      : `${Math.round(input.accessTokenExpiresInSeconds / 60)} minutes`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QuickBooks connection captured</title>
    <style>
      body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f7fb; color: #16273c; }
      main { width: min(860px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0; display: grid; gap: 18px; }
      section { border: 1px solid rgba(22, 39, 60, 0.1); border-radius: 18px; background: #fff; box-shadow: 0 18px 48px rgba(22, 39, 60, 0.08); padding: 22px; display: grid; gap: 14px; }
      h1, h2, p { margin: 0; }
      p { color: #516176; line-height: 1.6; }
      dl { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px 14px; margin: 0; }
      dt { color: #6d7785; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
      dd { margin: 0; overflow-wrap: anywhere; }
      code, textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      textarea { width: 100%; min-height: 120px; box-sizing: border-box; border: 1px solid rgba(22, 39, 60, 0.14); border-radius: 12px; padding: 12px; color: #16273c; }
      a { color: #145a8d; font-weight: 700; }
      .warning { border-color: rgba(172, 114, 23, 0.24); background: #fff9ed; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>QuickBooks connection captured</h1>
        <p>Acre received the QuickBooks authorization response for this company. Keep the refresh token private and place it only in the server environment configuration.</p>
        <dl>
          <dt>Acre office</dt>
          <dd>${escapeHtml(input.officeLabel)} (<code>${escapeHtml(input.officeSlug)}</code>)</dd>
          <dt>Expected company</dt>
          <dd>${escapeHtml(input.quickBooksCompanyName)}</dd>
          <dt>Realm ID</dt>
          <dd><code>${escapeHtml(input.realmId)}</code></dd>
          <dt>Access token</dt>
          <dd>${escapeHtml(accessTokenExpiresLabel)}</dd>
          <dt>Refresh token</dt>
          <dd>${escapeHtml(refreshTokenExpiresLabel)}</dd>
        </dl>
      </section>

      <section class="warning">
        <h2>Server env entry</h2>
        <p>Use the values below in <code>ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON</code>. Fill the QuickBooks AP and expense account IDs before enabling posting.</p>
        <textarea readonly>{
  "${escapeHtml(input.officeSlug)}": {
    "companyName": "${escapeHtml(input.quickBooksCompanyName)}",
    "realmId": "${escapeHtml(input.realmId)}",
    "refreshToken": "${escapeHtml(input.refreshToken)}",
    "apAccountId": "<quickbooks-accounts-payable-account-id>",
    "agentCommissionExpenseAccountId": "<quickbooks-agent-commission-expense-account-id>"
  }
}</textarea>
      </section>

      <section>
        <p><a href="/office/settings/quickbooks">Return to Acre QuickBooks settings</a></p>
      </section>
    </main>
  </body>
</html>`;
}

function buildErrorPage(message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QuickBooks connection error</title>
    <style>
      body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8f1f1; color: #16273c; }
      main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0; }
      section { border: 1px solid rgba(192, 95, 95, 0.24); border-radius: 18px; background: #fff; box-shadow: 0 18px 48px rgba(22, 39, 60, 0.08); padding: 22px; display: grid; gap: 12px; }
      h1, p { margin: 0; }
      p { color: #516176; line-height: 1.6; }
      a { color: #145a8d; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>QuickBooks connection error</h1>
        <p>${escapeHtml(message)}</p>
        <p><a href="/office/settings/quickbooks">Return to Acre QuickBooks settings</a></p>
      </section>
    </main>
  </body>
</html>`;
}

function parseOfficeSlugFromState(state: string) {
  const [officeSlug] = state.split(".");
  return getQuickBooksOfficeMapping(officeSlug)?.officeSlug ?? "";
}

async function exchangeQuickBooksCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${input.clientId}:${input.clientSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as
    | QuickBooksTokenResponse
    | null;

  if (!response.ok || !body?.refresh_token) {
    throw new Error(
      body?.error_description ||
        body?.error ||
        "QuickBooks did not return a refresh token.",
    );
  }

  return body;
}

export async function GET(request: NextRequest) {
  const responseError = request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  if (responseError) {
    return buildHtmlResponse(buildErrorPage(responseError), 400);
  }

  const context = await getRequestSessionContext(request);

  if (!context) {
    return buildHtmlResponse(
      buildErrorPage("Sign in to Acre again, then reconnect QuickBooks."),
      401,
    );
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return buildHtmlResponse(
      buildErrorPage("Settings management permission is required."),
      403,
    );
  }

  const expectedState = request.cookies.get(quickBooksOAuthStateCookieName)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const realmId = request.nextUrl.searchParams.get("realmId") ?? "";
  const officeSlug = parseOfficeSlugFromState(state);
  const officeMapping = getQuickBooksOfficeMapping(officeSlug);

  if (!state || !expectedState || state !== expectedState || !officeMapping) {
    return buildHtmlResponse(
      buildErrorPage("The QuickBooks authorization state did not match this Acre session."),
      400,
    );
  }

  if (!code || !realmId) {
    return buildHtmlResponse(
      buildErrorPage("QuickBooks did not return an authorization code and realm ID."),
      400,
    );
  }

  const oauthConfig = readQuickBooksOAuthConfig(request);

  if (!oauthConfig.isConfigured) {
    return buildHtmlResponse(
      buildErrorPage("QuickBooks OAuth credentials are not configured on this server."),
      400,
    );
  }

  try {
    const tokenBody = await exchangeQuickBooksCode({
      code,
      clientId: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      redirectUri: oauthConfig.redirectUri,
    });
    const response = buildHtmlResponse(
      buildOperatorPage({
        officeLabel: officeMapping.officeLabel,
        officeSlug: officeMapping.officeSlug,
        quickBooksCompanyName: officeMapping.quickBooksCompanyName,
        realmId,
        refreshToken: tokenBody.refresh_token ?? "",
        accessTokenExpiresInSeconds: Number.isFinite(tokenBody.expires_in)
          ? Number(tokenBody.expires_in)
          : null,
        refreshTokenExpiresInSeconds: Number.isFinite(
          tokenBody.x_refresh_token_expires_in,
        )
          ? Number(tokenBody.x_refresh_token_expires_in)
          : null,
      }),
    );

    response.cookies.set(quickBooksOAuthStateCookieName, "", {
      ...getSessionCookieSettings(),
      maxAge: 0,
      path: "/api/office/settings/quickbooks",
    });

    return response;
  } catch (error) {
    return buildHtmlResponse(
      buildErrorPage(
        error instanceof Error
          ? error.message
          : "Failed to exchange the QuickBooks authorization code.",
      ),
      502,
    );
  }
}
