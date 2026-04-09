import { randomUUID } from "node:crypto";
import { Prisma, ResourceType, UserRole } from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { resolveOfficeDataScope } from "./access";

export const frontOfficeVendorInteractionActions = [
  "phone",
  "email",
  "website",
  "primary",
] as const;

export const frontOfficeResourceProgressMilestones = [25, 50, 100] as const;

export type FrontOfficeVendorInteractionAction =
  (typeof frontOfficeVendorInteractionActions)[number];
export type FrontOfficeResourceProgressMilestone =
  (typeof frontOfficeResourceProgressMilestones)[number];

const frontOfficeTrackedResourceInteractionWindowDays = 14;
const frontOfficeTrackedResourceInteractionActions = [
  activityLogActions.frontOfficeResourceSearched,
  activityLogActions.frontOfficeResourceProgressLogged,
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

type FrontOfficeResourceProgressInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  resourceId: string;
  progressPercent: FrontOfficeResourceProgressMilestone;
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
  progressCount: number;
  completionCount: number;
  resourceOpenCount: number;
  vendorClickCount: number;
  recentInteractionCount: number;
  lastInteractionLabel: string;
  recentInteractions: Array<{
    id: string;
    title: string;
    kindLabel:
      | "Resource search"
      | "Watch progress"
      | "Resource open"
      | "Vendor click";
    detailLabel: string;
    timestampLabel: string;
    href: string;
  }>;
};

export type FrontOfficeSharedResourceInteractionSnapshot = {
  visible: boolean;
  scopeKey: "self" | "team" | "organization";
  scopeLabel: string;
  windowLabel: string;
  comparisonWindowLabel: string;
  visibleMembershipCount: number;
  activeMembershipCount: number;
  totalCount: number;
  searchCount: number;
  progressCount: number;
  completionCount: number;
  resourceOpenCount: number;
  vendorClickCount: number;
  recentInteractionCount: number;
  lastInteractionLabel: string;
  totalCountDelta: number;
  searchCountDelta: number;
  progressCountDelta: number;
  completionCountDelta: number;
  activeMembershipDelta: number;
  resourceOpenDelta: number;
  vendorClickDelta: number;
  topActors: Array<{
    membershipId: string;
    label: string;
    interactionCount: number;
    lastInteractionLabel: string;
  }>;
  hottestTargets: Array<{
    key: string;
    title: string;
    kindLabel:
      | "Resource search"
      | "Watch progress"
      | "Resource open"
      | "Vendor click";
    detailLabel: string;
    interactionCount: number;
    href: string;
    lastInteractionLabel: string;
  }>;
};

type GetFrontOfficeSharedResourceInteractionSnapshotInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  timeZone?: string | null;
};

type RawTrackedResourceInteraction = {
  id: string;
  action: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
  membershipId: string | null;
};

