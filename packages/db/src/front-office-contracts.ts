import { randomUUID } from "node:crypto";
import { FrontOfficeHandoffStatus, Prisma } from "@prisma/client";
import { prisma } from "./client";

export const frontOfficeHandoffStagePatterns = [
  "negotiation",
  "application",
  "offer",
  "won",
  "contract",
] as const;

export type FrontOfficeHandoffPrefillIssueCode =
  | "client_intent_inferred"
  | "preferred_areas_missing"
  | "budget_missing"
  | "owner_missing"
  | "contact_info_missing";

export type FrontOfficeHandoffPrefillIssue = {
  code: FrontOfficeHandoffPrefillIssueCode;
  label: string;
  description: string;
};

type FrontOfficeHandoffPrefillBase = {
  handoffDraftId: string;
  handoffStatus: FrontOfficeHandoffStatus;
  clientId: string;
  clientName: string;
  clientWorkspaceHref: string;
  ownerMembershipId: string | null;
  ownerLabel: string;
  stageLabel: string;
  summary: string;
  preferredAreasLabel: string;
  budgetLabel: string;
};

type FrontOfficeHandoffPrefillReadySnapshot = FrontOfficeHandoffPrefillBase & {
  kind: "available";
  initialValues: Record<string, string>;
  issues: FrontOfficeHandoffPrefillIssue[];
  isComplete: boolean;
  requiresAcknowledgement: boolean;
  acknowledgementLabel?: string;
  feedbackTitle: string;
  feedbackDescription: string;
};

type FrontOfficeHandoffPrefillSubmittingSnapshot =
  FrontOfficeHandoffPrefillBase & {
    kind: "submitting";
    feedbackTitle: string;
    feedbackDescription: string;
  };

type FrontOfficeHandoffPrefillCommittedSnapshot =
  FrontOfficeHandoffPrefillBase & {
    kind: "committed";
    committedTransactionId: string | null;
    committedTransactionHref: string | null;
    feedbackTitle: string;
    feedbackDescription: string;
  };

type FrontOfficeHandoffPrefillUnavailableSnapshot =
  FrontOfficeHandoffPrefillBase & {
    kind: "canceled" | "unsupported_target";
    feedbackTitle: string;
    feedbackDescription: string;
    targetWorkflow?: string;
  };

type FrontOfficeHandoffPrefillMissingSnapshot = {
  kind: "missing";
  handoffDraftId: string;
  feedbackTitle: string;
  feedbackDescription: string;
};

export type FrontOfficeHandoffPrefillSnapshot =
  | FrontOfficeHandoffPrefillReadySnapshot
  | FrontOfficeHandoffPrefillSubmittingSnapshot
  | FrontOfficeHandoffPrefillCommittedSnapshot
  | FrontOfficeHandoffPrefillUnavailableSnapshot
  | FrontOfficeHandoffPrefillMissingSnapshot;

export type FrontOfficeHandoffCommitMode = "claim" | "commit" | "release";

export type FrontOfficeHandoffCommitResult =
  | {
      ok: true;
      mode: FrontOfficeHandoffCommitMode;
      handoffDraftId: string;
      reason:
        | "claimed"
        | "already_claimed"
        | "released"
        | "release_not_needed"
        | "committed"
        | "already_committed";
      committedTransactionId: string | null;
      claimToken: string | null;
    }
  | {
      ok: false;
      mode: FrontOfficeHandoffCommitMode;
      handoffDraftId: string;
      reason:
        | "missing"
        | "canceled"
        | "already_committed"
        | "committed_to_other_transaction"
        | "unsupported_target"
        | "submission_in_progress"
        | "claim_required"
        | "claim_mismatch";
      committedTransactionId: string | null;
      claimToken: string | null;
    };

type FrontOfficeHandoffSubmissionClaim = {
  actorMembershipId: string;
  claimedAt: string;
  expiresAt: string;
  token: string;
};

const frontOfficeCreateClaimMetadataKey = "backOfficeCreateClaim";
const frontOfficeCreateClaimTtlMs = 10 * 60 * 1000;

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  const minValue = Number(min ?? 0);
  const maxValue = Number(max ?? 0);

  if (minValue > 0 && maxValue > 0) {
    return `${formatCurrency(minValue)} - ${formatCurrency(maxValue)}`;
  }

  if (maxValue > 0) {
    return `Up to ${formatCurrency(maxValue)}`;
  }

  if (minValue > 0) {
    return `From ${formatCurrency(minValue)}`;
  }

  return "Budget not captured";
}

