import Link from "next/link";
import { canManageOfficeSignatureTemplates } from "@acre/auth";
import { getOfficeSignatureTemplateLibrarySnapshot } from "@acre/db";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
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

  return (
    <PageShell className="office-list-page office-signatures-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Templates" tone="accent" value={snapshot.summary.totalCount} />
            <SummaryChip label="Active" value={snapshot.summary.activeCount} />
            <Link className="office-button-secondary" href="/office/signatures">
              Back to signatures
            </Link>
          </PageHeaderSummary>
        }
        description="Manage reusable signature blueprints by category, delivery copy, recipient roles, and field placements."
        eyebrow="Documents"
        title="Signature templates"
      />

      <SignatureTemplatesClient snapshot={snapshot} />
    </PageShell>
  );
}