type NormalizedTrackedResourceInteraction = {
  id: string;
  action: string;
  createdAt: Date;
  membershipId: string | null;
  objectLabel: string | undefined;
  officeId: string | null | undefined;
  contextHref: string | undefined;
  progressPercent: number | undefined;
  details: string[];
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

function parsePayloadNumber(payload: Prisma.JsonObject, key: string) {
  return typeof payload[key] === "number" ? payload[key] : undefined;
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

function formatComparisonWindowLabel(days: number) {
  return `Prior ${days} days`;
}

function buildEmptySharedResourceInteractionSnapshot(): FrontOfficeSharedResourceInteractionSnapshot {
  return {
    visible: false,
    scopeKey: "self",
    scopeLabel: "",
    windowLabel: formatWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    comparisonWindowLabel: formatComparisonWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    visibleMembershipCount: 1,
    activeMembershipCount: 0,
    totalCount: 0,
    searchCount: 0,
    progressCount: 0,
    completionCount: 0,
    resourceOpenCount: 0,
    vendorClickCount: 0,
    recentInteractionCount: 0,
    lastInteractionLabel: `No shared tracked use in the last ${frontOfficeTrackedResourceInteractionWindowDays} days`,
    totalCountDelta: 0,
    searchCountDelta: 0,
    progressCountDelta: 0,
    completionCountDelta: 0,
    activeMembershipDelta: 0,
    resourceOpenDelta: 0,
    vendorClickDelta: 0,
    topActors: [],
    hottestTargets: [],
  };
}

function extractInteractionLabels(payload: Prisma.JsonValue | null) {
  if (!isPayloadObject(payload)) {
    return {
      objectLabel: undefined,
      officeId: undefined,
      contextHref: undefined,
      progressPercent: undefined,
      details: [] as string[],
    };
  }

  return {
    objectLabel: parsePayloadString(payload, "objectLabel"),
    officeId: parsePayloadNullableString(payload, "officeId"),
    contextHref: parsePayloadString(payload, "contextHref"),
    progressPercent: parsePayloadNumber(payload, "progressPercent"),
    details: parsePayloadDetails(payload),
  };
}

function normalizeTrackedResourceInteractions(
  interactions: RawTrackedResourceInteraction[],
  officeId: string | null | undefined,
) {
  return interactions
    .map((interaction): NormalizedTrackedResourceInteraction => {
      const payload = extractInteractionLabels(interaction.payload);

      return {
        id: interaction.id,
        action: interaction.action,
        createdAt: interaction.createdAt,
        membershipId: interaction.membershipId,
        objectLabel: payload.objectLabel,
        officeId: payload.officeId,
        contextHref: payload.contextHref,
        progressPercent: payload.progressPercent,
        details: payload.details,
      };
    })
    .filter((interaction) =>
      matchesOfficeScope(interaction.officeId, officeId),
    );
}

function formatInteractionKindLabel(
  action: string,
): "Resource search" | "Watch progress" | "Resource open" | "Vendor click" {
  if (action === activityLogActions.frontOfficeResourceSearched) {
    return "Resource search";
  }

  if (action === activityLogActions.frontOfficeResourceProgressLogged) {
    return "Watch progress";
  }

  return action === activityLogActions.frontOfficeVendorClicked
    ? "Vendor click"
    : "Resource open";
}

function buildTrackedInteractionTitle(
  interaction: NormalizedTrackedResourceInteraction,
) {
  if (interaction.action === activityLogActions.frontOfficeResourceSearched) {
    const queryDetail =
      interaction.details.find((detail) => detail.startsWith("Query: ")) ??
      null;

    return queryDetail
      ? queryDetail.replace("Query: ", "")
      : interaction.objectLabel || "Resource hub search";
  }

  return interaction.objectLabel || "Tracked Front Office interaction";
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

  if (action === activityLogActions.frontOfficeResourceProgressLogged) {
    const progressDetail =
      details.find((detail) => detail.startsWith("Progress: ")) ?? null;
    const laneDetail =
      details.find((detail) => detail.startsWith("Lane: ")) ?? null;

    if (progressDetail && laneDetail) {
      return `${progressDetail.replace("Progress: ", "")} · ${laneDetail.replace("Lane: ", "")}`;
    }

    if (progressDetail) {
      return progressDetail.replace("Progress: ", "");
    }

    return "Tracked training progress";
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

function buildResourceInteractionSummary(
  interactions: NormalizedTrackedResourceInteraction[],
  timeZone?: string | null,
) {
  const resourceOpenCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeResourceOpened,
  ).length;
  const searchCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeResourceSearched,
  ).length;
  const progressInteractions = interactions.filter(
    (interaction) =>
      interaction.action ===
      activityLogActions.frontOfficeResourceProgressLogged,
  );
  const progressCount = progressInteractions.length;
  const completionCount = progressInteractions.filter(
    (interaction) => interaction.progressPercent === 100,
  ).length;
  const vendorClickCount = interactions.filter(
    (interaction) =>
      interaction.action === activityLogActions.frontOfficeVendorClicked,
  ).length;
  const recentInteractions = interactions.slice(0, 6).map((interaction) => ({
    id: interaction.id,
    title: buildTrackedInteractionTitle(interaction),
    kindLabel: formatInteractionKindLabel(interaction.action),
    detailLabel: buildInteractionDetailLabel(
      interaction.action,
      interaction.details,
    ),
    timestampLabel: formatDateTimeLabel(interaction.createdAt, {
      timeZone: timeZone ?? null,
    }),
    href:
      interaction.contextHref ??
      (interaction.action === activityLogActions.frontOfficeVendorClicked
        ? "/agent/resources#vendor-hub"
        : "/agent/resources#published-tool-library"),
  }));
  const totalCount =
    searchCount + progressCount + resourceOpenCount + vendorClickCount;
  const latestInteraction = recentInteractions[0] ?? null;
  const lastInteractionLabel = latestInteraction
    ? [latestInteraction.kindLabel, latestInteraction.detailLabel].filter(
        Boolean,
      ).join(" · ") +
      ` · ${latestInteraction.timestampLabel}`
    : `No tracked use in the last ${frontOfficeTrackedResourceInteractionWindowDays} days`;

  return {
    totalCount,
    searchCount,
    progressCount,
    completionCount,
    resourceOpenCount,
    vendorClickCount,
    recentInteractionCount: recentInteractions.length,
    lastInteractionLabel,
    recentInteractions,
  };
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
      membershipId: true,
    },
  });
  const interactions = normalizeTrackedResourceInteractions(
    rawInteractions,
    input.officeId ?? null,
  );
  const summary = buildResourceInteractionSummary(
    interactions,
    input.timeZone ?? null,
  );

  return {
    windowLabel: formatWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    ...summary,
  };
}

