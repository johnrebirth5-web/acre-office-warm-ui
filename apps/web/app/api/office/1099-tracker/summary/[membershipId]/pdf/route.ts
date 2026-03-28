import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099SummaryDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { Agent1099SummaryPdfDocument } from "../agent-1099-summary-pdf";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

function buildPdfFileName(displayName: string, taxYear: number) {
  const safeDisplayName = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
  return `${safeDisplayName}-1099-summary-${taxYear}.pdf`;
}

function readSearchParamValue(value: string | null) {
  return value?.trim() ? value.trim() : undefined;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    return NextResponse.json({ error: "1099 Tracker access required." }, { status: 403 });
  }

  const { membershipId } = await params;
  const detail = await getOffice1099SummaryDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId,
    taxYear: readSearchParamValue(request.nextUrl.searchParams.get("taxYear")) ?? ""
  });

  if (!detail) {
    return NextResponse.json({ error: "1099 summary detail not found." }, { status: 404 });
  }

  const document = createElement(Agent1099SummaryPdfDocument, {
    detail,
    organizationName: context.currentOrganization.name,
    officeName: context.currentOffice?.name ?? context.currentOrganization.name
  }) as ReactElement<DocumentProps>;
  const pdfBuffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildPdfFileName(detail.displayName, detail.taxYear)}"`
    }
  });
}
