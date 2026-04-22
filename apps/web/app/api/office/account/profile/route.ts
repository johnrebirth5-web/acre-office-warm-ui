import { saveOfficeAccountProfile, type SessionMembershipContext } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";
import { assertSupportedLocale } from "../../../../../lib/i18n/config";
import { updateOfficeAccountProfileBodySchema } from "./route.schema";

type OfficeAccountProfileRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveOfficeAccountProfile?: typeof saveOfficeAccountProfile;
};

export async function handleUpdateOfficeAccountProfilePatch(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeAccountProfileRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    updateOfficeAccountProfileBodySchema,
    {
      error: "Profile payload is required.",
      invalidJsonError: "Profile request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const locale = assertSupportedLocale(body.locale ?? "");
    const saved = await (dependencies.saveOfficeAccountProfile ?? saveOfficeAccountProfile)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
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

export async function PATCH(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleUpdateOfficeAccountProfilePatch(request, context);
}
