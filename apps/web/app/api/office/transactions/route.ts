import {
  canCreateOfficeTransactions,
  canManageOfficeTransactionStatus,
  canViewOfficeTransactions,
} from "@acre/auth";
import {
  commitFrontOfficeHandoffDraft,
  createTransaction,
  getFrontOfficeHandoffPrefill,
  getOfficeTransactionIntakeSchema,
  getOfficeTransactionOwnerAssignment,
  linkContactToTransaction,
  listTransactions,
  prepareTransactionIntakeSubmission,
  type OfficeTransactionStatus,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../lib/request-origin";
import {
  appendOperationalEmailWarning,
  buildOperationalEmailActorName,
  captureOperationalEmailWarning,
  sendAgentTransactionCreatedOperationalEmail,
} from "../../../../lib/operational-email";
import {
  parseAllowedString,
  parsePositiveInteger,
} from "../../../../lib/validate";
import { isCreateTransactionStatusValue } from "../../../office/transactions/transaction-status-rules";
import { createOfficeTransactionBodySchema } from "./route.schema";

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
const invalidTransactionRequestError = "Invalid transaction request.";

function buildHandoffPrefillError(
  handoffPrefill: Awaited<ReturnType<typeof getFrontOfficeHandoffPrefill>>,
) {
  switch (handoffPrefill.kind) {
    case "missing":
      return {
        error:
          "This Front Office handoff is no longer available from your current scope. Reopen the create flow from the client dossier before creating a Back Office transaction.",
        status: 404,
      };
    case "canceled":
      return {
        error:
          "This Front Office handoff is no longer active. Reconfirm the client dossier before starting a new Back Office transaction.",
        status: 409,
      };
    case "unsupported_target":
      return {
        error:
          "This Front Office handoff points to another workflow, not the Back Office transaction create flow. Continue from the client dossier instead.",
        status: 409,
      };
    case "committed":
      return {
        error: handoffPrefill.committedTransactionHref
          ? "This Front Office handoff has already been committed. Open the existing Back Office transaction instead of creating another one from this handoff."
          : "This Front Office handoff has already been committed. Review the client dossier or transaction list before creating anything new.",
        status: 409,
      };
    case "submitting":
      return {
        error:
          "A Back Office create request is already finalizing this handoff. Wait a moment, reload, and only retry if the handoff still shows as available.",
        status: 409,
      };
    default:
      return {
        error: "This Front Office handoff cannot be used for Back Office create.",
        status: 409,
      };
  }
}

function buildHandoffClaimError(
  result: Awaited<ReturnType<typeof commitFrontOfficeHandoffDraft>>,
) {
  switch (result.reason) {
    case "missing":
      return {
        error:
          "This Front Office handoff could not be claimed for create because it is no longer available.",
        status: 404,
      };
    case "unsupported_target":
      return {
        error:
          "This Front Office handoff is routed to another workflow and cannot be committed into a Back Office transaction.",
        status: 409,
      };
    case "canceled":
      return {
        error:
          "This Front Office handoff was canceled before create could begin. Reconfirm the dossier before trying again.",
        status: 409,
      };
    case "already_committed":
    case "committed_to_other_transaction":
      return {
        error:
          "This Front Office handoff has already been committed to a Back Office transaction. Reopen the existing record instead of creating a duplicate.",
        status: 409,
      };
    case "submission_in_progress":
      return {
        error:
          "Another Back Office create request is already using this handoff. Wait a moment, reload, and retry only if the handoff becomes available again.",
        status: 409,
      };
    case "claim_required":
    case "claim_mismatch":
    default:
      return {
        error:
          "This Front Office handoff could not be secured for create. Reload the page and try again from the handoff entry point.",
        status: 409,
      };
  }
}

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

type CreateOfficeTransactionsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  getOfficeTransactionIntakeSchema?: typeof getOfficeTransactionIntakeSchema;
  getOfficeTransactionOwnerAssignment?: typeof getOfficeTransactionOwnerAssignment;
  getFrontOfficeHandoffPrefill?: typeof getFrontOfficeHandoffPrefill;
  commitFrontOfficeHandoffDraft?: typeof commitFrontOfficeHandoffDraft;
  prepareTransactionIntakeSubmission?: typeof prepareTransactionIntakeSubmission;
  createTransaction?: typeof createTransaction;
  linkContactToTransaction?: typeof linkContactToTransaction;
  sendAgentTransactionCreatedOperationalEmail?: typeof sendAgentTransactionCreatedOperationalEmail;
};

