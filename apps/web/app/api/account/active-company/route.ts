import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValueWithOfficeSelection,
  getSessionCookieName,
  getSessionCookieSettings,
  getRequestSessionContext,
} from "../../../../lib/auth-session";

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
        officeId?: string | null;
      }
    | null;
  const requestedOfficeId =
    typeof body?.officeId === "string" && body.officeId.trim()
      ? body.officeId.trim()
      : null;
  const nextOffice = requestedOfficeId
    ? context.accessibleOffices.find((office) => office.id === requestedOfficeId) ?? null
    : context.currentOffice;

  if (!nextOffice) {
    return NextResponse.json(
      { error: "Selected company was not found in this account scope." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    officeId: nextOffice.id,
    officeName: nextOffice.name,
  });
  response.cookies.set(
    getSessionCookieName(),
    createSessionCookieValueWithOfficeSelection(
      context.currentMembership.id,
      nextOffice.id,
    ),
    getSessionCookieSettings(),
  );
  return response;
}
