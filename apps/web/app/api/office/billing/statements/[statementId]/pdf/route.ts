import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { canViewOfficeAgentBilling } from "@acre/auth";
import { getOfficeBillingSnapshot } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { BillingStatementPdfDocument } from "../billing-statement-pdf";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

function formatGeneratedAtLabel(value: Date, timeZone?: string | null) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? undefined
  });
}

function buildPdfFileName(membershipLabel: string, statementId: string) {
  const safeMembershipLabel =
    membershipLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "member";

  return `${safeMembershipLabel}-billing-statement-${statementId}.pdf`;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewOfficeAgentBilling(context.currentMembership)) {
    return NextResponse.json({ error: "Billing access required." }, { status: 403 });
  }

  const { statementId } = await params;
  const snapshot = await getOfficeBillingSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Billing profile not found." }, { status: 404 });
  }

  const statement = snapshot.statements.find((entry) => entry.id === statementId);

  if (!statement) {
    return NextResponse.json({ error: "Statement not found." }, { status: 404 });
  }

  const statementLedgerRows = snapshot.ledgerRows.filter((row) => row.statementPeriodId === statementId);
  const generatedAt = new Date();
  const membershipLabel = `${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() || context.currentUser.email;
  const organizationLabel = context.currentOffice?.name ?? context.currentOrganization.name;
  const document = createElement(BillingStatementPdfDocument, {
    organizationLabel,
    membershipLabel,
    generatedAtLabel: formatGeneratedAtLabel(generatedAt, context.currentUser.timezone),
    statement,
    ledgerRows: statementLedgerRows
  }) as ReactElement<DocumentProps>;
  const pdfBuffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildPdfFileName(membershipLabel, statementId)}"`,
      "Cache-Control": "private, no-store, max-age=0"
    }
  });
}