function inferRepresentingValue(intent: string | null | undefined) {
  const normalized = intent?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "buyer";
  }

  if (
    normalized.includes("landlord") ||
    normalized.includes("lease listing") ||
    normalized.includes("rental listing")
  ) {
    return "landlord";
  }

  if (
    normalized.includes("tenant") ||
    normalized.includes("renter") ||
    normalized.includes("rental") ||
    normalized.includes("lease")
  ) {
    return "tenant";
  }

  if (
    normalized.includes("seller") ||
    normalized.includes("listing") ||
    normalized.includes("sale listing")
  ) {
    return "seller";
  }

  return "buyer";
}

function inferTransactionTypeValue(
  intent: string | null | undefined,
  representing: string,
) {
  const normalized = intent?.trim().toLowerCase() ?? "";
  const isCommercial = normalized.includes("commercial");

  if (representing === "landlord") {
    return isCommercial ? "commercial_lease" : "rental_listing";
  }

  if (representing === "tenant") {
    return isCommercial ? "commercial_lease" : "rental_leasing";
  }

  if (representing === "seller") {
    return isCommercial ? "commercial_sales" : "sales_listing";
  }

  if (representing === "buyer") {
    return isCommercial ? "commercial_sales" : "sales";
  }

  return "other";
}

function buildTransactionName(
  clientName: string,
  preferredAreas: string[],
  stageLabel: string,
) {
  const primaryArea = preferredAreas[0]?.trim();

  if (primaryArea) {
    return `${clientName} · ${primaryArea}`;
  }

  return `${clientName} · ${stageLabel}`;
}

function buildCommittedTransactionHref(
  transactionId: string | null | undefined,
) {
  const normalizedTransactionId = transactionId?.trim();

  return normalizedTransactionId
    ? `/office/transactions/${normalizedTransactionId}`
    : null;
}

export function buildFrontOfficeHandoffCreateHref(handoffId: string) {
  return `/office/transactions/new?handoffId=${encodeURIComponent(handoffId)}`;
}

export function isFrontOfficeStageReadyForBackOffice(
  stage: string | null | undefined,
) {
  const normalized = stage?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return frontOfficeHandoffStagePatterns.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function buildFrontOfficeHandoffSummary(
  stage: string,
  clientName: string,
) {
  return `${clientName} reached ${stage}. Formal transaction, signatures, or archival workflow should continue in Back Office.`;
}

function buildOwnerLabel(handoff: {
  ownerMembershipId: string | null;
  ownerMembership: {
    user: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
  } | null;
}) {
  if (!handoff.ownerMembershipId) {
    return "Front Office owner not assigned";
  }

  return (
    `${handoff.ownerMembership?.user.firstName ?? ""} ${handoff.ownerMembership?.user.lastName ?? ""}`.trim() ||
    handoff.ownerMembership?.user.email ||
    "Assigned owner"
  );
}

function normalizeFrontOfficeHandoffMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {} as Prisma.JsonObject;
  }

  return { ...(metadata as Prisma.JsonObject) };
}

function readFrontOfficeCreateClaim(
  metadata: unknown,
): FrontOfficeHandoffSubmissionClaim | null {
  const normalizedMetadata = normalizeFrontOfficeHandoffMetadata(metadata);
  const rawClaim = normalizedMetadata[frontOfficeCreateClaimMetadataKey];

  if (!rawClaim || typeof rawClaim !== "object" || Array.isArray(rawClaim)) {
    return null;
  }

  const claimRecord = rawClaim as Record<string, unknown>;
  const actorMembershipId =
    typeof claimRecord.actorMembershipId === "string"
      ? claimRecord.actorMembershipId.trim()
      : "";
  const claimedAt =
    typeof claimRecord.claimedAt === "string" ? claimRecord.claimedAt : "";
  const expiresAt =
    typeof claimRecord.expiresAt === "string" ? claimRecord.expiresAt : "";
  const token = typeof claimRecord.token === "string" ? claimRecord.token : "";

  if (!actorMembershipId || !claimedAt || !expiresAt || !token) {
    return null;
  }

  return {
    actorMembershipId,
    claimedAt,
    expiresAt,
    token,
  };
}

function isFrontOfficeCreateClaimActive(
  claim: FrontOfficeHandoffSubmissionClaim | null,
  now = new Date(),
) {
  if (!claim) {
    return false;
  }

  const expiryTime = Date.parse(claim.expiresAt);

  if (!Number.isFinite(expiryTime)) {
    return false;
  }

  return expiryTime > now.getTime();
}

