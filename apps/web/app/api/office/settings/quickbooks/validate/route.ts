import { canManageOfficeSettings } from "@acre/auth";
import {
  validateOrganizationQuickBooksConnection,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "../../../../../../lib/with-permission";

type QuickBooksValidateRouteDependencies = {
  validateOrganizationQuickBooksConnection?: typeof validateOrganizationQuickBooksConnection;
};

export async function handleQuickBooksValidatePost(
  context: SessionMembershipContext,
  dependencies: QuickBooksValidateRouteDependencies = {},
) {
  try {
    const snapshot = await (
      dependencies.validateOrganizationQuickBooksConnection ??
      validateOrganizationQuickBooksConnection
    )({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate QuickBooks connection.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => handleQuickBooksValidatePost(context),
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