async function sendAgentCreatedTransactionReminder(input: {
  request: NextRequest;
  context: SessionMembershipContext;
  transaction: Awaited<ReturnType<typeof createTransaction>>;
  dependencies: CreateOfficeTransactionsRouteDependencies;
}) {
  if (input.context.currentMembership.role !== "agent") {
    return null;
  }

  const sendReminder =
    input.dependencies.sendAgentTransactionCreatedOperationalEmail ??
    sendAgentTransactionCreatedOperationalEmail;

  return captureOperationalEmailWarning("agent transaction created", () =>
    sendReminder({
      organizationId: input.context.currentOrganization.id,
      baseUrl: getAppBaseUrl(input.request),
      transaction: input.transaction,
      actorName: buildOperationalEmailActorName(input.context),
      actorEmail: input.context.currentUser.email,
    })
  );
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
  const status = parseAllowedString(
    searchParams.get("status"),
    transactionStatusOptions,
    "All",
  );
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

  if (page === null || pageSize === null || status === null) {
    return NextResponse.json(
      { error: invalidTransactionRequestError },
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

export async function handleCreateOfficeTransactionsPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: CreateOfficeTransactionsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeTransactionBodySchema, {
    error: "Transaction create payload is invalid.",
    invalidJsonError: "Transaction create request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  const handoffDraftId =
    typeof body.handoffDraftId === "string" ? body.handoffDraftId.trim() : "";
  const allowIncompleteHandoffPrefill =
    body.acknowledgeIncompleteHandoffPrefill === true;
  let handoffClaimToken = "";
  let linkedFrontOfficeClientId =
    typeof body.frontOfficeClientId === "string"
      ? body.frontOfficeClientId.trim()
      : "";

  try {
    const canManageTransactionStatus = canManageOfficeTransactionStatus(
      context.currentMembership,
    );
    const schema = applyCreateTransactionStatusRules(
      await (
        dependencies.getOfficeTransactionIntakeSchema ??
        getOfficeTransactionIntakeSchema
      )({
        organizationId: context.currentOrganization.id,
        officeId: context.currentOffice?.id ?? null,
      }),
    );
    const ownerAssignment = await (
      dependencies.getOfficeTransactionOwnerAssignment ??
      getOfficeTransactionOwnerAssignment
    )({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null,
    });
    if (handoffDraftId) {
      const handoffPrefill = await (
        dependencies.getFrontOfficeHandoffPrefill ??
        getFrontOfficeHandoffPrefill
      )({
        organizationId: context.currentOrganization.id,
        handoffDraftId,
        officeId: context.currentOffice?.id ?? null,
      });

      if (handoffPrefill.kind !== "available") {
        const handoffError = buildHandoffPrefillError(handoffPrefill);

        return NextResponse.json(
          { error: handoffError.error },
          { status: handoffError.status },
        );
      }

      if (
        handoffPrefill.requiresAcknowledgement &&
        !allowIncompleteHandoffPrefill
      ) {
        const issueLabels = handoffPrefill.issues
          .map((issue) => issue.label)
          .join(", ");

        return NextResponse.json(
          {
            error: issueLabels
              ? `Review the Front Office handoff warnings before creating the Back Office transaction. Confirm these items first: ${issueLabels}.`
              : "Review the Front Office handoff warnings before creating the Back Office transaction.",
          },
          { status: 409 },
        );
      }

      linkedFrontOfficeClientId = handoffPrefill.clientId;

      const claimResult = await (
        dependencies.commitFrontOfficeHandoffDraft ??
        commitFrontOfficeHandoffDraft
      )({
        organizationId: context.currentOrganization.id,
        handoffDraftId,
        actorMembershipId: context.currentMembership.id,
        mode: "claim",
      });

      if (!claimResult.ok) {
        const claimError = buildHandoffClaimError(claimResult);

        return NextResponse.json(
          { error: claimError.error },
          { status: claimError.status },
        );
      }

      handoffClaimToken = claimResult.claimToken ?? "";
    }

    let submission: ReturnType<typeof prepareTransactionIntakeSubmission>;

    try {
      submission = (
        dependencies.prepareTransactionIntakeSubmission ??
        prepareTransactionIntakeSubmission
      )({
        schema,
        payload: canManageTransactionStatus
          ? body
          : { ...body, transactionStatus: "pending" },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : invalidTransactionRequestError,
        },
        { status: 400 },
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: invalidTransactionRequestError },
        { status: 400 },
      );
    }

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
        return NextResponse.json(
          { error: invalidTransactionRequestError },
          { status: 400 },
        );
      }

      ownerMembershipId = selectedOwner.id;
    } else if (
      requestedOwnerMembershipId &&
      requestedOwnerMembershipId !== context.currentMembership.id
    ) {
      return NextResponse.json(
        { error: invalidTransactionRequestError },
        { status: 400 },
      );
    }

    if (canManageTransactionStatus && statusField?.isVisible) {
      if (!isCreateTransactionStatusValue(submission.transactionStatus)) {
        return NextResponse.json(
          { error: invalidTransactionRequestError },
          { status: 400 },
        );
      }

      transactionStatus = submission.transactionStatus;
    }

    const transaction = await (
      dependencies.createTransaction ?? createTransaction
    )({
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
      fees: body.fees?.map((fee) => ({
        feeType: fee.feeType ?? "",
        rate: fee.rate ?? undefined,
        amount: fee.amount ?? undefined,
        selectedCalculationType: fee.selectedCalculationType ?? undefined,
        approvalStatus: fee.approvalStatus ?? undefined,
        notes: fee.notes ?? undefined,
      })),
      additionalFields: submission.additionalFields,
    });

    if (linkedFrontOfficeClientId) {
      await (
        dependencies.linkContactToTransaction ?? linkContactToTransaction
      )(
        context.currentOrganization.id,
        linkedFrontOfficeClientId,
        transaction.id,
        {
          actorMembershipId: context.currentMembership.id,
          isPrimary: true,
        },
      );
    }

    if (handoffDraftId) {
      const handoffCommitResult = await (
        dependencies.commitFrontOfficeHandoffDraft ??
        commitFrontOfficeHandoffDraft
      )({
        organizationId: context.currentOrganization.id,
        handoffDraftId,
        transactionId: transaction.id,
        claimToken: handoffClaimToken,
        mode: "commit",
      });

      const handoffCleanupResult =
        !handoffCommitResult.ok && handoffClaimToken
          ? await (
              dependencies.commitFrontOfficeHandoffDraft ??
              commitFrontOfficeHandoffDraft
            )({
              organizationId: context.currentOrganization.id,
              handoffDraftId,
              claimToken: handoffClaimToken,
              mode: "release",
            }).catch(() => null)
          : null;
      const emailWarning = await sendAgentCreatedTransactionReminder({
        request,
        context,
        transaction,
        dependencies,
      });

      return NextResponse.json(
        appendOperationalEmailWarning({
          transaction,
          handoff:
            handoffCommitResult.ok
              ? {
                  ok: true,
                  reason: handoffCommitResult.reason,
                }
              : {
                  ok: false,
                  reason: handoffCommitResult.reason,
                  warning:
                    "The Back Office transaction was created, but the Front Office handoff did not finalize cleanly. Review the client dossier and transaction record before retrying the handoff.",
                  cleanup: handoffCleanupResult
                    ? {
                        attempted: true,
                        ok: handoffCleanupResult.ok,
                        reason: handoffCleanupResult.reason,
                      }
                    : {
                        attempted: false,
                        ok: false,
                        reason: "not_attempted",
                      },
                },
        }, emailWarning),
        { status: 201 },
      );
    }

    const emailWarning = await sendAgentCreatedTransactionReminder({
      request,
      context,
      transaction,
      dependencies,
    });

    return NextResponse.json(appendOperationalEmailWarning({ transaction }, emailWarning), { status: 201 });
  } catch {
    if (handoffDraftId && handoffClaimToken) {
      await (
        dependencies.commitFrontOfficeHandoffDraft ??
        commitFrontOfficeHandoffDraft
      )({
        organizationId: context.currentOrganization.id,
        handoffDraftId,
        claimToken: handoffClaimToken,
        mode: "release",
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        error: "Failed to create transaction.",
      },
      { status: 400 },
    );
  }
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

  return handleCreateOfficeTransactionsPost(request, context);
}
