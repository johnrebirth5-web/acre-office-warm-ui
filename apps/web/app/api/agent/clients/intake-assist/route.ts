import { canViewOfficeContacts } from "@acre/auth";
import { NextRequest } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import {
  handleFrontOfficeLeadIntakeAssistServerRoute,
} from "../../../../../lib/front-office-intake-assist-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  return handleFrontOfficeLeadIntakeAssistServerRoute(request, context, {
    canViewOfficeContacts,
  });
}
