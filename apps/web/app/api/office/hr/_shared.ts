import type { PermissionSubject } from "@acre/auth";
import { canManageOfficeHr, canViewOfficeHr } from "@acre/auth";
import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

type HrAccessCheck = (subject: PermissionSubject) => boolean;

export type OfficeHrApiContext = SessionMembershipContext;

export async function requireOfficeHrApiContext(
  request: NextRequest,
  canAccess: HrAccessCheck = canViewOfficeHr,
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
        { error: "HR access required." },
        { status: 403 },
      ),
    };
  }

  return { context, response: null };
}

export function requireOfficeHrManageContext(request: NextRequest) {
  return requireOfficeHrApiContext(request, canManageOfficeHr);
}

export function buildOfficeHrErrorResponse(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}
