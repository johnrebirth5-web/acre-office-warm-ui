import { can } from "@acre/auth";
import {
  frontOfficeDashboardActionEventTypes,
  frontOfficeDashboardActionKinds,
  recordFrontOfficeDashboardActionEvent,
  type FrontOfficeDashboardActionEventType,
  type FrontOfficeDashboardActionKind,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

const actionKindSet = new Set<string>(frontOfficeDashboardActionKinds);
const eventTypeSet = new Set<string>(frontOfficeDashboardActionEventTypes);

function readOptionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "dashboard:view")) {
    return NextResponse.json(
      { error: "Front Office dashboard access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body || Array.isArray(body)) {
    return NextResponse.json(
      { error: "A valid JSON body is required." },
      { status: 400 },
    );
  }

  const actionKind =
    typeof body.actionKind === "string" ? body.actionKind.trim() : "";
  const eventType =
    typeof body.eventType === "string" ? body.eventType.trim() : "";
  const sourceSurface =
    typeof body.sourceSurface === "string" ? body.sourceSurface.trim() : "";

  if (!actionKindSet.has(actionKind)) {
    return NextResponse.json(
      { error: "A valid dashboard action kind is required." },
      { status: 400 },
    );
  }

  if (!eventTypeSet.has(eventType)) {
    return NextResponse.json(
      { error: "A valid dashboard action event type is required." },
      { status: 400 },
    );
  }

  if (sourceSurface !== "agent_dashboard") {
    return NextResponse.json(
      { error: "A valid dashboard source surface is required." },
      { status: 400 },
    );
  }

  await recordFrontOfficeDashboardActionEvent({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    actionKind: actionKind as FrontOfficeDashboardActionKind,
    eventType: eventType as FrontOfficeDashboardActionEventType,
    clientId: readOptionalId(body.clientId),
    appointmentId: readOptionalId(body.appointmentId),
    listingId: readOptionalId(body.listingId),
  });

  return NextResponse.json({
    ok: true,
    sourceSurface: "agent_dashboard",
  });
}
