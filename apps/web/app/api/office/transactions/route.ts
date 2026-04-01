import {
  canCreateOfficeTransactions,
  canManageOfficeTransactionStatus,
  canViewOfficeTransactions,
} from "@acre/auth";
import {
  commitFrontOfficeHandoffDraft,
  createTransaction,
  getOfficeTransactionIntakeSchema,
  getOfficeTransactionOwnerAssignment,
  linkContactToTransaction,
  listTransactions,
  prepareTransactionIntakeSubmission,
  type OfficeTransactionStatus,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";
import { isCreateTransactionStatusValue } from "../../../office/transactions/transaction-status-rules";

const transactionStatusOptions = [
  "All",
  "Opportunity",
  "Active",
  "Pending",
  "Closed",
  "Cancelled",
] as const;
const defaultTransactionsPage = 1;
const defaultTransactionsPageSize = 20;
const maxTransactionsPageSize = 100;

function applyCreateTransactionStatusRules(
  schema: Awaited<ReturnType<typeof getOfficeTransactionIntakeSchema>>,
) {
  return {
    ...schema,
    builtInFields: schema.builtInFields.map((field) => {
      if (field.fieldKey !== "transaction_status") {
        return field;
      }

      return {
        ...field,
        options: field.selectOptions
          .filter((option) => isCreateTransactionStatusValue(option.value))
          .map((option) => option.value),
        selectOptions: field.selectOptions.map((option) => ({
          ...option,
          isEnabled: isCreateTransactionStatusValue(option.value),
        })),
      };
    }),
  };
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number,
) {
  if (!value || !value.trim()) {
    return fallback;
  }

  const numeric = Number.parseInt(value, 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return null;
  }

  return max ? Math.min(numeric, max) : numeric;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canViewOfficeTransactions(context.currentMembership)) {
    return NextResponse.json(
      { error: "Transaction access required." },
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("q") ?? undefined;
  const status = searchParams.get("status") ?? "All";
  const ownerMembershipId = searchParams.get("ownerMembershipId") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const page = parsePositiveInteger(
    searchParams.get("page"),
    defaultTransactionsPage,
  );
  const pageSize = parsePositiveInteger(
    searchParams.get("pageSize"),
    defaultTransactionsPageSize,
    maxTransactionsPageSize,
  );

  if (page === null || pageSize === null) {
    return NextResponse.json(
      { error: "page and pageSize must be positive integers." },
      { status: 400 },
    );
  }

  if (
    !transactionStatusOptions.includes(
      status as (typeof transactionStatusOptions)[number],
    )
  ) {
    return NextResponse.json(
      { error: "Unsupported transaction status filter." },
      { status: 400 },
    );
  }

  const result = await listTransactions({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id,
    search,
    status: status === "All" ? "All" : (status as OfficeTransactionStatus),
    ownerMembershipId,
    teamId,
    type,
    startDate,
    endDate,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    return NextResponse.json(
      { error: "Transaction create access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  try {
    const canManageTransactionStatus = canManageOfficeTransactionStatus(
      context.currentMembership,
    );
    const schema = applyCreateTransactionStatusRules(
      await getOfficeTransactionIntakeSchema({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
      }),
    );
    const ownerAssignment = await getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
    });
    const submission = prepareTransactionIntakeSubmission({
      schema,
      payload: canManageTransactionStatus
        ? body
        : { ...body, transactionStatus: "pending" },
    });
    const statusField = schema.builtInFields.find(
      (field) => field.fieldKey === "transaction_status",
    );
    const requestedOwnerMembershipId =
      typeof body.ownerMembershipId === "string"
        ? body.ownerMembershipId.trim()
        : "";
    let ownerMembershipId = context.currentMembership.id;
    let transactionStatus = "pending";

    if (ownerAssignment.canSelectDifferentOwner) {
      const selectedOwner = ownerAssignment.options.find(
        (option) => option.id === requestedOwnerMembershipId,
      );

      if (!selectedOwner) {
        throw new Error("Select an agent owner before creating a transaction.");
      }

      ownerMembershipId = selectedOwner.id;
    } else if (
      requestedOwnerMembershipId &&
      requestedOwnerMembershipId !== context.currentMembership.id
    ) {
      throw new Error(
        "Sales users can only create transactions for themselves.",
      );
    }

    if (canManageTransactionStatus && statusField?.isVisible) {
      if (!isCreateTransactionStatusValue(submission.transactionStatus)) {
        throw new Error(
          "New transactions can only start as Pending, Closed, or Cancelled.",
        );
      }

      transactionStatus = submission.transactionStatus;
    }

    const transaction = await createTransaction({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id,
      ownerMembershipId,
      actorMembershipId: context.currentMembership.id,
      transactionType: submission.transactionType,
      transactionStatus,
      representing: submission.representing,
      address: submission.address,
      city: submission.city,
      state: submission.state,
      zipCode: submission.zipCode,
      transactionName: submission.transactionName,
      askingPrice: submission.askingPrice,
      purchasedPrice: submission.purchasedPrice,
      price: submission.price,
      buyerAgreementDate: submission.buyerAgreementDate,
      buyerExpirationDate: submission.buyerExpirationDate,
      acceptanceDate: submission.acceptanceDate,
      listingDate: submission.listingDate,
      listingExpirationDate: submission.listingExpirationDate,
      closingDate: submission.closingDate,
      moveInDate: submission.moveInDate,
      companyReferral:
        typeof body.companyReferral === "string"
          ? body.companyReferral
          : undefined,
      companyReferralEmployeeName:
        typeof body.companyReferralEmployeeName === "string"
          ? body.companyReferralEmployeeName
          : undefined,
      grossCommission:
        typeof body.grossCommission === "string"
          ? body.grossCommission
          : undefined,
      financeNotes:
        typeof body.financeNotes === "string" ? body.financeNotes : undefined,
      fees: Array.isArray(body.fees)
        ? body.fees.map((fee) => {
            const record =
              fee && typeof fee === "object"
                ? (fee as Record<string, unknown>)
                : {};

            return {
              feeType: typeof record.feeType === "string" ? record.feeType : "",
              rate: typeof record.rate === "string" ? record.rate : undefined,
              amount:
                typeof record.amount === "string" ? record.amount : undefined,
              selectedCalculationType:
                typeof record.selectedCalculationType === "string"
                  ? record.selectedCalculationType
                  : undefined,
              approvalStatus:
                typeof record.approvalStatus === "string"
                  ? record.approvalStatus
                  : undefined,
              notes:
                typeof record.notes === "string" ? record.notes : undefined,
            };
          })
        : undefined,
      additionalFields: submission.additionalFields,
    });

    const handoffDraftId =
      typeof body.handoffDraftId === "string" ? body.handoffDraftId.trim() : "";
    const frontOfficeClientId =
      typeof body.frontOfficeClientId === "string"
        ? body.frontOfficeClientId.trim()
        : "";

    if (frontOfficeClientId) {
      await linkContactToTransaction(
        context.currentOrganization.id,
        frontOfficeClientId,
        transaction.id,
        {
          actorMembershipId: context.currentMembership.id,
          isPrimary: true,
        },
      );
    }

    if (handoffDraftId) {
      await commitFrontOfficeHandoffDraft({
        organizationId: context.currentOrganization.id,
        handoffDraftId,
        transactionId: transaction.id,
      });
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create transaction.",
      },
      { status: 400 },
    );
  }
}
