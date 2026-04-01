import Link from "next/link";
import { canManageOfficeSignatureTemplates } from "@acre/auth";
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

  return (
    <OfficeListPageShell className="office-signatures-page">
      <OfficeListPageHeader
        description="Manage reusable signature blueprints by category, delivery copy, recipient roles, and field placements."
        eyebrow="Documents"
        summary={
          <>
            <SummaryChip label="Templates" tone="accent" value={snapshot.summary.totalCount} />
            <SummaryChip label="Active" value={snapshot.summary.activeCount} />
            <Link className="office-button-secondary" href="/office/signatures">
              Back to signatures
            </Link>
          </>
        }
        title="Signature templates"
      />

      <SignatureTemplatesClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
