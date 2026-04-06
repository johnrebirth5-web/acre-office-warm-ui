import Link from "next/link";
import { canManageOfficeSignatureTemplates, canManageOfficeSignatures } from "@acre/auth";
import { getOfficeSignatureTemplateLibrarySnapshot } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../../_components/office-list-page-template";
import { SignatureTemplatesClient } from "./signature-templates-client";

export default async function OfficeSignatureTemplatesPage() {
  const context = await requireOfficeSession();

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
            Back to signatures
          </Link>
        }
        description="Maintain the reusable signature library from one place, track which templates already have live drafts, and keep the library honest about the current transaction-PDF authoring model."
        eyebrow="Documents"
        summary={
          <>
            <SummaryChip label="Office scope" value={scopeLabel} />
            <SummaryChip label="Templates" tone="accent" value={snapshot.summary.totalCount} />
            <SummaryChip label="Active" value={snapshot.summary.activeCount} />
            <SummaryChip label="HR / finance / admin" value={snapshot.summary.nonTransactionCount} />
            <SummaryChip label="Generic category" value={snapshot.capabilities.supportsGenericTemplateCategory ? "Available" : "Schema pending"} />
            <SummaryChip label="Live drafts" value={snapshot.summary.templatesWithLiveDraftsCount} />
          </>
        }
        title="Signature templates"
      />

      <SignatureTemplatesClient canManageSignatures={canManageSignatures} snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
