import { saveOfficeAccountProfile } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { assertSupportedLocale } from "../../../../../lib/i18n/config";

export async function PATCH(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        firstName?: string;
        lastName?: string;
        displayName?: string;
        phone?: string;
        internalExtension?: string;
        avatarUrl?: string;
        bio?: string;
        licenseNumber?: string;
        licenseState?: string;
        timezone?: string;
        locale?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Profile payload is required." }, { status: 400 });
  }

  try {
    const locale = assertSupportedLocale(body.locale ?? "");
    const saved = await saveOfficeAccountProfile({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      displayName: body.displayName ?? "",
      phone: body.phone ?? "",
      internalExtension: body.internalExtension ?? "",
      avatarUrl: body.avatarUrl ?? "",
      bio: body.bio ?? "",
      licenseNumber: body.licenseNumber ?? "",
      licenseState: body.licenseState ?? "",
      timezone: body.timezone ?? "",
      locale
    });

    if (!saved) {
      return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save account profile." },
      { status: 400 }
    );
  }
}
