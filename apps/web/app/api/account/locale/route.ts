import { saveCurrentUserLocale } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";
import {
  assertSupportedLocale,
  getLocaleCookieOptions,
  localeCookieName,
} from "../../../../lib/i18n/config";

export async function PATCH(request: NextRequest) {
  const context = await getRequestSessionContext(request, {
    allowPasswordChangeRequired: true,
  });

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        locale?: string;
      }
    | null;

  try {
    const locale = assertSupportedLocale(body?.locale);
    const saved = await saveCurrentUserLocale({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      locale,
    });

    if (!saved) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, locale });
    response.cookies.set(localeCookieName, locale, getLocaleCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update locale.",
      },
      { status: 400 },
    );
  }
}
