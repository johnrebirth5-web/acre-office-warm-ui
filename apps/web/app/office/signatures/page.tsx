import Link from "next/link";
import {
  canExportOfficeSignatureReports,
  canManageOfficeSignatures,
  canManageOfficeSettings,
  canManageOfficeSignatureTemplates,
  canViewOfficeSignatures
} from "@acre/auth";
import { getOfficeSignatureDriveSettingsSnapshot, getOfficeSignaturesWorkspace } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
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
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

  if (!canViewOfficeSignatures(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const canManageTemplateLibrary = canManageOfficeSignatureTemplates(context.currentMembership);
  const canManageDriveSettings = canManageOfficeSettings(context.currentMembership) || canManageTemplateLibrary;
  const canExportReports = canExportOfficeSignatureReports(context.currentMembership);
  const canManageSignatures = canManageOfficeSignatures(context.currentMembership);
  const [workspace, driveSnapshot] = await Promise.all([
    getOfficeSignaturesWorkspace({
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
    }),
    canManageDriveSettings
      ? getOfficeSignatureDriveSettingsSnapshot({
          organizationId: context.currentOrganization.id
        })
      : Promise.resolve(null)
  ]);
  const exportHref = buildExportHref(searchParams);
  const scopeLabel = context.currentOffice?.name ?? context.currentOrganization.name;

  return (
    <OfficeListPageShell className="office-signatures-page">
      <OfficeListPageHeader
        actions={
          <>
            {canExportReports ? (
              <Link className="office-button-secondary" href={exportHref}>
                {t((messages) => messages.officeSignatures.exportCsv)}
              </Link>
            ) : null}
            {canManageTemplateLibrary ? (
              <Link className="office-button-secondary" href="/office/signatures/templates">
                {t((messages) => messages.officeSignatures.templates)}
              </Link>
            ) : null}
            {canManageDriveSettings ? (
              <Link className="office-button-secondary" href="/office/settings/signature-drive">
                {t((messages) => messages.officeSignatures.driveSettings)}
              </Link>
            ) : null}
          </>
        }
        description={t((messages) => messages.officeSignatures.description)}
        eyebrow={t((messages) => messages.officeSignatures.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={scopeLabel} />
            <SummaryChip label={t((messages) => messages.officeSignatures.drafts)} tone="accent" value={workspace.summary.draftCount} />
            <SummaryChip label={t((messages) => messages.officeSignatures.needsFollowUp)} value={workspace.summary.pendingCount} />
            <SummaryChip label={t((messages) => messages.officeSignatures.driveFailures)} value={workspace.summary.failedDriveCount} />
            <SummaryChip
              label={t((messages) => messages.officeSignatures.directCreate)}
              value={workspace.createSupport.canStartNonTransactionDraft
                ? t((messages) => messages.officeSignatures.available)
                : t((messages) => messages.officeSignatures.comingSoon)}
            />
            {canManageTemplateLibrary ? <SummaryChip label={t((messages) => messages.officeSignatures.activeTemplates)} value={workspace.summary.activeTemplateCount} /> : null}
          </>
        }
        title={t((messages) => messages.officeSignatures.title)}
      />

      <OfficeSignaturesClient
        canManageSignatures={canManageSignatures}
        canManageDriveSettings={canManageDriveSettings}
        canManageTemplateLibrary={canManageTemplateLibrary}
        driveSnapshot={driveSnapshot}
        workspace={workspace}
      />
    </OfficeListPageShell>
  );
}
