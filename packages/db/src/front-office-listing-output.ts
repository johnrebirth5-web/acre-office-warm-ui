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

function normalizeFrontOfficeSendChannel(
  channel: string,
): FrontOfficeSendChannel {
  switch (channel.trim().toLowerCase()) {
    case "sms":
      return FrontOfficeSendChannel.sms;
    case "email":
      return FrontOfficeSendChannel.email;
    default:
      return FrontOfficeSendChannel.direct;
  }
}

export function buildFrontOfficeListingSharePath(code: string) {
  return `/share/listings/${code}`;
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
  channel: string;
  sharePath: string;
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

export async function createFrontOfficeListingShareLink(
  input: CreateFrontOfficeListingShareLinkInput,
): Promise<FrontOfficeListingShareLinkResult> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const normalizedChannel = normalizeFrontOfficeSendChannel(input.channel);
  const [listing, explicitClient, appointment] = await Promise.all([
    prisma.listing.findFirst({
      where: {
        id: input.listingId,
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
    input.clientId?.trim()
      ? prisma.client.findFirst({
          where: {
            id: input.clientId.trim(),
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
    input.appointmentId?.trim()
      ? prisma.appointment.findFirst({
          where: {
            id: input.appointmentId.trim(),
            organizationId: input.organizationId,
            ownerMembershipId: input.viewerMembershipId,
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
    throw new Error("Listing not found in the current Front Office scope.");
  }

  if (input.clientId?.trim() && !explicitClient) {
    throw new Error("Client not found in the current Front Office scope.");
  }

  if (input.appointmentId?.trim() && !appointment) {
    throw new Error(
      "Appointment not found in the current Front Office scope.",
    );
  }

  if (appointment && !appointment.client?.id) {
    throw new Error(
      "Only client-linked appointments can be used as send context.",
    );
  }

  if (
    explicitClient &&
    appointment?.client?.id &&
    appointment.client.id !== explicitClient.id
  ) {
    throw new Error(
      "Appointment context does not match the selected client.",
    );
  }

  const client = explicitClient ?? appointment?.client ?? null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = buildShareCode();
    const sharePath = buildFrontOfficeListingSharePath(code);
    const sentAt = new Date();

    try {
      const shareLink = await prisma.$transaction(async (transaction) => {
        const createdShareLink = await transaction.listingShareLink.create({
          data: {
            listingId: listing.id,
            membershipId: input.viewerMembershipId,
            channel: input.channel,
            code,
            targetUrl: sharePath,
          },
          select: {
            id: true,
          },
        });
        let createdSendRecordId: string | null = null;

        if (client) {
          const createdSendRecord = await transaction.frontOfficeSendRecord.create({
            data: {
              organizationId: input.organizationId,
              officeId: input.officeId ?? null,
              senderMembershipId: input.viewerMembershipId,
              clientId: client.id,
              listingId: listing.id,
              appointmentId: appointment?.id ?? null,
              shareLinkId: createdShareLink.id,
              channel: normalizedChannel,
              materialType: FrontOfficeSendMaterialType.listing_share,
              clientStageLabel: client.stage?.trim() || null,
              appointmentTitle: appointment?.title?.trim() || null,
              appointmentStartsAt: appointment?.startsAt ?? null,
              sentAt,
            },
            select: {
              id: true,
            },
          });
          createdSendRecordId = createdSendRecord.id;
        }

        if (input.acceptedAiAction) {
          if (!client?.id || !createdSendRecordId) {
            throw new Error(
              "AI tracked-send assist requires client-linked send context.",
            );
          }

          await recordFrontOfficeAiAcceptedAction(transaction, {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            membershipId: input.viewerMembershipId,
            clientId: client.id,
            listingId: listing.id,
            sendRecordId: createdSendRecordId,
            actionType: "tracked_send_created",
            sourceSurface: input.acceptedAiAction.sourceSurface,
            suggestionKind: input.acceptedAiAction.suggestionKind,
            suggestionLabel: input.acceptedAiAction.suggestionLabel,
            actionTitle:
              input.acceptedAiAction.actionTitle?.trim() || listing.title,
            channel: normalizedChannel,
          });
        }

        return createdShareLink;
      });

      return {
        id: shareLink.id,
        listingId: listing.id,
        listingTitle: listing.title,
        channel: normalizedChannel,
        sharePath,
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

  throw new Error("Could not create a unique listing share link.");
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
