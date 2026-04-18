import { canCreateOfficeTransactions } from "@acre/auth";
import {
  getOfficeTransactionOwnerAssignment,
  type SessionMembershipContext,
  previewCreateTransactionCommissionCalculator
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { createOfficeTransactionCommissionPreviewBodySchema } from "./route.schema";

type OfficeTransactionCommissionPreviewRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  getOfficeTransactionOwnerAssignment?: typeof getOfficeTransactionOwnerAssignment;
  previewCreateTransactionCommissionCalculator?: typeof previewCreateTransactionCommissionCalculator;
};

export async function handleCreateOfficeTransactionCommissionPreviewPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeTransactionCommissionPreviewRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeTransactionCommissionPreviewBodySchema, {
    error: "Commission preview payload is invalid.",
    invalidJsonError: "Commission preview request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const ownerAssignment = await (
      dependencies.getOfficeTransactionOwnerAssignment ??
      getOfficeTransactionOwnerAssignment
    )({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    });
    const requestedOwnerMembershipId = body.ownerMembershipId?.trim() ?? "";
    let ownerMembershipId = context.currentMembership.id;

    if (ownerAssignment.canSelectDifferentOwner) {
      const selectedOwner = ownerAssignment.options.find((option) => option.id === requestedOwnerMembershipId);

      if (!selectedOwner) {
        throw new Error("Select an agent owner before calculating commission.");
      }

      ownerMembershipId = selectedOwner.id;
    } else if (requestedOwnerMembershipId && requestedOwnerMembershipId !== context.currentMembership.id) {
      throw new Error("Sales users can only create transactions for themselves.");
    }

    const preview = await (
      dependencies.previewCreateTransactionCommissionCalculator ??
      previewCreateTransactionCommissionCalculator
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      ownerMembershipId,
      grossCommission: body.grossCommission ?? "",
      fees:
        body.fees?.map((fee) => ({
          feeType: fee.feeType ?? "",
          rate: fee.rate ?? undefined,
          amount: fee.amount ?? undefined,
          selectedCalculationType: fee.selectedCalculationType ?? undefined,
          approvalStatus: fee.approvalStatus ?? undefined,
          notes: fee.notes ?? undefined
        })) ?? []
    });

    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to preview transaction commission."
      },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction create access required." }, { status: 403 });
  }

  return handleCreateOfficeTransactionCommissionPreviewPost(request, context);
}
