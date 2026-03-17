import { canManageOfficeLibrary, canViewOfficeLibrary } from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { getOfficeLibrarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeLibraryClient } from "./office-library-client";

type OfficeLibraryPageProps = {
  searchParams?: Promise<{
    folderId?: string;
    documentId?: string;
    q?: string;
    category?: string;
    tag?: string;
    scope?: string;
  }>;
};

export default async function OfficeLibraryPage(props: OfficeLibraryPageProps) {
  const context = await requireOfficeSession();

  if (!canViewOfficeLibrary(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeLibrarySnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    folderId: searchParams.folderId,
    documentId: searchParams.documentId,
    q: searchParams.q,
    category: searchParams.category,
    tag: searchParams.tag,
    scope: searchParams.scope
  });

  return (
    <PageShell className="office-list-page office-library-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Active files" tone="accent" value={snapshot.summary.totalDocuments} />
            <SummaryChip label="Folders" value={snapshot.summary.totalFolders} />
          </PageHeaderSummary>
        }
        description="Internal company library for manuals, onboarding packets, legal PDFs, financial references, and office playbooks. PDF preview is inline when practical; all files remain downloadable."
        eyebrow="Company library"
        title="Company library"
      />

      <OfficeLibraryClient
        canManageLibrary={canManageOfficeLibrary(context.currentMembership)}
        snapshot={snapshot}
      />
    </PageShell>
  );
}
