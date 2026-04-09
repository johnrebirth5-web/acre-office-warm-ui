import { randomUUID } from "node:crypto";
import { Prisma, ResourceType } from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";

export const frontOfficeVendorInteractionActions = [
  "phone",
  "email",
  "website",
  "primary",
] as const;

export type FrontOfficeVendorInteractionAction =
  (typeof frontOfficeVendorInteractionActions)[number];

const frontOfficeTrackedResourceInteractionWindowDays = 14;
const frontOfficeTrackedResourceInteractionActions = [
  activityLogActions.frontOfficeResourceSearched,
  activityLogActions.frontOfficeResourceOpened,
  activityLogActions.frontOfficeVendorClicked,
] as const;

type FrontOfficeResourceInteractionInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  resourceId: string;
};

type FrontOfficeVendorInteractionInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  vendorId: string;
  action: FrontOfficeVendorInteractionAction;
};

type FrontOfficeResourceSearchInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  query: string;
};

type GetFrontOfficeResourceInteractionSnapshotInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
};

export type FrontOfficeResourceInteractionSnapshot = {
  windowLabel: string;
  totalCount: number;
  searchCount: number;
  resourceOpenCount: number;
  vendorClickCount: number;
  recentInteractionCount: number;
  lastInteractionLabel: string;
  recentInteractions: Array<{
    id: string;
    title: string;
    kindLabel: "Resource search" | "Resource open" | "Vendor click";
    detailLabel: string;
    timestampLabel: string;
    href: string;
  }>;
};

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatResourceTypeLabel(type: ResourceType) {
  switch (type) {
    case ResourceType.playbook:
      return "Playbook";
    case ResourceType.template:
      return "Template";
    case ResourceType.document:
      return "Document";
    case ResourceType.training_video:
      return "Training video";
    case ResourceType.vendor_card:
      return "Vendor support card";
    default:
      return "Resource";
  }
}

function getResourceActionLabel(type: ResourceType) {
  switch (type) {
    case ResourceType.playbook:
      return "Open playbook";
    case ResourceType.template:
      return "Open template";
    case ResourceType.document:
      return "Open document";
    case ResourceType.training_video:
      return "Watch training";
    case ResourceType.vendor_card:
      return "Open vendor card";
    default:
      return "Open resource";
  }
}

function formatVendorActionLabel(action: FrontOfficeVendorInteractionAction) {
  switch (action) {
    case "phone":
      return "Call";
    case "email":
      return "Email";
    case "website":
      return "Open site";
    case "primary":
      return "Open vendor card";
    default:
      return "Open vendor";
  }
}

function isPayloadObject(
  payload: Prisma.JsonValue | null,
): payload is Prisma.JsonObject {
  return (
    Boolean(payload) && typeof payload === "object" && !Array.isArray(payload)
  );
}

function parsePayloadString(payload: Prisma.JsonObject, key: string) {
  return typeof payload[key] === "string" ? payload[key] : undefined;
}

function parsePayloadNullableString(payload: Prisma.JsonObject, key: string) {
  return typeof payload[key] === "string"
    ? payload[key]
    : payload[key] === null
      ? null
      : undefined;
}

