import { canManageOfficeLibrary, canViewOfficeLibrary } from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { getOfficeLibrarySnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
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
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });

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
    <OfficeListPageShell className="office-library-page">
      <OfficeListPageHeader
        description={t((messages) => messages.officeLibrary.description)}
        eyebrow={t((messages) => messages.officeLibrary.eyebrow)}
        summary={
          <>
            <SummaryChip label={t((messages) => messages.common.officeScope)} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={t((messages) => messages.officeLibrary.activeFiles)} tone="accent" value={snapshot.summary.totalDocuments} />
            <SummaryChip label={t((messages) => messages.officeLibrary.folders)} value={snapshot.summary.totalFolders} />
          </>
        }
        title={t((messages) => messages.officeLibrary.title)}
      />

      <OfficeLibraryClient
        canManageLibrary={canManageOfficeLibrary(context.currentMembership)}
        snapshot={snapshot}
      />
    </OfficeListPageShell>
  );
}
