import { canExportOfficeSignatureReports, canViewOfficeSignatures } from "@acre/auth";
import type { NextRequest } from "next/server";
import { getOfficeSignatureExportPayload } from "@acre/db";
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

  if (!canViewOfficeSignatures(sessionContext.currentMembership) || !canExportOfficeSignatureReports(sessionContext.currentMembership)) {
    return new Response(JSON.stringify({ error: "Signature export access required." }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  const url = new URL(request.url);
  const payload = await getOfficeSignatureExportPayload({
    organizationId: sessionContext.currentOrganization.id,
    officeId: sessionContext.currentOffice?.id ?? null,
    viewerMembershipId: sessionContext.currentMembership.id,
    viewerRole: sessionContext.currentMembership.role,
    viewerEmail: sessionContext.currentUser.email,
    status: url.searchParams.get("status"),
    category: url.searchParams.get("category"),
    requestedByMembershipId: url.searchParams.get("requestedByMembershipId"),
    recipientQuery: url.searchParams.get("recipientQuery"),
    subjectMembershipId: url.searchParams.get("subjectMembershipId")
  });

  const headers = payload.columns.map((column) => column.label);
  const csvBody = [
    headers.join(","),
    ...payload.rows.map((row) =>
      payload.columns
        .map((column) => row[column.key] ?? "")
        .map((value) => escapeCsvCell(value))
        .join(",")
    )
  ].join("\n");
  const todayLabel = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${csvBody}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"office-signatures-${todayLabel}.csv\"`
    }
  });
}