function parsePayloadDetails(payload: Prisma.JsonObject) {
  const value = payload.details;

  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function formatWindowLabel(days: number) {
  return `Last ${days} days`;
}

function extractInteractionLabels(payload: Prisma.JsonValue | null) {
  if (!isPayloadObject(payload)) {
    return {
      objectLabel: undefined,
      officeId: undefined,
      contextHref: undefined,
      details: [] as string[],
    };
  }

  return {
    objectLabel: parsePayloadString(payload, "objectLabel"),
    officeId: parsePayloadNullableString(payload, "officeId"),
    contextHref: parsePayloadString(payload, "contextHref"),
    details: parsePayloadDetails(payload),
  };
}

function formatInteractionKindLabel(
  action: string,
): "Resource search" | "Resource open" | "Vendor click" {
  if (action === activityLogActions.frontOfficeResourceSearched) {
    return "Resource search";
  }

  return action === activityLogActions.frontOfficeVendorClicked
    ? "Vendor click"
    : "Resource open";
}

function buildInteractionDetailLabel(action: string, details: string[]) {
  if (action === activityLogActions.frontOfficeResourceSearched) {
    const queryDetail =
      details.find((detail) => detail.startsWith("Query: ")) ?? null;
    const scopeDetail =
      details.find((detail) => detail.startsWith("Scope: ")) ?? null;

    if (queryDetail && scopeDetail) {
      return `${queryDetail.replace("Query: ", "")} · ${scopeDetail.replace("Scope: ", "")}`;
    }

    if (queryDetail) {
      return queryDetail.replace("Query: ", "");
    }

    return "Tracked hub search";
  }

  const actionDetail =
    details.find((detail) => detail.startsWith("Action: ")) ?? null;
  const secondaryDetail =
    details.find((detail) => !detail.startsWith("Action: ")) ?? null;

  if (actionDetail && secondaryDetail) {
    return `${actionDetail.replace("Action: ", "")} · ${secondaryDetail}`;
  }

  if (actionDetail) {
    return actionDetail.replace("Action: ", "");
  }

  if (secondaryDetail) {
    return secondaryDetail;
  }

  return action === activityLogActions.frontOfficeVendorClicked
    ? "Tracked vendor action"
    : "Tracked resource open";
}

function matchesOfficeScope(
  payloadOfficeId: string | null | undefined,
  officeId: string | null | undefined,
) {
  if (!officeId) {
    return true;
  }

  return payloadOfficeId === officeId;
}

export async function getFrontOfficeResourceInteractionSnapshot(
  input: GetFrontOfficeResourceInteractionSnapshotInput,
): Promise<FrontOfficeResourceInteractionSnapshot> {
  const windowStart = new Date(
    Date.now() -
      frontOfficeTrackedResourceInteractionWindowDays * 24 * 60 * 60 * 1000,
  );
  const rawInteractions = await prisma.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      action: {
        in: [...frontOfficeTrackedResourceInteractionActions],
      },
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      action: true,
      payload: true,
      createdAt: true,
    },
  });
  const interactions = rawInteractions
    .map((interaction) => {
      const payload = extractInteractionLabels(interaction.payload);

      return {
        ...interaction,
        ...payload,
      };
    })
    .filter((interaction) =>
      matchesOfficeScope(interaction.officeId, input.officeId ?? null),
    );
  const resourceOpenCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeResourceOpened,
  ).length;
  const searchCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeResourceSearched,
  ).length;
  const vendorClickCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeVendorClicked,
  ).length;
  const recentInteractions = interactions.slice(0, 6).map((interaction) => ({
    id: interaction.id,
    title: interaction.objectLabel || "Tracked Front Office interaction",
    kindLabel: formatInteractionKindLabel(interaction.action),
    detailLabel: buildInteractionDetailLabel(
      interaction.action,
      interaction.details,
    ),
    timestampLabel: formatDateTimeLabel(interaction.createdAt, {
      timeZone: input.timeZone ?? null,
    }),
    href:
      interaction.contextHref ??
      (interaction.action === activityLogActions.frontOfficeVendorClicked
        ? "/agent/resources#vendor-hub"
        : "/agent/resources#published-tool-library"),
  }));
  const totalCount = searchCount + resourceOpenCount + vendorClickCount;
  const latestInteraction = recentInteractions[0] ?? null;

  return {
    windowLabel: formatWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    totalCount,
    searchCount,
    resourceOpenCount,
    vendorClickCount,
    recentInteractionCount: recentInteractions.length,
    lastInteractionLabel: latestInteraction
      ? `${latestInteraction.kindLabel} · ${latestInteraction.timestampLabel}`
      : `No tracked use in the last ${frontOfficeTrackedResourceInteractionWindowDays} days`,
    recentInteractions,
  };
}

export async function recordFrontOfficeResourceSearch(
  input: FrontOfficeResourceSearchInput,
) {
  const query = input.query.trim();

  if (!query) {
    throw new Error("Search query is required.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "resource",
    entityId: randomUUID(),
    action: activityLogActions.frontOfficeResourceSearched,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: "Resource hub search",
      contextHref: `/agent/resources?q=${encodeURIComponent(query)}`,
      actionSource: "front_office_resource_hub",
      details: [`Query: ${query}`, "Scope: Resources + vendors"],
    },
  });
}

export async function recordFrontOfficeResourceOpen(
  input: FrontOfficeResourceInteractionInput,
) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const resource = await prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      isPublished: true,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      title: true,
      type: true,
    },
  });

  if (!resource) {
    throw new Error("Resource was not found.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "resource",
    entityId: resource.id,
    action: activityLogActions.frontOfficeResourceOpened,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: resource.title,
      contextHref: "/agent/resources#published-tool-library",
      actionSource: "front_office_resource_hub",
      details: [
        `Lane: ${formatResourceTypeLabel(resource.type)}`,
        `Action: ${getResourceActionLabel(resource.type)}`,
      ],
    },
  });
}

export async function recordFrontOfficeVendorClick(
  input: FrontOfficeVendorInteractionInput,
) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: input.vendorId,
      organizationId: input.organizationId,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      phone: true,
      email: true,
      website: true,
    },
  });

  if (!vendor) {
    throw new Error("Vendor was not found.");
  }

  if (input.action === "phone" && !vendor.phone?.trim()) {
    throw new Error("Vendor phone action is not available.");
  }

  if (input.action === "email" && !vendor.email?.trim()) {
    throw new Error("Vendor email action is not available.");
  }

  if (input.action === "website" && !vendor.website?.trim()) {
    throw new Error("Vendor website action is not available.");
  }

  if (
    input.action === "primary" &&
    !vendor.website?.trim() &&
    !vendor.phone?.trim() &&
    !vendor.email?.trim()
  ) {
    throw new Error("Vendor primary action is not available.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "vendor",
    entityId: vendor.id,
    action: activityLogActions.frontOfficeVendorClicked,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: vendor.name,
      contextHref: "/agent/resources#vendor-hub",
      actionSource: "front_office_resource_hub",
      details: [
        `Action: ${formatVendorActionLabel(input.action)}`,
        `Category: ${vendor.category || "Vendor"}`,
      ],
    },
  });
}
