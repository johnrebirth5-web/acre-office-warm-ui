import { can } from "@acre/auth";
import {
  frontOfficeVendorInteractionActions,
  recordFrontOfficeResourceOpen,
  recordFrontOfficeVendorClick,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../lib/auth-session";

type ResourceInteractionRequest =
  | {
      type: "resource_open";
      resourceId: string;
    }
  | {
      type: "vendor_click";
      vendorId: string;
      action: (typeof frontOfficeVendorInteractionActions)[number];
    };

function isResourceInteractionRequest(
  value: unknown,
): value is ResourceInteractionRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    candidate.type === "resource_open" &&
    typeof candidate.resourceId === "string" &&
    candidate.resourceId.trim()
  ) {
    return true;
  }

  if (
    candidate.type === "vendor_click" &&
    typeof candidate.vendorId === "string" &&
    candidate.vendorId.trim() &&
    typeof candidate.action === "string" &&
    frontOfficeVendorInteractionActions.includes(
      candidate.action as (typeof frontOfficeVendorInteractionActions)[number],
    )
  ) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "resources:view")) {
    return NextResponse.json(
      { error: "Resource access required." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!isResourceInteractionRequest(body)) {
    return NextResponse.json(
      { error: "Invalid resource interaction payload." },
      { status: 400 },
    );
  }

  try {
    if (body.type === "resource_open") {
      await recordFrontOfficeResourceOpen({
        organizationId: context.currentOrganization.id,
        membershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
        resourceId: body.resourceId,
      });
    } else {
      await recordFrontOfficeVendorClick({
        organizationId: context.currentOrganization.id,
        membershipId: context.currentMembership.id,
        officeId: context.currentOffice?.id ?? null,
        vendorId: body.vendorId,
        action: body.action,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record interaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
