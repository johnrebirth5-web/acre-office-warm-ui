import { canManageOfficeSettings } from "@acre/auth";
import {
  deleteOrganizationQuickBooksConnection,
  getOfficeQuickBooksSettingsSnapshot,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "../../../../../lib/with-permission";

type QuickBooksSettingsRouteDependencies = {
  deleteOrganizationQuickBooksConnection?: typeof deleteOrganizationQuickBooksConnection;
};

export async function handleQuickBooksSettingsDelete(
  context: SessionMembershipContext,
  dependencies: QuickBooksSettingsRouteDependencies = {},
) {
  try {
    const snapshot = await (
      dependencies.deleteOrganizationQuickBooksConnection ??
      deleteOrganizationQuickBooksConnection
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
            : "Failed to disconnect QuickBooks.",
      },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => {
      const snapshot = await getOfficeQuickBooksSettingsSnapshot({
        organizationId: context.currentOrganization.id,
      });

      return NextResponse.json({ snapshot });
    },
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}

export async function DELETE(request: NextRequest) {
  return withPermission(
    request,
    canManageOfficeSettings,
    async (context) => handleQuickBooksSettingsDelete(context),
    {
      forbiddenMessage: "Settings management permission required.",
    },
  );
}
