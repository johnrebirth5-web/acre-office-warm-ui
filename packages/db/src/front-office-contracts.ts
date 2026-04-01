import { FrontOfficeHandoffStatus } from "@prisma/client";
import { prisma } from "./client";

export const frontOfficeHandoffStagePatterns = [
  "negotiation",
  "application",
  "offer",
  "won",
  "contract",
] as const;

export type FrontOfficeHandoffPrefillSnapshot = {
  handoffDraftId: string;
  clientId: string;
  clientName: string;
  clientWorkspaceHref: string;
  ownerMembershipId: string | null;
  ownerLabel: string;
  stageLabel: string;
  summary: string;
  preferredAreasLabel: string;
  budgetLabel: string;
  initialValues: Record<string, string>;
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

export async function getFrontOfficeHandoffPrefill(input: {
  organizationId: string;
  handoffDraftId: string;
  officeId?: string | null;
}): Promise<FrontOfficeHandoffPrefillSnapshot | null> {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const handoff = await prisma.frontOfficeHandoffDraft.findFirst({
    where: {
      id: input.handoffDraftId,
      organizationId: input.organizationId,
      status: {
        in: [FrontOfficeHandoffStatus.draft, FrontOfficeHandoffStatus.ready],
      },
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      stageLabel: true,
      summary: true,
      ownerMembershipId: true,
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
    return null;
  }

  const representing = inferRepresentingValue(handoff.client.intent);
  const transactionType = inferTransactionTypeValue(
    handoff.client.intent,
    representing,
  );
  const ownerLabel =
    `${handoff.ownerMembership?.user.firstName ?? ""} ${handoff.ownerMembership?.user.lastName ?? ""}`.trim() ||
    handoff.ownerMembership?.user.email ||
    "Assigned owner";
  const summary =
    handoff.summary?.trim() ||
    buildFrontOfficeHandoffSummary(handoff.stageLabel, handoff.client.fullName);
  const noteParts = [
    summary,
    handoff.client.phone?.trim() ? `Client phone: ${handoff.client.phone}` : "",
    handoff.client.notes?.trim() ? `FO notes: ${handoff.client.notes}` : "",
  ].filter(Boolean);

  return {
    handoffDraftId: handoff.id,
    clientId: handoff.client.id,
    clientName: handoff.client.fullName,
    clientWorkspaceHref: `/agent/clients/${handoff.client.id}`,
    ownerMembershipId: handoff.ownerMembershipId,
    ownerLabel,
    stageLabel: handoff.stageLabel,
    summary,
    preferredAreasLabel: handoff.client.preferredAreas.length
      ? handoff.client.preferredAreas.join(", ")
      : "Areas not captured",
    budgetLabel: formatBudgetRange(
      handoff.client.budgetMin ? Number(handoff.client.budgetMin) : null,
      handoff.client.budgetMax ? Number(handoff.client.budgetMax) : null,
    ),
    initialValues: {
      transactionType,
      transactionStatus: "pending",
      representing,
      transactionName: buildTransactionName(
        handoff.client.fullName,
        handoff.client.preferredAreas,
        handoff.stageLabel,
      ),
      buyerTenant: handoff.client.fullName,
      clientEmail: handoff.client.email?.trim() || "",
      note: noteParts.join("\n"),
      agentName: ownerLabel,
    },
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
      committedTransactionId: true,
    },
  });

  if (!existing) {
    return false;
  }

  if (
    existing.committedTransactionId &&
    existing.committedTransactionId !== input.transactionId
  ) {
    return false;
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

  return true;
}
