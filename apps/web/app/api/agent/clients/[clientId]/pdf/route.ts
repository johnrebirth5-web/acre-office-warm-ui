import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { can } from "@acre/auth";
import { getFrontOfficeClientDetail } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import { FrontOfficeClientSummaryPdfDocument } from "./front-office-client-summary-pdf";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

export const runtime = "nodejs";

function formatGeneratedAtLabel(value: Date, timeZone?: string | null) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? undefined,
  });
}

function buildPdfFileName(fullName: string, generatedAt: Date) {
  const safeName =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client";
  const dateStamp = generatedAt.toISOString().slice(0, 10);

  return `${safeName}-client-summary-${dateStamp}.pdf`;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ clientId: string }> },
) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!can(context.currentMembership, "clients:view")) {
    return NextResponse.json(
      { error: "Client view access required." },
      { status: 403 },
    );
  }

  const { clientId } = await props.params;
  const snapshot = await getFrontOfficeClientDetail({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    clientId,
    timeZone: context.currentUser.timezone,
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const generatedAt = new Date();
  const agentLabel =
    `${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
    context.currentUser.email;
  const organizationLabel =
    context.currentOffice?.name ?? context.currentOrganization.name;
  const document = createElement(FrontOfficeClientSummaryPdfDocument, {
    snapshot,
    organizationLabel,
    agentLabel,
    generatedAtLabel: formatGeneratedAtLabel(
      generatedAt,
      context.currentUser.timezone,
    ),
  }) as ReactElement<DocumentProps>;
  const pdfBuffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${buildPdfFileName(
        snapshot.fullName,
        generatedAt,
      )}"`,
    },
  });
}
