import { can } from "@acre/auth";
import {
  createFrontOfficeListingShareLink,
  normalizeFrontOfficeAiFollowUpKind,
  normalizeFrontOfficeAiSourceSurface,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

const allowedChannels = new Set(["sms", "email", "direct"]);
const MAX_AI_SUGGESTION_LABEL_LENGTH = 160;
const MAX_AI_ACTION_TITLE_LENGTH = 160;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalStringField(
  value: unknown,
  label: string,
): { value: string | null; error?: string } {
  if (value == null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { value: null, error: `${label} must be a string.` };
  }

  const normalized = value.trim();

  return {
    value: normalized.length ? normalized : null,
  };
}

function parseAiAcceptedAction(value: unknown) {
  if (value == null) {
    return { value: null as null, error: null as string | null };
  }

  if (!isPlainRecord(value)) {
    return {
      value: null as null,
      error: "AI action context must be a JSON object.",
    };
  }

  const suggestionLabelField = readOptionalStringField(
    value.suggestionLabel,
    "AI suggestion label",
  );

  if (suggestionLabelField.error) {
    return { value: null as null, error: suggestionLabelField.error };
  }

  if (!suggestionLabelField.value) {
    return {
      value: null as null,
      error: "AI suggestion label is required.",
    };
  }

  if (suggestionLabelField.value.length > MAX_AI_SUGGESTION_LABEL_LENGTH) {
    return {
      value: null as null,
      error: `AI suggestion label must stay within ${MAX_AI_SUGGESTION_LABEL_LENGTH} characters.`,
    };
  }

  const actionTitleField = readOptionalStringField(
    value.actionTitle,
    "AI action title",
  );

  if (actionTitleField.error) {
    return { value: null as null, error: actionTitleField.error };
  }

  if (
    actionTitleField.value &&
    actionTitleField.value.length > MAX_AI_ACTION_TITLE_LENGTH
  ) {
    return {
      value: null as null,
      error: `AI action title must stay within ${MAX_AI_ACTION_TITLE_LENGTH} characters.`,
    };
  }

  const sourceSurface = normalizeFrontOfficeAiSourceSurface(
    typeof value.sourceSurface === "string" ? value.sourceSurface : null,
  );
  const suggestionKind = normalizeFrontOfficeAiFollowUpKind(
    typeof value.suggestionKind === "string" ? value.suggestionKind : null,
  );

  if (!sourceSurface || !suggestionKind) {
    return {
      value: null as null,
      error: "Unsupported AI action context.",
    };
  }

  return {
    value: {
      sourceSurface,
      suggestionKind,
      suggestionLabel: suggestionLabelField.value,
      actionTitle: actionTitleField.value,
    },
    error: null as string | null,
  };
}

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

  const { listingId: rawListingId } = await props.params;
  const listingId = rawListingId.trim();

  if (!listingId) {
    return NextResponse.json(
      { error: "Listing id is required.", code: "listing_id_required" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> | null = null;

  try {
    const parsed = (await request.json()) as unknown;

    if (!isPlainRecord(parsed)) {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    body = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channelField = readOptionalStringField(body.channel, "Share channel");
  const clientIdField = readOptionalStringField(body.clientId, "Client id");
  const appointmentIdField = readOptionalStringField(
    body.appointmentId,
    "Appointment id",
  );
  const acceptedAiActionField = parseAiAcceptedAction(body.aiAcceptedAction);

  if (channelField.error || clientIdField.error || appointmentIdField.error) {
    return NextResponse.json(
      {
        error:
          channelField.error || clientIdField.error || appointmentIdField.error,
      },
      { status: 400 },
    );
  }

  if (acceptedAiActionField.error) {
    return NextResponse.json(
      { error: acceptedAiActionField.error },
      { status: 400 },
    );
  }

  const channel = channelField.value?.toLowerCase() || "direct";
  const clientId = clientIdField.value;
  const appointmentId = appointmentIdField.value;
  const acceptedAiAction = acceptedAiActionField.value;

  if (!allowedChannels.has(channel)) {
    return NextResponse.json(
      {
        error: "Unsupported share channel.",
        code: "unsupported_share_channel",
      },
      { status: 400 },
    );
  }

  if (
    (clientId || appointmentId || acceptedAiAction) &&
    !can(context.currentMembership, "clients:view")
  ) {
    return NextResponse.json(
      {
        error: "Client access required for tracked send writeback.",
        code: "client_access_required",
      },
      { status: 403 },
    );
  }

  if (appointmentId && !can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json(
      {
        error:
          "Appointment access required for appointment-bound send context.",
        code: "appointment_access_required",
      },
      { status: 403 },
    );
  }

  if (acceptedAiAction && channel === "direct") {
    return NextResponse.json(
      {
        error:
          "AI tracked-send assist is only supported for SMS or email sends.",
        code: "ai_action_requires_message_channel",
      },
      { status: 400 },
    );
  }

  if (acceptedAiAction && !clientId && !appointmentId) {
    return NextResponse.json(
      {
        error: "AI tracked-send assist requires client or appointment context.",
        code: "ai_action_requires_context",
      },
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
      acceptedAiAction,
    });

    return NextResponse.json({
      shareLink,
      execution: shareLink.execution,
      writeback: shareLink.snapshot.writeback,
      publicPage: shareLink.snapshot.publicPage,
    });
  } catch (error) {
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 400;
    const code =
      typeof error === "object" &&
      error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "share_link_create_failed";

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create a tracked share link.",
        code,
      },
      { status },
    );
  }
}
