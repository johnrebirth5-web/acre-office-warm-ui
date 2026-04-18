import { canAccessOffice1099Tracker } from "@acre/auth";
import {
  getOffice1099TrackerWorkspaceSnapshot,
  saveAgent1099PaymentRecords,
  type SessionMembershipContext
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { saveAgent1099PaymentRecordsBodySchema } from "./route.schema";

function readSearchParamValue(value: string | null) {
  return value?.trim() ? value.trim() : undefined;
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const snapshot = await getOffice1099TrackerWorkspaceSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    tab: "records",
    membershipId: readSearchParamValue(searchParams.get("membershipId")),
    taxYear: readSearchParamValue(searchParams.get("taxYear"))
  });

  return NextResponse.json({ snapshot });
}

type Office1099RecordsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  saveAgent1099PaymentRecords?: typeof saveAgent1099PaymentRecords;
};

export async function handleSaveOffice1099RecordsPut(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: Office1099RecordsRouteDependencies = {}
) {
  const parsedBody = await (dependencies.parseJsonBody ?? parseJsonBody)(
    request,
    saveAgent1099PaymentRecordsBodySchema,
    {
      error: "1099 tracker payload is invalid.",
      invalidJsonError: "1099 tracker request body must be valid JSON."
    }
  );

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const editor = await (dependencies.saveAgent1099PaymentRecords ?? saveAgent1099PaymentRecords)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId: body.membershipId,
      taxYear: body.taxYear ?? "",
      actorMembershipId: context.currentMembership.id,
      records: body.records.map((record) => ({
        ...(record.id?.trim() ? { id: record.id.trim() } : {}),
        paymentDate: record.paymentDate?.trim() ?? "",
        paymentAmount: record.paymentAmount?.trim() ?? "",
        memo: record.memo?.trim() ?? ""
      }))
    });

    return NextResponse.json({ editor });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save 1099 payment records."
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  return handleSaveOffice1099RecordsPut(request, context);
}
