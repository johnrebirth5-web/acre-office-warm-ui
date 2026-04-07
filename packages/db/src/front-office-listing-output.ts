import { randomBytes } from "node:crypto";
import {
  FrontOfficeSendChannel,
  FrontOfficeSendMaterialType,
  ListingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "./client";
import type { FrontOfficeAiAcceptedActionContext } from "./front-office-ai";
import { recordFrontOfficeAiAcceptedAction } from "./front-office-ai";

const activeListingStatuses: ListingStatus[] = [
  ListingStatus.active,
  ListingStatus.hot,
];

const TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS = 3;
const TRACKED_SEND_QUIET_AFTER_OPEN_DAYS = 7;

type FrontOfficeListingShareBindingMode =
  | "generic_tracked_link"
  | "client_dossier_context"
  | "client_appointment_context";

type FrontOfficeListingShareFollowUpKind =
  | "generic_context"
  | "client_context"
  | "appointment_context";

type FrontOfficeListingShareWritebackMode =
  | "tracked_link_only"
  | "tracked_send_recorded";

type FrontOfficeListingShareResolvedClient = {
  id: string;
  fullName: string;
  stageLabel: string | null;
  bindingSource: "explicit_client" | "appointment_context";
};

type FrontOfficeListingShareResolvedAppointment = {
  id: string;
  title: string;
  startsAt: Date | null;
};

class FrontOfficeListingShareLinkError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "FrontOfficeListingShareLinkError";
    this.code = input.code;
    this.status = input.status;
  }
}