function formatSharedTrackingScopeLabel(scopeKind: "team" | "organization") {
  return scopeKind === "organization"
    ? "Office adoption pulse"
    : "Team adoption pulse";
}

function buildMembershipLabel(input: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  email: string | null | undefined;
}) {
  const name = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim();

  return name || input.email?.trim() || "Team member";
}

export async function getFrontOfficeSharedResourceInteractionSnapshot(
  input: GetFrontOfficeSharedResourceInteractionSnapshotInput,
): Promise<FrontOfficeSharedResourceInteractionSnapshot> {
  const now = new Date();
  const windowMilliseconds =
    frontOfficeTrackedResourceInteractionWindowDays * 24 * 60 * 60 * 1000;
  const scope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.membershipId,
    officeId: input.officeId ?? null,
    resource: "agents",
  });

  if (scope.kind === "self") {
    return buildEmptySharedResourceInteractionSnapshot();
  }

  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const visibleMembershipIds =
    scope.visibleMembershipIds ??
    (
      await prisma.membership.findMany({
        where: {
          organizationId: input.organizationId,
          status: "active",
          role: {
            in: [
              UserRole.agent,
              UserRole.team_lead,
              UserRole.office_admin,
              UserRole.owner,
            ],
          },
          ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
        },
        select: {
          id: true,
        },
      })
    ).map((membership) => membership.id);

  const normalizedVisibleMembershipIds = Array.from(
    new Set(visibleMembershipIds.filter(Boolean)),
  );

  if (normalizedVisibleMembershipIds.length <= 1) {
    return buildEmptySharedResourceInteractionSnapshot();
  }

  const currentWindowStart = new Date(now.getTime() - windowMilliseconds);
  const comparisonWindowStart = new Date(
    now.getTime() - windowMilliseconds * 2,
  );
  const [memberships, rawInteractions] = await Promise.all([
    prisma.membership.findMany({
      where: {
        id: {
          in: normalizedVisibleMembershipIds,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId: input.organizationId,
        membershipId: {
          in: normalizedVisibleMembershipIds,
        },
        action: {
          in: [...frontOfficeTrackedResourceInteractionActions],
        },
        createdAt: {
          gte: comparisonWindowStart,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        action: true,
        payload: true,
        createdAt: true,
        membershipId: true,
      },
    }),
  ]);
  const normalizedInteractions = normalizeTrackedResourceInteractions(
    rawInteractions,
    input.officeId ?? null,
  );
  const interactions = normalizedInteractions.filter(
    (interaction) => interaction.createdAt >= currentWindowStart,
  );
  const comparisonInteractions = normalizedInteractions.filter(
    (interaction) => interaction.createdAt < currentWindowStart,
  );
  const summary = buildResourceInteractionSummary(
    interactions,
    input.timeZone ?? null,
  );
  const comparisonSummary = buildResourceInteractionSummary(
    comparisonInteractions,
    input.timeZone ?? null,
  );
  const membershipLabelById = new Map(
    memberships.map((membership) => [
      membership.id,
      buildMembershipLabel({
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
      }),
    ]),
  );
  const actorStats = new Map<
    string,
    { interactionCount: number; latestInteractionAt: Date }
  >();
  const comparisonActorMembershipIds = new Set<string>();

  for (const interaction of interactions) {
    if (!interaction.membershipId) {
      continue;
    }

    const existing = actorStats.get(interaction.membershipId);

    actorStats.set(interaction.membershipId, {
      interactionCount: (existing?.interactionCount ?? 0) + 1,
      latestInteractionAt:
        existing && existing.latestInteractionAt > interaction.createdAt
          ? existing.latestInteractionAt
          : interaction.createdAt,
    });
  }

  for (const interaction of comparisonInteractions) {
    if (interaction.membershipId) {
      comparisonActorMembershipIds.add(interaction.membershipId);
    }
  }

  const topActors = [...actorStats.entries()]
    .sort(
      (left, right) =>
        right[1].interactionCount - left[1].interactionCount ||
        right[1].latestInteractionAt.getTime() -
          left[1].latestInteractionAt.getTime(),
    )
    .slice(0, 4)
    .map(([membershipId, stat]) => ({
      membershipId,
      label: membershipLabelById.get(membershipId) || "Team member",
      interactionCount: stat.interactionCount,
      lastInteractionLabel: formatDateTimeLabel(stat.latestInteractionAt, {
        timeZone: input.timeZone ?? null,
      }),
    }));
  const targetStats = new Map<
    string,
    {
      title: string;
      kindLabel:
        | "Resource search"
        | "Watch progress"
        | "Resource open"
        | "Vendor click";
      detailLabel: string;
      href: string;
      interactionCount: number;
      latestInteractionAt: Date;
    }
  >();

  for (const interaction of interactions) {
    const title = buildTrackedInteractionTitle(interaction);
    const kindLabel = formatInteractionKindLabel(interaction.action);
    const detailLabel = buildInteractionDetailLabel(
      interaction.action,
      interaction.details,
    );
    const href =
      interaction.contextHref ??
      (interaction.action === activityLogActions.frontOfficeVendorClicked
        ? "/agent/resources#vendor-hub"
        : "/agent/resources#published-tool-library");
    const key = `${kindLabel}:${title}:${href}`;
    const existing = targetStats.get(key);

    targetStats.set(key, {
      title,
      kindLabel,
      detailLabel,
      href,
      interactionCount: (existing?.interactionCount ?? 0) + 1,
      latestInteractionAt:
        existing && existing.latestInteractionAt > interaction.createdAt
          ? existing.latestInteractionAt
          : interaction.createdAt,
    });
  }

  const hottestTargets = [...targetStats.entries()]
    .sort(
      (left, right) =>
        right[1].interactionCount - left[1].interactionCount ||
        right[1].latestInteractionAt.getTime() -
          left[1].latestInteractionAt.getTime(),
    )
    .slice(0, 4)
    .map(([key, target]) => ({
      key,
      title: target.title,
      kindLabel: target.kindLabel,
      detailLabel: target.detailLabel,
      interactionCount: target.interactionCount,
      href: target.href,
      lastInteractionLabel: formatDateTimeLabel(target.latestInteractionAt, {
        timeZone: input.timeZone ?? null,
      }),
    }));

  return {
    visible: true,
    scopeKey: scope.kind,
    scopeLabel: formatSharedTrackingScopeLabel(scope.kind),
    windowLabel: formatWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    comparisonWindowLabel: formatComparisonWindowLabel(
      frontOfficeTrackedResourceInteractionWindowDays,
    ),
    visibleMembershipCount: normalizedVisibleMembershipIds.length,
    activeMembershipCount: actorStats.size,
    totalCount: summary.totalCount,
    searchCount: summary.searchCount,
    progressCount: summary.progressCount,
    completionCount: summary.completionCount,
    resourceOpenCount: summary.resourceOpenCount,
    vendorClickCount: summary.vendorClickCount,
    recentInteractionCount: summary.recentInteractionCount,
    lastInteractionLabel:
      summary.totalCount > 0
        ? summary.lastInteractionLabel
        : `No shared tracked use in the last ${frontOfficeTrackedResourceInteractionWindowDays} days`,
    totalCountDelta: summary.totalCount - comparisonSummary.totalCount,
    searchCountDelta: summary.searchCount - comparisonSummary.searchCount,
    progressCountDelta: summary.progressCount - comparisonSummary.progressCount,
    completionCountDelta:
      summary.completionCount - comparisonSummary.completionCount,
    activeMembershipDelta: actorStats.size - comparisonActorMembershipIds.size,
    resourceOpenDelta:
      summary.resourceOpenCount - comparisonSummary.resourceOpenCount,
    vendorClickDelta:
      summary.vendorClickCount - comparisonSummary.vendorClickCount,
    topActors,
    hottestTargets,
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

export async function recordFrontOfficeResourceProgress(
  input: FrontOfficeResourceProgressInput,
) {
  const resource = await prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      isPublished: true,
      type: ResourceType.training_video,
      ...(buildOfficeScopeFilter(input.officeId ?? null)
        ? { AND: [buildOfficeScopeFilter(input.officeId ?? null)!] }
        : {}),
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!resource) {
    throw new Error("Training resource was not found.");
  }

  if (!frontOfficeResourceProgressMilestones.includes(input.progressPercent)) {
    throw new Error("Unsupported resource progress milestone.");
  }

  const progressLabel =
    input.progressPercent === 100
      ? "Completed"
      : `${input.progressPercent}% watched`;

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "resource",
    entityId: resource.id,
    action: activityLogActions.frontOfficeResourceProgressLogged,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: resource.title,
      contextHref: "/agent/resources#published-tool-library",
      actionSource: "front_office_resource_hub",
      progressPercent: input.progressPercent,
      details: [`Progress: ${progressLabel}`, "Lane: Training video"],
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
