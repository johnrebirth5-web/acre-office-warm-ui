import { can } from "@acre/auth";
import {
  createFrontOfficeListingShareLink,
  normalizeFrontOfficeAiFollowUpKind,
  normalizeFrontOfficeAiSourceSurface,
} from "@acre/db";
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

  let body:
    | {
        channel?: string;
        clientId?: string;
        appointmentId?: string;
        aiAcceptedAction?: Record<string, unknown>;
      }
    | null = null;

  try {
    body = (await request.json()) as {
      channel?: string;
      clientId?: string;
      appointmentId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channel = body?.channel?.trim().toLowerCase() || "direct";
  const clientId = body?.clientId?.trim() || null;
  const appointmentId = body?.appointmentId?.trim() || null;
  const acceptedAiActionValue =
    body?.aiAcceptedAction && typeof body.aiAcceptedAction === "object"
      ? body.aiAcceptedAction
      : null;
  const acceptedAiAction =
    acceptedAiActionValue &&
    typeof acceptedAiActionValue.suggestionLabel === "string" &&
    acceptedAiActionValue.suggestionLabel.trim()
      ? {
          sourceSurface: normalizeFrontOfficeAiSourceSurface(
            typeof acceptedAiActionValue.sourceSurface === "string"
              ? acceptedAiActionValue.sourceSurface
              : null,
          ),
          suggestionKind: normalizeFrontOfficeAiFollowUpKind(
            typeof acceptedAiActionValue.suggestionKind === "string"
              ? acceptedAiActionValue.suggestionKind
              : null,
          ),
          suggestionLabel: acceptedAiActionValue.suggestionLabel.trim(),
          actionTitle:
            typeof acceptedAiActionValue.actionTitle === "string"
              ? acceptedAiActionValue.actionTitle.trim()
              : null,
        }
      : null;

  if (!allowedChannels.has(channel)) {
    return NextResponse.json(
      { error: "Unsupported share channel." },
      { status: 400 },
    );
  }

  if (
    acceptedAiAction &&
    (!acceptedAiAction.sourceSurface || !acceptedAiAction.suggestionKind)
  ) {
    return NextResponse.json(
      { error: "Unsupported AI action context." },
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
      clientId,
      appointmentId,
      acceptedAiAction:
        acceptedAiAction &&
        acceptedAiAction.sourceSurface &&
        acceptedAiAction.suggestionKind
          ? {
              sourceSurface: acceptedAiAction.sourceSurface,
              suggestionKind: acceptedAiAction.suggestionKind,
              suggestionLabel: acceptedAiAction.suggestionLabel,
              actionTitle: acceptedAiAction.actionTitle,
            }
          : null,
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
