import { can } from "@acre/auth";
import { createFrontOfficeListingShareLink } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

const allowedChannels = new Set(["sms", "email", "direct"]);

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ listingId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "listings:view")) {
    return NextResponse.json(
      { error: "Listing access required." },
      { status: 403 },
    );
  }

  const { listingId } = await props.params;

  let body: { channel?: string } | null = null;

  try {
    body = (await request.json()) as { channel?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channel = body?.channel?.trim().toLowerCase() || "direct";

  if (!allowedChannels.has(channel)) {
    return NextResponse.json(
      { error: "Unsupported share channel." },
      { status: 400 },
    );
  }

  try {
    const shareLink = await createFrontOfficeListingShareLink({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
      listingId,
      channel,
    });

    return NextResponse.json({
      shareLink,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create a tracked share link.",
      },
      { status: 400 },
    );
  }
}
