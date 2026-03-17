import { canViewOfficeReports } from "@acre/auth";
import type { NextRequest } from "next/server";
import { listOfficeReportTransactionsForExport } from "@acre/db";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

function escapeCsvCell(value: string) {
  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const escaped = normalized.replaceAll("\"", "\"\"");

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export async function GET(request: NextRequest) {
  const sessionContext = await requireRequestOfficeSession(request);

  if (!sessionContext) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  if (!canViewOfficeReports(sessionContext.currentMembership)) {
    return new Response(JSON.stringify({ error: "Reports access required." }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") ?? undefined;
  const endDate = url.searchParams.get("endDate") ?? undefined;
  const officeFilterId = url.searchParams.get("officeId") ?? undefined;
  const ownerMembershipId = url.searchParams.get("ownerMembershipId") ?? undefined;
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const transactionStatus = url.searchParams.get("transactionStatus") ?? undefined;
  const transactionType = url.searchParams.get("transactionType") ?? undefined;
  const commissionPlanId = url.searchParams.get("commissionPlanId") ?? undefined;

  const rows = await listOfficeReportTransactionsForExport({
    organizationId: sessionContext.currentOrganization.id,
    viewerMembershipId: sessionContext.currentMembership.id,
    officeId: sessionContext.currentOffice?.id,
    officeFilterId,
    startDate,
    endDate,
    ownerMembershipId,
    teamId,
    transactionStatus,
    transactionType,
    commissionPlanId
  });

  const headers = [
    "transactionId",
    "title",
    "address",
    "city",
    "state",
    "zipCode",
    "type",
    "status",
    "representing",
    "owner",
    "primaryContact",
    "price",
    "grossCommission",
    "referralFee",
    "officeNet",
    "agentNet",
    "importantDate",
    "closingDate",
    "createdAt",
    "updatedAt"
  ];

  const csvBody = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.transactionId,
        row.title,
        row.address,
        row.city,
        row.state,
        row.zipCode,
        row.type,
        row.status,
        row.representing,
        row.owner,
        row.primaryContact,
        row.price,
        row.grossCommission,
        row.referralFee,
        row.officeNet,
        row.agentNet,
        row.importantDate,
        row.closingDate,
        row.createdAt,
        row.updatedAt
      ]
        .map((value) => escapeCsvCell(value))
        .join(",")
    )
  ].join("\n");

  const todayLabel = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csvBody}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"office-reports-${todayLabel}.csv\"`
    }
  });
}