function buildFrontOfficeCreateClaim(
  actorMembershipId: string,
  now = new Date(),
) {
  return {
    actorMembershipId,
    claimedAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + frontOfficeCreateClaimTtlMs,
    ).toISOString(),
    token: randomUUID(),
  } satisfies FrontOfficeHandoffSubmissionClaim;
}

function withFrontOfficeCreateClaim(
  metadata: unknown,
  claim: FrontOfficeHandoffSubmissionClaim,
) {
  const normalizedMetadata = normalizeFrontOfficeHandoffMetadata(metadata);

  return {
    ...normalizedMetadata,
    [frontOfficeCreateClaimMetadataKey]: claim,
  } as Prisma.InputJsonObject;
}

function withoutFrontOfficeCreateClaim(metadata: unknown) {
  const normalizedMetadata = normalizeFrontOfficeHandoffMetadata(metadata);

  delete normalizedMetadata[frontOfficeCreateClaimMetadataKey];

  return Object.keys(normalizedMetadata).length > 0
    ? (normalizedMetadata as Prisma.InputJsonObject)
    : Prisma.JsonNull;
}

function buildPrefillIssues(input: {
  budgetLabel: string;
  clientEmail: string | null;
  clientIntent: string | null;
  clientPhone: string | null;
  ownerMembershipId: string | null;
  preferredAreas: string[];
}) {
  const issues: FrontOfficeHandoffPrefillIssue[] = [];

  if (!input.clientIntent?.trim()) {
    issues.push({
      code: "client_intent_inferred",
      label: "Intent inferred",
      description:
        "Front Office did not capture the client intent, so Back Office transaction type and representation were inferred. Review those selections before saving.",
    });
  }

  if (input.preferredAreas.length === 0) {
    issues.push({
      code: "preferred_areas_missing",
      label: "Areas missing",
      description:
        "Preferred areas were not captured in Front Office. Review the transaction name and location context before formalizing the record.",
    });
  }

  if (input.budgetLabel === "Budget not captured") {
    issues.push({
      code: "budget_missing",
      label: "Budget missing",
      description:
        "Front Office did not capture budget guidance. Add or verify financial context before Back Office workflow continues.",
    });
  }

  if (!input.ownerMembershipId) {
    issues.push({
      code: "owner_missing",
      label: "Owner needs review",
      description:
        "This handoff did not carry a Front Office owner assignment. Confirm the Back Office owner before creating the formal transaction.",
    });
  }

  if (!input.clientEmail?.trim() && !input.clientPhone?.trim()) {
    issues.push({
      code: "contact_info_missing",
      label: "Contact info missing",
      description:
        "The client page has no email or phone on this handoff. The transaction can still be created, but client contact details need manual review.",
    });
  }

  return issues;
}

