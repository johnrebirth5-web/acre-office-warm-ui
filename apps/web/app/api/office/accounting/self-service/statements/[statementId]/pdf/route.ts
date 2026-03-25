import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getOfficeAgentPayoutStatementDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { AgentPayoutStatementPdfDocument } from "../../../../statements/[statementId]/agent-payout-statement-pdf";
import { getRequestSessionContext } from "../../../../../../../../lib/auth-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    statementId: string;
  }>;
};

function buildPdfFileName(agentLabel: string, periodStart: string, periodEnd: string) {
  const safeAgentLabel = agentLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
  return `${safeAgentLabel}-${periodStart}-to-${periodEnd}-statement.pdf`;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { statementId } = await params;
  const statement = await getOfficeAgentPayoutStatementDetail({
    organizationId: context.currentOrganization.id,
    statementId
  });

  if (!statement) {
    return NextResponse.json({ error: "Statement not found." }, { status: 404 });
  }

  if (statement.membershipId !== context.currentMembership.id) {
    return NextResponse.json({ error: "You can only download your own payout statements." }, { status: 403 });
  }

  const document = createElement(AgentPayoutStatementPdfDocument, { statement }) as ReactElement<DocumentProps>;
  const pdfBuffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildPdfFileName(statement.agentLabel, statement.periodStart, statement.periodEnd)}"`
    }
  });
}
