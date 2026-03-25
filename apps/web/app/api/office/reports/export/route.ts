import { canViewOfficeReports } from "@acre/auth";
import type { NextRequest } from "next/server";
import { getOfficeTransactionReportsWorkspace } from "@acre/db";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

function escapeCsvCell(value: string) {
  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const escaped = normalized.replaceAll("\"", "\"\"");

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function readValueParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

function readArrayParam(searchParams: URLSearchParams, key: string) {
  return Array.from(
    new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
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
  const workspace = await getOfficeTransactionReportsWorkspace({
    organizationId: sessionContext.currentOrganization.id,
    viewerMembershipId: sessionContext.currentMembership.id,
    officeId: sessionContext.currentOffice?.id ?? null,
    ownerMembershipId: readValueParam(url.searchParams, "ownerMembershipId"),
    createdAtOperator: readValueParam(url.searchParams, "createdAtOperator"),
    createdAtValue: readValueParam(url.searchParams, "createdAtValue"),
    createdAtFrom: readValueParam(url.searchParams, "createdAtFrom"),
    createdAtTo: readValueParam(url.searchParams, "createdAtTo"),
    buyerTenant: readValueParam(url.searchParams, "buyerTenant"),
    closingMoveInOperator: readValueParam(url.searchParams, "closingMoveInOperator"),
    closingMoveInValue: readValueParam(url.searchParams, "closingMoveInValue"),
    closingMoveInFrom: readValueParam(url.searchParams, "closingMoveInFrom"),
    closingMoveInTo: readValueParam(url.searchParams, "closingMoveInTo"),
    commissionOperator: readValueParam(url.searchParams, "commissionOperator"),
    commissionValue: readValueParam(url.searchParams, "commissionValue"),
    commissionMin: readValueParam(url.searchParams, "commissionMin"),
    commissionMax: readValueParam(url.searchParams, "commissionMax"),
    askingPriceOperator: readValueParam(url.searchParams, "askingPriceOperator"),
    askingPriceValue: readValueParam(url.searchParams, "askingPriceValue"),
    askingPriceMin: readValueParam(url.searchParams, "askingPriceMin"),
    askingPriceMax: readValueParam(url.searchParams, "askingPriceMax"),
    purchasedPriceOperator: readValueParam(url.searchParams, "purchasedPriceOperator"),
    purchasedPriceValue: readValueParam(url.searchParams, "purchasedPriceValue"),
    purchasedPriceMin: readValueParam(url.searchParams, "purchasedPriceMin"),
    purchasedPriceMax: readValueParam(url.searchParams, "purchasedPriceMax"),
    transactionStatuses: readArrayParam(url.searchParams, "transactionStatuses"),
    invoiceNumber: readValueParam(url.searchParams, "invoiceNumber"),
    departmentIds: readArrayParam(url.searchParams, "departmentIds"),
    teamLeaderMembershipIds: readArrayParam(url.searchParams, "teamLeaderMembershipIds"),
    transactionTypes: readArrayParam(url.searchParams, "transactionTypes"),
    representingSides: readArrayParam(url.searchParams, "representingSides"),
    layouts: readArrayParam(url.searchParams, "layouts"),
    companyReferral: readValueParam(url.searchParams, "companyReferral"),
    sortBy: readValueParam(url.searchParams, "sortBy"),
    sortDirection: readValueParam(url.searchParams, "sortDirection")
  });

  const headers = workspace.columns.map((column) => column.label);

  const csvBody = [
    headers.join(","),
    ...workspace.rows.map((row) =>
      workspace.columns.map((column) => row[column.key] ?? "")
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
