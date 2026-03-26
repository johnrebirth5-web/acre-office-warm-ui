import { canCreateOfficeTransactions } from "@acre/auth";
import {
  getOfficeTransactionOwnerAssignment,
  previewCreateTransactionCommissionCalculator
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateOfficeTransactions(context.currentMembership)) {
    return NextResponse.json({ error: "Transaction create access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  try {
    const ownerAssignment = await getOfficeTransactionOwnerAssignment({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      officeId: context.currentOffice?.id ?? null
    });
    const requestedOwnerMembershipId =
      typeof body.ownerMembershipId === "string" ? body.ownerMembershipId.trim() : "";
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

    const preview = await previewCreateTransactionCommissionCalculator({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      ownerMembershipId,
      grossCommission: typeof body.grossCommission === "string" ? body.grossCommission : "",
      fees: Array.isArray(body.fees)
        ? body.fees.map((fee) => {
            const record = fee && typeof fee === "object" ? (fee as Record<string, unknown>) : {};

            return {
              feeType: typeof record.feeType === "string" ? record.feeType : "",
              rate: typeof record.rate === "string" ? record.rate : undefined,
              amount: typeof record.amount === "string" ? record.amount : undefined,
              selectedCalculationType:
                typeof record.selectedCalculationType === "string" ? record.selectedCalculationType : undefined,
              approvalStatus: typeof record.approvalStatus === "string" ? record.approvalStatus : undefined,
              notes: typeof record.notes === "string" ? record.notes : undefined
            };
          })
        : []
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
