import type { SessionMembershipContext } from "@acre/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

function isOfficeAdminRole(context: SessionMembershipContext | null) {
  return context?.currentMembership.role === "office_admin";
}

export async function requireOfficeAdminRequestContext(request: NextRequest) {
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

  if (!isOfficeAdminRole(context)) {
    return {
      context: null,
      response: NextResponse.json(
        { error: "Only office admins can manage resources." },
        { status: 403 },
      ),
    };
  }

  return {
    context,
    response: null,
  };
}
