import { canAccessListingStudio } from "@acre/auth";
import { getStudioListingImportStatus } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { getListingStudioExtensionContext } from "../../../../../lib/listing-studio";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ importId: string }> },
) {
  const sessionContext = await getRequestSessionContext(request);
  const extensionContext = sessionContext
    ? null
    : await getListingStudioExtensionContext(request);

  if (!sessionContext && !extensionContext) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (
    sessionContext &&
    !canAccessListingStudio(sessionContext.currentMembership)
  ) {
    return NextResponse.json(
      { error: "Listing Studio access required." },
      { status: 403 },
    );
  }

  const { importId } = await props.params;
  const organizationId =
    sessionContext?.currentOrganization.id ?? extensionContext!.organizationId;
  const status = await getStudioListingImportStatus({
    organizationId,
    importId,
  });

  if (!status) {
    return NextResponse.json({ error: "Import not found." }, { status: 404 });
  }

  return NextResponse.json(status);
}
