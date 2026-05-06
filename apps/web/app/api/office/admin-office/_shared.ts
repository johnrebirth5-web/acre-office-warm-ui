import type { PermissionSubject } from "@acre/auth";
import { canManageAdminOffice, canViewAdminOffice } from "@acre/auth";
import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

type AdminOfficeAccessCheck = (subject: PermissionSubject) => boolean;

export type AdminOfficeApiContext = SessionMembershipContext;

export async function requireAdminOfficeApiContext(
  request: NextRequest,
  canAccess: AdminOfficeAccessCheck = canViewAdminOffice,
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return {
      context: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (!canAccess(context.currentMembership)) {
    return {
      context: null,
      response: NextResponse.json(
        { error: "Admin Office access required." },
        { status: 403 },
      ),
    };
  }

  return { context, response: null };
}

export function requireAdminOfficeManageContext(request: NextRequest) {
  return requireAdminOfficeApiContext(request, canManageAdminOffice);
}

export function buildAdminOfficeErrorResponse(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}
