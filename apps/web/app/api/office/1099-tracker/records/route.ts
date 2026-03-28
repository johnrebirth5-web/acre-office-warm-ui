import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099TrackerWorkspaceSnapshot, saveAgent1099PaymentRecords } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

type SaveRecordsRequestBody = {
  membershipId?: string;
  taxYear?: number | string;
  records?: Array<{
    id?: string;
    paymentDate?: string;
    paymentAmount?: string;
    memo?: string;
  }>;
};

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

export async function PUT(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as SaveRecordsRequestBody | null;

  if (!body?.membershipId?.trim()) {
    return NextResponse.json({ error: "membershipId is required." }, { status: 400 });
  }

  if (!Array.isArray(body.records)) {
    return NextResponse.json({ error: "records must be an array." }, { status: 400 });
  }

  try {
    const editor = await saveAgent1099PaymentRecords({
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
