import { canManageOfficeSettings } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../../lib/request-origin";
import {
  getQuickBooksOfficeMapping,
  quickBooksOfficeMappings,
} from "../../../../../../lib/quickbooks-setup";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDisconnectPage(input: {
  officeLabel: string;
  officeSlug: string;
  quickBooksCompanyName: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Disconnect QuickBooks</title>
    <style>
      body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f7fb; color: #16273c; }
      main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0; }
      section { border: 1px solid rgba(22, 39, 60, 0.1); border-radius: 18px; background: #fff; box-shadow: 0 18px 48px rgba(22, 39, 60, 0.08); padding: 22px; display: grid; gap: 12px; }
      h1, p, ul { margin: 0; }
      p, li { color: #516176; line-height: 1.6; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      a { color: #145a8d; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Disconnect QuickBooks</h1>
        <p>Acre currently manages QuickBooks bill-posting tokens through server environment configuration.</p>
        <p>To disconnect ${escapeHtml(input.officeLabel)} from ${escapeHtml(input.quickBooksCompanyName)}:</p>
        <ul>
          <li>Remove or rotate the <code>${escapeHtml(input.officeSlug)}</code> entry in <code>ACRE_QUICKBOOKS_OFFICE_CONNECTIONS_JSON</code>.</li>
          <li>Restart the Acre server after the environment update.</li>
          <li>Remove Acre access from the QuickBooks Online app management screen if you want Intuit-side deauthorization too.</li>
        </ul>
        <p><a href="/office/settings/quickbooks">Return to Acre QuickBooks settings</a></p>
      </section>
    </main>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.redirect(new URL("/login", getRequestOrigin(request)), 303);
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return NextResponse.json(
      { error: "Settings management permission required." },
      { status: 403 },
    );
  }

  const requestedOfficeSlug = request.nextUrl.searchParams.get("office");
  const officeMapping =
    getQuickBooksOfficeMapping(requestedOfficeSlug) ?? quickBooksOfficeMappings[0];

  return new NextResponse(
    buildDisconnectPage({
      officeLabel: officeMapping.officeLabel,
      officeSlug: officeMapping.officeSlug,
      quickBooksCompanyName: officeMapping.quickBooksCompanyName,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}