export async function getFrontOfficeHandoffPrefill(input: {
  organizationId: string;
  handoffDraftId: string;
  officeId?: string | null;
}): Promise<FrontOfficeHandoffPrefillSnapshot> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const handoff = await prisma.frontOfficeHandoffDraft.findFirst({
    where: {
      id: input.handoffDraftId,
      organizationId: input.organizationId,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      status: true,
      targetWorkflow: true,
      stageLabel: true,
      summary: true,
      metadata: true,
      ownerMembershipId: true,
      committedTransactionId: true,
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          intent: true,
          budgetMin: true,
          budgetMax: true,
          preferredAreas: true,
          notes: true,
        },
      },
      ownerMembership: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!handoff) {
    return {
      kind: "missing",
      handoffDraftId: input.handoffDraftId,
      feedbackTitle: "Client handoff unavailable",
      feedbackDescription:
        "This client handoff could not be loaded from your current view. You can still create a manual Back Office transaction here, but it will not update the client page.",
    };
  }

  const representing = inferRepresentingValue(handoff.client.intent);
  const transactionType = inferTransactionTypeValue(
    handoff.client.intent,
    representing,
  );
  const ownerLabel = buildOwnerLabel(handoff);
  const preferredAreas = handoff.client.preferredAreas
    .map((area) => area.trim())
    .filter(Boolean);
  const summary =
    handoff.summary?.trim() ||
    buildFrontOfficeHandoffSummary(handoff.stageLabel, handoff.client.fullName);
  const budgetLabel = formatBudgetRange(
    handoff.client.budgetMin ? Number(handoff.client.budgetMin) : null,
    handoff.client.budgetMax ? Number(handoff.client.budgetMax) : null,
  );
  const noteParts = [
    summary,
    handoff.client.phone?.trim() ? `Client phone: ${handoff.client.phone}` : "",
    handoff.client.notes?.trim() ? `Client notes: ${handoff.client.notes}` : "",
  ].filter(Boolean);
  const baseSnapshot: FrontOfficeHandoffPrefillBase = {
    handoffDraftId: handoff.id,
    handoffStatus: handoff.status,
    clientId: handoff.client.id,
    clientName: handoff.client.fullName,
    clientWorkspaceHref: `/agent/clients/${handoff.client.id}`,
    ownerMembershipId: handoff.ownerMembershipId,
    ownerLabel,
    stageLabel: handoff.stageLabel,
    summary,
    preferredAreasLabel: preferredAreas.length
      ? preferredAreas.join(", ")
      : "Areas not captured",
    budgetLabel,
  };

  if (handoff.targetWorkflow !== "transaction") {
    return {
      ...baseSnapshot,
      kind: "unsupported_target",
      targetWorkflow: handoff.targetWorkflow,
      feedbackTitle: "Client handoff points to another workflow",
      feedbackDescription: `This handoff is marked for ${handoff.targetWorkflow}. Continue from the client page instead of opening the transaction create flow.`,
    };
  }

  if (handoff.status === FrontOfficeHandoffStatus.committed) {
    const committedTransactionHref = buildCommittedTransactionHref(
      handoff.committedTransactionId,
    );

    return {
      ...baseSnapshot,
      kind: "committed",
      committedTransactionId: handoff.committedTransactionId,
      committedTransactionHref,
      feedbackTitle: "Client handoff already used",
      feedbackDescription: committedTransactionHref
        ? `This handoff already created a formal Back Office transaction. Continue the formal workflow in that record instead of opening a second create flow.`
        : "This handoff is already marked committed, but the linked Back Office record is unavailable from this view. Review the client page or transaction list before creating anything new.",
    };
  }

  if (handoff.status === FrontOfficeHandoffStatus.canceled) {
    return {
      ...baseSnapshot,
      kind: "canceled",
      feedbackTitle: "Client handoff no longer active",
      feedbackDescription:
        "This handoff was canceled on the client page, so creating a Back Office record from here would be a manual action only. Reconfirm the client details before continuing.",
    };
  }

  const activeCreateClaim = readFrontOfficeCreateClaim(handoff.metadata);

  if (isFrontOfficeCreateClaimActive(activeCreateClaim)) {
    return {
      ...baseSnapshot,
      kind: "submitting",
      feedbackTitle: "Client handoff is already being submitted",
      feedbackDescription:
        "A Back Office create request is already finalizing this handoff. Wait a moment and reload this page before trying again so the formal transaction record does not get duplicated.",
    };
  }

  const issues = buildPrefillIssues({
    budgetLabel,
    clientEmail: handoff.client.email,
    clientIntent: handoff.client.intent,
    clientPhone: handoff.client.phone,
    ownerMembershipId: handoff.ownerMembershipId,
    preferredAreas,
  });

  return {
    ...baseSnapshot,
    kind: "available",
    initialValues: {
      transactionType,
      transactionStatus: "pending",
      representing,
      transactionName: buildTransactionName(
        handoff.client.fullName,
        preferredAreas,
        handoff.stageLabel,
      ),
      buyerTenant: handoff.client.fullName,
      clientEmail: handoff.client.email?.trim() || "",
      note: noteParts.join("\n"),
      agentName: ownerLabel,
    },
    issues,
    isComplete: issues.length === 0,
    requiresAcknowledgement: issues.length > 0,
    acknowledgementLabel:
      issues.length > 0
        ? "I reviewed the missing or inferred client details and still want to create the formal Back Office transaction."
        : undefined,
    feedbackTitle:
      issues.length === 0
        ? "Client handoff ready for formal create"
        : "Client handoff needs review before save",
    feedbackDescription:
      issues.length === 0
        ? "The client page prepared the handoff. Create the formal Back Office record here when you are ready to move the transaction workflow over."
        : "The client page prepared this handoff, but some fields were inferred or are still missing. Review the items below before creating the formal Back Office record.",
  };
}

