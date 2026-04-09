import Link from "next/link";
import { canManageOfficeSignatureTemplates, canManageOfficeSignatures } from "@acre/auth";
import { getOfficeSignatureTemplateLibrarySnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { SignatureTemplatesClient } from "./signature-templates-client";

export default async function OfficeSignatureTemplatesPage() {
  const context = await requireOfficeSession();
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

  if (!canManageOfficeSignatureTemplates(context.currentMembership)) {
    redirect("/office/signatures");
  }

  const snapshot = await getOfficeSignatureTemplateLibrarySnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });
  const canManageSignatures = canManageOfficeSignatures(context.currentMembership);
  const scopeLabel = context.currentOffice?.name ?? context.currentOrganization.name;

  return (
    <OfficeListPageShell className="office-signatures-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary" href="/office/signatures">
            {t((messages) => messages.officeSignatureTemplates.backToSignatures)}
          </Link>
        }
        description={t((messages) => messages.officeSignatureTemplates.description)}
        eyebrow={t((messages) => messages.officeSignatureTemplates.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={scopeLabel} />
            <SummaryChip label={t((messages) => messages.officeSignatureTemplates.templates)} tone="accent" value={snapshot.summary.totalCount} />
            <SummaryChip label={t((messages) => messages.officeSignatureTemplates.active)} value={snapshot.summary.activeCount} />
            <SummaryChip label={t((messages) => messages.officeSignatureTemplates.nonTransaction)} value={snapshot.summary.nonTransactionCount} />
            <SummaryChip
              label={t((messages) => messages.officeSignatureTemplates.genericCategory)}
              value={snapshot.capabilities.supportsGenericTemplateCategory
                ? t((messages) => messages.officeSignatures.available)
                : t((messages) => messages.officeSignatureTemplates.schemaPending)}
            />
            <SummaryChip label={t((messages) => messages.officeSignatureTemplates.liveDrafts)} value={snapshot.summary.templatesWithLiveDraftsCount} />
          </>
        }
        title={t((messages) => messages.officeSignatureTemplates.title)}
      />

      <SignatureTemplatesClient canManageSignatures={canManageSignatures} snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