function createFrontOfficeListingShareLinkError(input: {
  code: string;
  message: string;
  status?: number;
}) {
  return new FrontOfficeListingShareLinkError({
    code: input.code,
    message: input.message,
    status: input.status ?? 400,
  });
}

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Price on request";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function buildFactsLabel(input: {
  bedrooms: number | null;
  bathrooms: Prisma.Decimal | null;
}) {
  const parts = [
    input.bedrooms ? `${input.bedrooms} bd` : null,
    input.bathrooms ? `${Number(input.bathrooms)} ba` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "Curated listing details";
}

function buildShareCode() {
  return randomBytes(9).toString("base64url");
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized.length ? normalized : null;
}

function parseFrontOfficeSendChannel(channel: string): FrontOfficeSendChannel {
  switch (normalizeOptionalText(channel)?.toLowerCase()) {
    case "sms":
      return FrontOfficeSendChannel.sms;
    case "email":
      return FrontOfficeSendChannel.email;
    case "direct":
      return FrontOfficeSendChannel.direct;
    default:
      throw createFrontOfficeListingShareLinkError({
        code: "unsupported_share_channel",
        message: "Unsupported share channel.",
      });
  }
}

export function buildFrontOfficeListingSharePath(code: string) {
  return `/share/listings/${code}`;
}

function buildClientStageDisplayLabel(value: string | null | undefined) {
  return normalizeOptionalText(value) ?? "Stage not captured";
}

function buildStageKeywordMatch(
  value: string | null | undefined,
  keywords: string[],
) {
  const normalizedValue = value?.trim().toLowerCase() || "";

  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function buildAppointmentWindowLabel(
  value: Date | null | undefined,
  referenceAt: Date,
) {
  if (!value) {
    return null;
  }

  const minutesUntilStart = Math.round(
    (value.getTime() - referenceAt.getTime()) / (1000 * 60),
  );

  if (minutesUntilStart <= -120) {
    return "after the appointment window";
  }

  if (minutesUntilStart < 0) {
    return "during the appointment window";
  }

  if (minutesUntilStart <= 180) {
    return "ahead of the appointment window";
  }

  return "in the appointment prep window";
}

function resolveFrontOfficeListingShareBindingMode(input: {
  client: FrontOfficeListingShareResolvedClient | null;
  appointment: FrontOfficeListingShareResolvedAppointment | null;
}): FrontOfficeListingShareBindingMode {
  if (input.client && input.appointment) {
    return "client_appointment_context";
  }

  if (input.client) {
    return "client_dossier_context";
  }

  return "generic_tracked_link";
}

function buildShareModeLabel(mode: FrontOfficeListingShareBindingMode) {
  if (mode === "client_appointment_context") {
    return "Client + appointment context";
  }

  if (mode === "client_dossier_context") {
    return "Client dossier context";
  }

  return "Generic tracked link";
}

function buildShareChannelLabel(channel: FrontOfficeSendChannel) {
  switch (channel) {
    case FrontOfficeSendChannel.sms:
      return "SMS";
    case FrontOfficeSendChannel.email:
      return "Email";
    case FrontOfficeSendChannel.direct:
      return "Direct link";
    default:
      return "Tracked send";
  }
}

function buildShareTrackingLabel(input: {
  mode: FrontOfficeListingShareBindingMode;
  clientName: string | null;
  appointmentTitle: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return `Send record saved to ${input.clientName || "the selected client"} and linked to ${input.appointmentTitle || "the selected appointment"}.`;
  }

  if (input.mode === "client_dossier_context") {
    return `Send record saved to ${input.clientName || "the selected client"}'s Front Office trail.`;
  }

  return "Tracked link created without client-linked send attribution.";
}

function buildShareSendCue(input: {
  channel: FrontOfficeSendChannel;
  mode: FrontOfficeListingShareBindingMode;
}) {
  if (input.channel === FrontOfficeSendChannel.sms) {
    if (input.mode === "client_appointment_context") {
      return "Best for a quick reaction or confirmation around the active appointment while the tracked link stays attached to the meeting trail.";
    }

    if (input.mode === "client_dossier_context") {
      return "Best for a quick yes / no reaction while keeping the dossier send trail warm.";
    }

    return "Best for a fast manual text touch when you still want the private tracked link copied with the note.";
  }

  if (input.channel === FrontOfficeSendChannel.email) {
    if (input.mode === "client_appointment_context") {
      return "Best when the client needs more framing before or after the appointment, but you still want the send tied back to the meeting loop.";
    }

    if (input.mode === "client_dossier_context") {
      return "Best when the client needs summary, context, and a clear next-step ask beside the tracked link.";
    }

    return "Best when the listing needs more framing than a raw link before you attach it to a specific client trail.";
  }

  if (input.mode === "client_appointment_context") {
    return "Best for WeChat or another manual chat flow when you only need the private tracked URL and will handle the rest of the note yourself around the appointment.";
  }

  if (input.mode === "client_dossier_context") {
    return "Best for WeChat or ad-hoc chat when you only need the private tracked URL but still want the send recorded in the client trail.";
  }

  return "Best when you only need the private tracked URL and will handle the rest of the context in another manual send tool.";
}

function buildShareManualSendCue(channel: FrontOfficeSendChannel) {
  if (channel === FrontOfficeSendChannel.sms) {
    return "Acre only copied the SMS-ready content and tracked link. You still need to paste and send it manually from your texting app.";
  }

  if (channel === FrontOfficeSendChannel.email) {
    return "Acre only copied the email-ready content and tracked link. You still need to paste and send it manually from your mail client.";
  }

  return "Acre only copied the private tracked link. Add your own context and send it manually from the chat or email tool you choose.";
}

function buildShareFollowUpSnapshot(mode: FrontOfficeListingShareBindingMode) {
  if (mode === "client_appointment_context") {
    return {
      kind: "appointment_context" as const,
      cue: `Use the appointment record for confirmation or reschedule notes, rescue the send from the client trail if it stays unopened after ${TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS} days, and reopen the shortlist if it goes quiet for a week after the first open.`,
      unopenedAfterDays: TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS,
      quietAfterOpenAfterDays: TRACKED_SEND_QUIET_AFTER_OPEN_DAYS,
    };
  }

  if (mode === "client_dossier_context") {
    return {
      kind: "client_context" as const,
      cue: `If the send stays unopened for ${TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS} days, reopen the dossier with a tighter follow-up. If it opens and then goes quiet for a week, send the next option from the same trail.`,
      unopenedAfterDays: TRACKED_SEND_UNOPENED_FOLLOW_UP_DAYS,
      quietAfterOpenAfterDays: TRACKED_SEND_QUIET_AFTER_OPEN_DAYS,
    };
  }

  return {
    kind: "generic_context" as const,
    cue: "This link is still tracked, but it will not enter a client engagement trail until you reopen listing output from a dossier or appointment context.",
    unopenedAfterDays: null,
    quietAfterOpenAfterDays: null,
  };
}

function buildShareMaterialCue(input: {
  mode: FrontOfficeListingShareBindingMode;
  clientStageLabel: string | null;
}) {
  if (input.mode === "client_appointment_context") {
    return "Pair this listing with the intro text and one recent closing so the client sees both meeting context and agent proof.";
  }

  if (
    buildStageKeywordMatch(input.clientStageLabel, [
      "new",
      "lead",
      "prospect",
      "nurture",
      "inquiry",
    ])
  ) {
    return "Lead with the business card or intro email so the listing does not arrive without agent identity.";
  }

  if (
    buildStageKeywordMatch(input.clientStageLabel, [
      "show",
      "tour",
      "search",
      "active",
      "buyer",
      "visit",
    ])
  ) {
    return "Pair the listing with the intro text and a featured case to keep the shortlist moving toward a showing decision.";
  }

  return "Pair the listing with the business card and one proof point so the share carries identity, not just a link.";
}

function buildShareWritebackLabel(input: {
  sendRecordId: string | null;
  aiAcceptedActionRecorded: boolean;
}) {
  if (input.sendRecordId && input.aiAcceptedActionRecorded) {
    return "Tracked link, send record, and AI acceptance trail saved.";
  }

  if (input.sendRecordId) {
    return "Tracked link and send record saved.";
  }

  return "Tracked link saved without client-linked writeback.";
}

export type CreateFrontOfficeListingShareLinkInput = {
  organizationId: string;
  viewerMembershipId: string;
  officeId?: string | null;
  listingId: string;
  channel: string;
  clientId?: string | null;
  appointmentId?: string | null;
  acceptedAiAction?: FrontOfficeAiAcceptedActionContext | null;
};

export type FrontOfficeListingShareLinkResult = {
  id: string;
  listingId: string;
  listingTitle: string;
  channel: FrontOfficeSendChannel;
  sharePath: string;
  sendRecordId: string | null;
  context: {
    mode: FrontOfficeListingShareBindingMode;
    modeLabel: string;
    trackingLabel: string;
    trackingStatus: FrontOfficeListingShareWritebackMode;
    clientId: string | null;
    clientBindingSource:
      | FrontOfficeListingShareResolvedClient["bindingSource"]
      | null;
    clientLabel: string | null;
    clientStageLabel: string | null;
    clientStageDisplayLabel: string | null;
    appointmentId: string | null;
    appointmentLabel: string | null;
    appointmentStartsAt: string | null;
    appointmentWindowLabel: string | null;
    inheritedClientFromAppointment: boolean;
    followUpKind: FrontOfficeListingShareFollowUpKind;
    followUpCue: string;
    followUpUnopenedAfterDays: number | null;
    quietAfterOpenAfterDays: number | null;
    materialCue: string;
    shareLinkId: string;
    shareCode: string;
    channel: FrontOfficeSendChannel;
    channelLabel: string;
    sendCue: string;
    manualSendCue: string;
    sentAt: string;
    writebackLabel: string;
  };
  snapshot: {
    shareLink: {
      id: string;
      code: string;
      sharePath: string;
      channel: FrontOfficeSendChannel;
      createdAt: string;
    };
    binding: {
      mode: FrontOfficeListingShareBindingMode;
      inheritedClientFromAppointment: boolean;
      client: {
        id: string;
        fullName: string;
        stageLabel: string | null;
        bindingSource: FrontOfficeListingShareResolvedClient["bindingSource"];
      } | null;
      appointment: {
        id: string;
        title: string;
        startsAt: string | null;
        windowLabel: string | null;
      } | null;
    };
    trackedSend: {
      id: string | null;
      status: FrontOfficeListingShareWritebackMode;
      sentAt: string;
      channel: FrontOfficeSendChannel;
      channelLabel: string;
      materialType: FrontOfficeSendMaterialType;
      clientStageLabel: string | null;
      appointmentId: string | null;
      appointmentTitle: string | null;
      appointmentStartsAt: string | null;
    };
    followUp: {
      kind: FrontOfficeListingShareFollowUpKind;
      cue: string;
      materialCue: string;
      unopenedAfterDays: number | null;
      quietAfterOpenAfterDays: number | null;
    };
    writeback: {
      shareLinkCreated: true;
      sendRecordCreated: boolean;
      sendRecordId: string | null;
      aiAcceptedActionRecorded: boolean;
      clientBound: boolean;
      appointmentBound: boolean;
      label: string;
    };
  };
};

export type FrontOfficeListingSharePageSnapshot = {
  code: string;
  listingTitle: string;
  areaLabel: string;
  priceLabel: string;
  factsLabel: string;
  summaryLabel: string;
  statusLabel: string;
  sourceUrl: string;
  agentLabel: string;
  agentEmail: string;
  agentPhone: string;
  organizationLabel: string;
};

function buildShareResultSnapshot(input: {
  shareLinkId: string;
  shareCode: string;
  sharePath: string;
  shareLinkCreatedAt: Date;
  channel: FrontOfficeSendChannel;
  client: FrontOfficeListingShareResolvedClient | null;
  appointment: FrontOfficeListingShareResolvedAppointment | null;
  inheritedClientFromAppointment: boolean;
  sentAt: Date;
  sendRecordId: string | null;
  aiAcceptedActionRecorded: boolean;
}) {
  const mode = resolveFrontOfficeListingShareBindingMode({
    client: input.client,
    appointment: input.appointment,
  });
  const clientStageLabel = input.client?.stageLabel ?? null;
  const appointmentTitle = input.appointment?.title ?? null;
  const appointmentStartsAt = input.appointment?.startsAt ?? null;
  const appointmentStartsAtIso = appointmentStartsAt?.toISOString() || null;
  const appointmentWindowLabel = buildAppointmentWindowLabel(
    appointmentStartsAt,
    input.sentAt,
  );
  const sentAtIso = input.sentAt.toISOString();
  const trackingStatus: FrontOfficeListingShareWritebackMode =
    input.sendRecordId ? "tracked_send_recorded" : "tracked_link_only";
  const followUp = buildShareFollowUpSnapshot(mode);
  const materialCue = buildShareMaterialCue({
    mode,
    clientStageLabel,
  });
  const channelLabel = buildShareChannelLabel(input.channel);
  const writebackLabel = buildShareWritebackLabel({
    sendRecordId: input.sendRecordId,
    aiAcceptedActionRecorded: input.aiAcceptedActionRecorded,
  });
  const sendCue = buildShareSendCue({
    channel: input.channel,
    mode,
  });
  const manualSendCue = buildShareManualSendCue(input.channel);

  return {
    context: {
      mode,
      modeLabel: buildShareModeLabel(mode),
      trackingLabel: buildShareTrackingLabel({
        mode,
        clientName: input.client?.fullName ?? null,
        appointmentTitle,
      }),
      trackingStatus,
      clientId: input.client?.id ?? null,
      clientBindingSource: input.client?.bindingSource ?? null,
      clientLabel: input.client?.fullName ?? null,
      clientStageLabel,
      clientStageDisplayLabel: input.client
        ? buildClientStageDisplayLabel(clientStageLabel)
        : null,
      appointmentId: input.appointment?.id ?? null,
      appointmentLabel: appointmentTitle,
      appointmentStartsAt: appointmentStartsAtIso,
      appointmentWindowLabel,
      inheritedClientFromAppointment: input.inheritedClientFromAppointment,
      followUpKind: followUp.kind,
      followUpCue: followUp.cue,
      followUpUnopenedAfterDays: followUp.unopenedAfterDays,
      quietAfterOpenAfterDays: followUp.quietAfterOpenAfterDays,
      materialCue,
      shareLinkId: input.shareLinkId,
      shareCode: input.shareCode,
      channel: input.channel,
      channelLabel,
      sendCue,
      manualSendCue,
      sentAt: sentAtIso,
      writebackLabel,
    },
    snapshot: {
      shareLink: {
        id: input.shareLinkId,
        code: input.shareCode,
        sharePath: input.sharePath,
        channel: input.channel,
        createdAt: input.shareLinkCreatedAt.toISOString(),
      },
      binding: {
        mode,
        inheritedClientFromAppointment: input.inheritedClientFromAppointment,
        client: input.client
          ? {
              id: input.client.id,
              fullName: input.client.fullName,
              stageLabel: clientStageLabel,
              bindingSource: input.client.bindingSource,
            }
          : null,
        appointment: input.appointment
          ? {
              id: input.appointment.id,
              title: appointmentTitle || "Appointment context",
              startsAt: appointmentStartsAtIso,
              windowLabel: appointmentWindowLabel,
            }
          : null,
      },
      trackedSend: {
        id: input.sendRecordId,
        status: trackingStatus,
        sentAt: sentAtIso,
        channel: input.channel,
        channelLabel,
        materialType: FrontOfficeSendMaterialType.listing_share,
        clientStageLabel,
        appointmentId: input.appointment?.id ?? null,
        appointmentTitle,
        appointmentStartsAt: appointmentStartsAtIso,
      },
      followUp: {
        kind: followUp.kind,
        cue: followUp.cue,
        materialCue,
        unopenedAfterDays: followUp.unopenedAfterDays,
        quietAfterOpenAfterDays: followUp.quietAfterOpenAfterDays,
      },
      writeback: {
        shareLinkCreated: true as const,
        sendRecordCreated: Boolean(input.sendRecordId),
        sendRecordId: input.sendRecordId,
        aiAcceptedActionRecorded: input.aiAcceptedActionRecorded,
        clientBound: Boolean(input.client),
        appointmentBound: Boolean(input.appointment),
        label: writebackLabel,
      },
    },
  };
}

export async function createFrontOfficeListingShareLink(
  input: CreateFrontOfficeListingShareLinkInput,
): Promise<FrontOfficeListingShareLinkResult> {
  const listingId = normalizeOptionalText(input.listingId);

  if (!listingId) {
    throw createFrontOfficeListingShareLinkError({
      code: "listing_id_required",
      message: "Listing id is required.",
    });
  }

  const clientId = normalizeOptionalText(input.clientId ?? null);
  const appointmentId = normalizeOptionalText(input.appointmentId ?? null);
  const acceptedAiAction =
    input.acceptedAiAction &&
    normalizeOptionalText(input.acceptedAiAction.suggestionLabel)
      ? {
          sourceSurface: input.acceptedAiAction.sourceSurface,
          suggestionKind: input.acceptedAiAction.suggestionKind,
          suggestionLabel: normalizeOptionalText(
            input.acceptedAiAction.suggestionLabel,
          )!,
          actionTitle: normalizeOptionalText(
            input.acceptedAiAction.actionTitle ?? null,
          ),
        }
      : null;

  if (input.acceptedAiAction && !acceptedAiAction) {
    throw createFrontOfficeListingShareLinkError({
      code: "ai_action_label_required",
      message: "AI tracked-send assist requires a suggestion label.",
    });
  }

  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const normalizedChannel = parseFrontOfficeSendChannel(input.channel);
  const [listing, explicitClient, appointment] = await Promise.all([
    prisma.listing.findFirst({
      where: {
        id: listingId,
        organizationId: input.organizationId,
        status: {
          in: activeListingStatuses,
        },
        ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
      },
      select: {
        id: true,
        title: true,
      },
    }),
    clientId
      ? prisma.client.findFirst({
          where: {
            id: clientId,
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
          },
          select: {
            id: true,
            fullName: true,
            stage: true,
          },
        })
      : Promise.resolve(null),
    appointmentId
      ? prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
            ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
          },
          select: {
            id: true,
            title: true,
            startsAt: true,
            client: {
              select: {
                id: true,
                fullName: true,
                stage: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!listing) {
    throw createFrontOfficeListingShareLinkError({
      code: "listing_not_found",
      message: "Listing not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (clientId && !explicitClient) {
    throw createFrontOfficeListingShareLinkError({
      code: "client_not_found",
      message: "Client not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (appointmentId && !appointment) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_not_found",
      message: "Appointment not found in the current Front Office scope.",
      status: 404,
    });
  }

  if (appointment && !appointment.client?.id) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_requires_client",
      message: "Only client-linked appointments can be used as send context.",
      status: 409,
    });
  }

  if (
    explicitClient &&
    appointment?.client?.id &&
    appointment.client.id !== explicitClient.id
  ) {
    throw createFrontOfficeListingShareLinkError({
      code: "appointment_client_mismatch",
      message: "Appointment context does not match the selected client.",
      status: 409,
    });
  }

  const client: FrontOfficeListingShareResolvedClient | null = explicitClient
    ? {
        id: explicitClient.id,
        fullName: explicitClient.fullName,
        stageLabel: normalizeOptionalText(explicitClient.stage),
        bindingSource: "explicit_client",
      }
    : appointment?.client
      ? {
          id: appointment.client.id,
          fullName: appointment.client.fullName,
          stageLabel: normalizeOptionalText(appointment.client.stage),
          bindingSource: "appointment_context",
        }
      : null;
  const resolvedAppointment: FrontOfficeListingShareResolvedAppointment | null =
    appointment
      ? {
          id: appointment.id,
          title: appointment.title.trim(),
          startsAt: appointment.startsAt ?? null,
        }
      : null;
  const inheritedClientFromAppointment =
    client?.bindingSource === "appointment_context";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildShareCode();
    const sharePath = buildFrontOfficeListingSharePath(code);
    const sentAt = new Date();

    try {
      const transactionResult = await prisma.$transaction(
        async (transaction) => {
          const createdShareLink = await transaction.listingShareLink.create({
            data: {
              listingId: listing.id,
              membershipId: input.viewerMembershipId,
              channel: normalizedChannel,
              code,
              targetUrl: sharePath,
            },
            select: {
              id: true,
              code: true,
              targetUrl: true,
              createdAt: true,
            },
          });
          const createdSendRecord = client
            ? await transaction.frontOfficeSendRecord.create({
                data: {
                  organizationId: input.organizationId,
                  officeId: input.officeId ?? null,
                  senderMembershipId: input.viewerMembershipId,
                  clientId: client.id,
                  listingId: listing.id,
                  appointmentId: resolvedAppointment?.id ?? null,
                  shareLinkId: createdShareLink.id,
                  channel: normalizedChannel,
                  materialType: FrontOfficeSendMaterialType.listing_share,
                  clientStageLabel: client.stageLabel,
                  appointmentTitle: resolvedAppointment?.title ?? null,
                  appointmentStartsAt: resolvedAppointment?.startsAt ?? null,
                  sentAt,
                },
                select: {
                  id: true,
                  sentAt: true,
                },
              })
            : null;
          let aiAcceptedActionRecorded = false;

          if (acceptedAiAction) {
            if (!client?.id || !createdSendRecord?.id) {
              throw createFrontOfficeListingShareLinkError({
                code: "ai_action_requires_client_context",
                message:
                  "AI tracked-send assist requires client-linked send context.",
                status: 409,
              });
            }

            await recordFrontOfficeAiAcceptedAction(transaction, {
              organizationId: input.organizationId,
              officeId: input.officeId ?? null,
              membershipId: input.viewerMembershipId,
              clientId: client.id,
              listingId: listing.id,
              sendRecordId: createdSendRecord.id,
              actionType: "tracked_send_created",
              sourceSurface: acceptedAiAction.sourceSurface,
              suggestionKind: acceptedAiAction.suggestionKind,
              suggestionLabel: acceptedAiAction.suggestionLabel,
              actionTitle: acceptedAiAction.actionTitle || listing.title,
              channel: normalizedChannel,
            });
            aiAcceptedActionRecorded = true;
          }

          return {
            createdShareLink,
            createdSendRecord,
            aiAcceptedActionRecorded,
          };
        },
      );

      const shareSnapshot = buildShareResultSnapshot({
        shareLinkId: transactionResult.createdShareLink.id,
        shareCode: transactionResult.createdShareLink.code,
        sharePath: transactionResult.createdShareLink.targetUrl,
        shareLinkCreatedAt: transactionResult.createdShareLink.createdAt,
        channel: normalizedChannel,
        client,
        appointment: resolvedAppointment,
        inheritedClientFromAppointment,
        sentAt: transactionResult.createdSendRecord?.sentAt ?? sentAt,
        sendRecordId: transactionResult.createdSendRecord?.id ?? null,
        aiAcceptedActionRecorded: transactionResult.aiAcceptedActionRecorded,
      });

      return {
        id: transactionResult.createdShareLink.id,
        listingId: listing.id,
        listingTitle: listing.title,
        channel: normalizedChannel,
        sharePath: transactionResult.createdShareLink.targetUrl,
        sendRecordId: transactionResult.createdSendRecord?.id ?? null,
        context: shareSnapshot.context,
        snapshot: shareSnapshot.snapshot,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw createFrontOfficeListingShareLinkError({
    code: "share_link_code_conflict",
    message: "Could not create a unique listing share link.",
    status: 409,
  });
}

export async function getFrontOfficeListingSharePageSnapshot(
  code: string,
): Promise<FrontOfficeListingSharePageSnapshot | null> {
  const shareLink = await prisma.listingShareLink.findUnique({
    where: { code },
    select: {
      code: true,
      membershipId: true,
      sendRecord: {
        select: {
          id: true,
          firstOpenedAt: true,
        },
      },
      listing: {
        select: {
          title: true,
          neighborhood: true,
          city: true,
          price: true,
          bedrooms: true,
          bathrooms: true,
          aiSummary: true,
          sourceUrl: true,
          status: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!shareLink) {
    return null;
  }

  const openedAt = new Date();
  await prisma.$transaction([
    prisma.listingShareLink.update({
      where: { code },
      data: {
        clickCount: {
          increment: 1,
        },
      },
    }),
    ...(shareLink.sendRecord
      ? [
          prisma.frontOfficeSendRecord.update({
            where: { id: shareLink.sendRecord.id },
            data: {
              openCount: {
                increment: 1,
              },
              lastOpenedAt: openedAt,
              ...(shareLink.sendRecord.firstOpenedAt
                ? {}
                : { firstOpenedAt: openedAt }),
            },
          }),
        ]
      : []),
  ]);

  const membership = shareLink.membershipId
    ? await prisma.membership.findUnique({
        where: { id: shareLink.membershipId },
        select: {
          title: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      })
    : null;

  const agentName =
    `${membership?.user.firstName ?? ""} ${membership?.user.lastName ?? ""}`.trim() ||
    membership?.user.email ||
    "Acre agent";
  const agentLabel = membership?.title?.trim()
    ? `${agentName} · ${membership.title.trim()}`
    : agentName;

  return {
    code: shareLink.code,
    listingTitle: shareLink.listing.title,
    areaLabel: `${shareLink.listing.neighborhood}, ${shareLink.listing.city}`,
    priceLabel: formatCurrency(shareLink.listing.price),
    factsLabel: buildFactsLabel({
      bedrooms: shareLink.listing.bedrooms,
      bathrooms: shareLink.listing.bathrooms,
    }),
    summaryLabel:
      shareLink.listing.aiSummary?.trim() || "Curated listing from Acre.",
    statusLabel:
      shareLink.listing.status === ListingStatus.hot
        ? "Hot listing"
        : "Active listing",
    sourceUrl: shareLink.listing.sourceUrl?.trim() || "",
    agentLabel,
    agentEmail: membership?.user.email?.trim() || "",
    agentPhone: membership?.user.phone?.trim() || "",
    organizationLabel: shareLink.listing.organization.name,
  };
}
