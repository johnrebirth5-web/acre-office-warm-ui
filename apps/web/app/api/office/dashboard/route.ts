import { isOfficeRole } from "@acre/auth";
import { officeTrainingLinks, officeUsefulLinks, officeWeeklyUpdates } from "@acre/backoffice";
import { getOfficeDashboardBusinessSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionAccess, getRequestSessionContext } from "../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!isOfficeRole(context.currentMembership.role)) {
    return NextResponse.json({ error: "Office access required." }, { status: 403 });
  }

  const businessSnapshot = await getOfficeDashboardBusinessSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id
  });

  return NextResponse.json({
    access: getSessionAccess(context),
    currentUser: context.currentUser,
    currentMembership: context.currentMembership,
    currentOrganization: context.currentOrganization,
    currentOffice: context.currentOffice,
    businessSnapshot,
    staticContent: {
      weeklyUpdates: officeWeeklyUpdates,
      usefulLinks: officeUsefulLinks,
      trainingLinks: officeTrainingLinks
    }
  });
}
