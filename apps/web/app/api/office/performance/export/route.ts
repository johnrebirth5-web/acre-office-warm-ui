import { canViewOfficeReports } from "@acre/auth";
import type { NextRequest } from "next/server";
import { getOfficePerformanceWorkspace } from "@acre/db";
import { requireRequestOfficeSession } from "../../../../../lib/auth-session";

function escapeCsvCell(value: string) {
  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const escaped = normalized.replaceAll("\"", "\"\"");

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function readValueParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
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
  const workspace = await getOfficePerformanceWorkspace({
    organizationId: sessionContext.currentOrganization.id,
    viewerMembershipId: sessionContext.currentMembership.id,
    officeId: sessionContext.currentOffice?.id ?? null,
    period: readValueParam(url.searchParams, "period"),
    company: readValueParam(url.searchParams, "company"),
    year: readValueParam(url.searchParams, "year"),
    month: readValueParam(url.searchParams, "month"),
    quarter: readValueParam(url.searchParams, "quarter"),
    yearStart: readValueParam(url.searchParams, "yearStart"),
    yearEnd: readValueParam(url.searchParams, "yearEnd")
  });

  if (!workspace.filters.canExport) {
    return new Response(JSON.stringify({ error: "Team or company performance access is required for export." }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  const headers = ["Name", "Role", ...workspace.table.columns.map((column) => column.label)];
  const csvBody = [
    headers.join(","),
    ...workspace.table.rows.map((row) =>
      [row.name, row.secondaryLabel, ...workspace.table.columns.map((column) => row.cellLabels[column.key] ?? "$0")]
        .map((value) => escapeCsvCell(value))
        .join(",")
    )
  ].join("\n");
  const todayLabel = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csvBody}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"office-performance-${todayLabel}.csv\"`
    }
  });
}
