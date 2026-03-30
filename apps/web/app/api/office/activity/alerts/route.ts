import {
  canAccessAccountActivity,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import { getOfficeOperationalAlertsSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

export async function GET(request: NextRequest) {
  const context = await requireRequestOfficeSession(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessAccountActivity(context.currentMembership)) {
    return NextResponse.json({ error: "Activity access required." }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const snapshot = await getOfficeOperationalAlertsSnapshot({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      currentMembershipId: context.currentMembership.id,
      canReviewTasks: canReviewOfficeTasks(context.currentMembership),
      canSecondaryReviewTasks: canSecondaryReviewOfficeTasks(context.currentMembership),
      objectType: searchParams.get("objectType") ?? undefined,
      alertSection: searchParams.get("alertSection") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined
    });

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load operational alerts."
      },
      {
        status: 500
      }
    );
  }
}