export async function commitFrontOfficeHandoffDraft(input: {
  organizationId: string;
  handoffDraftId: string;
  transactionId?: string;
  actorMembershipId?: string;
  claimToken?: string;
  mode?: FrontOfficeHandoffCommitMode;
}) {
  const mode = input.mode ?? "commit";
  const existing = await prisma.frontOfficeHandoffDraft.findFirst({
    where: {
      id: input.handoffDraftId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      status: true,
      targetWorkflow: true,
      committedTransactionId: true,
      metadata: true,
      updatedAt: true,
    },
  });

  const buildResult = <
    T extends Omit<FrontOfficeHandoffCommitResult, "handoffDraftId">,
  >(
    result: T,
  ) =>
    ({
      handoffDraftId: existing?.id ?? input.handoffDraftId,
      ...result,
    }) as FrontOfficeHandoffCommitResult;

  if (mode === "release" && !existing) {
    return buildResult({
      ok: true,
      mode,
      reason: "release_not_needed",
      committedTransactionId: null,
      claimToken: null,
    });
  }

  if (!existing) {
    return buildResult({
      ok: false,
      mode,
      reason: "missing",
      committedTransactionId: null,
      claimToken: null,
    });
  }

  const currentClaim = readFrontOfficeCreateClaim(existing.metadata);
  const hasActiveClaim = isFrontOfficeCreateClaimActive(currentClaim);

  if (mode === "release") {
    if (
      existing.targetWorkflow !== "transaction" ||
      existing.status === FrontOfficeHandoffStatus.canceled ||
      existing.status === FrontOfficeHandoffStatus.committed ||
      (!hasActiveClaim && existing.status !== FrontOfficeHandoffStatus.draft)
    ) {
      return buildResult({
        ok: true,
        mode,
        reason: "release_not_needed",
        committedTransactionId: existing.committedTransactionId,
        claimToken: null,
      });
    }

    if (
      hasActiveClaim &&
      input.claimToken &&
      currentClaim?.token !== input.claimToken
    ) {
      return buildResult({
        ok: false,
        mode,
        reason: "claim_mismatch",
        committedTransactionId: existing.committedTransactionId,
        claimToken: currentClaim?.token ?? null,
      });
    }

    await prisma.frontOfficeHandoffDraft.updateMany({
      where: {
        id: existing.id,
        organizationId: input.organizationId,
        updatedAt: existing.updatedAt,
        status: {
          in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
        },
      },
      data: {
        status: FrontOfficeHandoffStatus.ready,
        metadata: withoutFrontOfficeCreateClaim(existing.metadata),
      },
    });

    return buildResult({
      ok: true,
      mode,
      reason: "released",
      committedTransactionId: existing.committedTransactionId,
      claimToken: null,
    });
  }

  if (existing.targetWorkflow !== "transaction") {
    return buildResult({
      ok: false,
      mode,
      reason: "unsupported_target",
      committedTransactionId: existing.committedTransactionId,
      claimToken: null,
    });
  }

  if (existing.status === FrontOfficeHandoffStatus.canceled) {
    return buildResult({
      ok: false,
      mode,
      reason: "canceled",
      committedTransactionId: existing.committedTransactionId,
      claimToken: null,
    });
  }

  if (existing.status === FrontOfficeHandoffStatus.committed) {
    if (
      mode === "commit" &&
      existing.committedTransactionId === input.transactionId
    ) {
      return buildResult({
        ok: true,
        mode,
        reason: "already_committed",
        committedTransactionId:
          input.transactionId ?? existing.committedTransactionId,
        claimToken: null,
      });
    }

    return buildResult({
      ok: false,
      mode,
      reason: "already_committed",
      committedTransactionId: existing.committedTransactionId,
      claimToken: null,
    });
  }

  if (mode === "claim") {
    const actorMembershipId = input.actorMembershipId?.trim() ?? "";

    if (!actorMembershipId) {
      return buildResult({
        ok: false,
        mode,
        reason: "claim_required",
        committedTransactionId: existing.committedTransactionId,
        claimToken: null,
      });
    }

    if (hasActiveClaim) {
      if (currentClaim?.actorMembershipId === actorMembershipId) {
        return buildResult({
          ok: true,
          mode,
          reason: "already_claimed",
          committedTransactionId: existing.committedTransactionId,
          claimToken: currentClaim.token,
        });
      }

      return buildResult({
        ok: false,
        mode,
        reason: "submission_in_progress",
        committedTransactionId: existing.committedTransactionId,
        claimToken: currentClaim?.token ?? null,
      });
    }

    const nextClaim = buildFrontOfficeCreateClaim(actorMembershipId);
    const claimResult = await prisma.frontOfficeHandoffDraft.updateMany({
      where: {
        id: existing.id,
        organizationId: input.organizationId,
        updatedAt: existing.updatedAt,
        status: {
          in: [FrontOfficeHandoffStatus.ready, FrontOfficeHandoffStatus.draft],
        },
        committedTransactionId: null,
      },
      data: {
        status: FrontOfficeHandoffStatus.draft,
        metadata: withFrontOfficeCreateClaim(existing.metadata, nextClaim),
      },
    });

    if (claimResult.count === 0) {
      const refreshed = await prisma.frontOfficeHandoffDraft.findFirst({
        where: {
          id: existing.id,
          organizationId: input.organizationId,
        },
        select: {
          status: true,
          committedTransactionId: true,
          metadata: true,
        },
      });
      const refreshedClaim = readFrontOfficeCreateClaim(refreshed?.metadata);

      if (refreshed?.status === FrontOfficeHandoffStatus.committed) {
        return buildResult({
          ok: false,
          mode,
          reason: "already_committed",
          committedTransactionId: refreshed.committedTransactionId,
          claimToken: null,
        });
      }

      return buildResult({
        ok: false,
        mode,
        reason: isFrontOfficeCreateClaimActive(refreshedClaim)
          ? "submission_in_progress"
          : "claim_mismatch",
        committedTransactionId: refreshed?.committedTransactionId ?? null,
        claimToken: refreshedClaim?.token ?? null,
      });
    }

    return buildResult({
      ok: true,
      mode,
      reason: "claimed",
      committedTransactionId: existing.committedTransactionId,
      claimToken: nextClaim.token,
    });
  }

  const transactionId = input.transactionId?.trim() ?? "";

  if (!transactionId) {
    return buildResult({
      ok: false,
      mode,
      reason: "claim_required",
      committedTransactionId: existing.committedTransactionId,
      claimToken: currentClaim?.token ?? null,
    });
  }

  if (
    existing.committedTransactionId &&
    existing.committedTransactionId !== transactionId
  ) {
    return buildResult({
      ok: false,
      mode,
      reason: "committed_to_other_transaction",
      committedTransactionId: existing.committedTransactionId,
      claimToken: currentClaim?.token ?? null,
    });
  }

  if (input.claimToken) {
    if (!currentClaim || currentClaim.token !== input.claimToken) {
      return buildResult({
        ok: false,
        mode,
        reason: "claim_mismatch",
        committedTransactionId: existing.committedTransactionId,
        claimToken: currentClaim?.token ?? null,
      });
    }
  } else if (hasActiveClaim) {
    return buildResult({
      ok: false,
      mode,
      reason: "submission_in_progress",
      committedTransactionId: existing.committedTransactionId,
      claimToken: currentClaim?.token ?? null,
    });
  }

  const commitResult = await prisma.frontOfficeHandoffDraft.updateMany({
    where: {
      id: existing.id,
      organizationId: input.organizationId,
      status: {
        in: [FrontOfficeHandoffStatus.ready, FrontOfficeHandoffStatus.draft],
      },
      committedTransactionId: null,
      targetWorkflow: "transaction",
    },
    data: {
      status: FrontOfficeHandoffStatus.committed,
      committedTransactionId: transactionId,
      committedAt: new Date(),
      metadata: withoutFrontOfficeCreateClaim(existing.metadata),
    },
  });

  if (commitResult.count === 0) {
    const refreshed = await prisma.frontOfficeHandoffDraft.findFirst({
      where: {
        id: existing.id,
        organizationId: input.organizationId,
      },
      select: {
        status: true,
        committedTransactionId: true,
      },
    });

    if (
      refreshed?.status === FrontOfficeHandoffStatus.committed &&
      refreshed.committedTransactionId === transactionId
    ) {
      return buildResult({
        ok: true,
        mode,
        reason: "already_committed",
        committedTransactionId: transactionId,
        claimToken: null,
      });
    }

    return buildResult({
      ok: false,
      mode,
      reason:
        refreshed?.status === FrontOfficeHandoffStatus.committed
          ? "already_committed"
          : "claim_mismatch",
      committedTransactionId: refreshed?.committedTransactionId ?? null,
      claimToken: null,
    });
  }

  return buildResult({
    ok: true,
    mode,
    reason: "committed",
    committedTransactionId: transactionId,
    claimToken: null,
  });
}
