import Link from "next/link";
import {
  canExportOfficeSignatureReports,
  canManageOfficeSignatures,
  canManageOfficeSettings,
  canManageOfficeSignatureTemplates,
  canViewOfficeSignatures
} from "@acre/auth";
import { getOfficeSignaturesWorkspace } from "@acre/db";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeSignaturesClient } from "./signatures-client";

type OfficeSignaturesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
}

function buildExportHref(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim()) {
          query.append(key, item.trim());
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      query.set(key, value.trim());
    }
  }

  return `/api/office/signatures/export${query.size ? `?${query.toString()}` : ""}`;
}

export default async function OfficeSignaturesPage(props: OfficeSignaturesPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeSignatures(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const workspace = await getOfficeSignaturesWorkspace({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerEmail: context.currentUser.email,
    status: readSearchParamValue(searchParams.status),
    category: readSearchParamValue(searchParams.category),
    requestedByMembershipId: readSearchParamValue(searchParams.requestedByMembershipId),
    recipientQuery: readSearchParamValue(searchParams.recipientQuery),
    subjectMembershipId: readSearchParamValue(searchParams.subjectMembershipId)
  });
  const exportHref = buildExportHref(searchParams);
  const canManageTemplateLibrary = canManageOfficeSignatureTemplates(context.currentMembership);
  const canManageDriveSettings = canManageOfficeSettings(context.currentMembership) || canManageTemplateLibrary;
  const canExportReports = canExportOfficeSignatureReports(context.currentMembership);
  const canManageSignatures = canManageOfficeSignatures(context.currentMembership);

  return (
    <PageShell className="office-list-page office-signatures-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Requests" tone="accent" value={workspace.summary.totalCount} />
            <SummaryChip label="Pending" value={workspace.summary.pendingCount} />
            <SummaryChip label="Drive failures" value={workspace.summary.failedDriveCount} />
            {canManageTemplateLibrary ? <SummaryChip label="Templates" value={workspace.summary.templateCount} /> : null}
            {canExportReports ? (
              <Link className="office-button-secondary" href={exportHref}>
                Export CSV
              </Link>
            ) : null}
            {canManageTemplateLibrary ? (
              <Link className="office-button-secondary" href="/office/signatures/templates">
                Templates
              </Link>
            ) : null}
            {canManageDriveSettings ? (
              <Link className="office-button-secondary" href="/office/settings/signature-drive">
                Drive settings
              </Link>
            ) : null}
          </PageHeaderSummary>
        }
        description="Unified envelope tracking, signer visibility, Drive sync state, and template entry points from a single Back Office workspace."
        eyebrow="Documents"
        title="Signatures"
      />

      <OfficeSignaturesClient
        canManageSignatures={canManageSignatures}
        canManageDriveSettings={canManageDriveSettings}
        canManageTemplateLibrary={canManageTemplateLibrary}
        workspace={workspace}
      />
    </PageShell>
  );
}
