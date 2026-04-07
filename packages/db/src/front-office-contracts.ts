import { FrontOfficeHandoffStatus } from "@prisma/client";
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
  | FrontOfficeHandoffPrefillCommittedSnapshot
  | FrontOfficeHandoffPrefillUnavailableSnapshot
  | FrontOfficeHandoffPrefillMissingSnapshot;

export type FrontOfficeHandoffCommitResult =
  | {
      ok: true;
      handoffDraftId: string;
      reason: "committed" | "already_committed";
      committedTransactionId: string;
    }
  | {
      ok: false;
      handoffDraftId: string;
      reason:
        | "missing"
        | "canceled"
        | "already_committed"
        | "committed_to_other_transaction"
        | "unsupported_target";
      committedTransactionId: string | null;
    };

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

function buildCommittedTransactionHref(transactionId: string | null | undefined) {
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
        "The Front Office dossier has no email or phone on this handoff. The transaction can still be created, but client contact details need manual review.",
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
      feedbackTitle: "Front Office handoff unavailable",
      feedbackDescription:
        "This Front Office handoff could not be loaded from your current scope. You can still create a manual Back Office transaction here, but it will not write back to Front Office.",
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
    handoff.client.notes?.trim() ? `FO notes: ${handoff.client.notes}` : "",
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
      feedbackTitle: "Front Office handoff is targeting another workflow",
      feedbackDescription: `This handoff is marked for ${handoff.targetWorkflow}. Continue from the Front Office client record instead of opening the transaction create flow.`,
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
      feedbackTitle: "Front Office handoff already committed",
      feedbackDescription: committedTransactionHref
        ? `This handoff already created a formal Back Office transaction. Continue the formal workflow in that record instead of opening a second create flow.`
        : "This handoff is already marked committed, but the linked Back Office record is unavailable from this view. Review the client dossier or transaction list before creating anything new.",
    };
  }

  if (handoff.status === FrontOfficeHandoffStatus.canceled) {
    return {
      ...baseSnapshot,
      kind: "canceled",
      feedbackTitle: "Front Office handoff no longer active",
      feedbackDescription:
        "This handoff was canceled in Front Office, so creating a Back Office record from this page would be a manual action only. Reconfirm the dossier before continuing.",
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
    feedbackTitle:
      issues.length === 0
        ? "Front Office handoff ready for formal create"
        : "Front Office handoff needs review before save",
    feedbackDescription:
      issues.length === 0
        ? "Front Office prepared the client context. Create the formal Back Office record here when you are ready to hand off the transaction workflow."
        : "Front Office prepared the handoff, but some fields were inferred or are still missing. Review the items below before creating the formal Back Office record.",
  };
}

export async function commitFrontOfficeHandoffDraft(input: {
  organizationId: string;
  handoffDraftId: string;
  transactionId: string;
}) {
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
    },
  });

  if (!existing) {
    return {
      ok: false,
      handoffDraftId: input.handoffDraftId,
      reason: "missing",
      committedTransactionId: null,
    } satisfies FrontOfficeHandoffCommitResult;
  }

  if (existing.targetWorkflow !== "transaction") {
    return {
      ok: false,
      handoffDraftId: existing.id,
      reason: "unsupported_target",
      committedTransactionId: existing.committedTransactionId,
    } satisfies FrontOfficeHandoffCommitResult;
  }

  if (existing.status === FrontOfficeHandoffStatus.canceled) {
    return {
      ok: false,
      handoffDraftId: existing.id,
      reason: "canceled",
      committedTransactionId: existing.committedTransactionId,
    } satisfies FrontOfficeHandoffCommitResult;
  }

  if (existing.status === FrontOfficeHandoffStatus.committed) {
    if (existing.committedTransactionId === input.transactionId) {
      return {
        ok: true,
        handoffDraftId: existing.id,
        reason: "already_committed",
        committedTransactionId: input.transactionId,
      } satisfies FrontOfficeHandoffCommitResult;
    }

    return {
      ok: false,
      handoffDraftId: existing.id,
      reason: "already_committed",
      committedTransactionId: existing.committedTransactionId,
    } satisfies FrontOfficeHandoffCommitResult;
  }

  if (
    existing.committedTransactionId &&
    existing.committedTransactionId !== input.transactionId
  ) {
    return {
      ok: false,
      handoffDraftId: existing.id,
      reason: "committed_to_other_transaction",
      committedTransactionId: existing.committedTransactionId,
    } satisfies FrontOfficeHandoffCommitResult;
  }

  await prisma.frontOfficeHandoffDraft.update({
    where: {
      id: existing.id,
    },
    data: {
      status: FrontOfficeHandoffStatus.committed,
      committedTransactionId: input.transactionId,
      committedAt: new Date(),
    },
  });

  return {
    ok: true,
    handoffDraftId: existing.id,
    reason: "committed",
    committedTransactionId: input.transactionId,
  } satisfies FrontOfficeHandoffCommitResult;
}
