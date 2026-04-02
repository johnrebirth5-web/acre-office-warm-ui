import Link from "next/link";
import { canAccessOfficeMail } from "@acre/auth";
import { getOfficeMailWorkspace } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeMailClient } from "./mail-client";

type OfficeMailPageProps = {
  searchParams?: Promise<{
    q?: string;
    view?: string;
    threadId?: string;
    mode?: string;
  }>;
};

export default async function OfficeMailPage(props: OfficeMailPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeMail(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeMailWorkspace({
    organizationId: context.currentOrganization.id,
    membershipId: context.currentMembership.id,
    q: searchParams.q,
    view: searchParams.view,
    threadId: searchParams.threadId,
    mode: searchParams.mode
  });
  const scopeLabel = context.currentOrganization.name;

  return (
    <OfficeListPageShell className="office-mail-page">
      <OfficeListPageHeader
        actions={
          <Link className="office-button-secondary" href="/office/notifications">
            Open notifications
          </Link>
        }
        description="Internal mail lives entirely inside Back Office. Alongside teammate conversations, certain operational alerts such as new agent-created transactions now land here so admins can jump straight into the workflow."
        eyebrow="Mail"
        summary={
          <>
            <SummaryChip label="Scope" value={scopeLabel} />
            <SummaryChip label="Unread" tone="accent" value={snapshot.summary.unreadCount} />
            <SummaryChip label="Active" value={snapshot.summary.activeCount} />
            <SummaryChip label="Archived" value={snapshot.summary.archivedCount} />
          </>
        }
        title="Internal mail"
      />

      <OfficeMailClient scopeLabel={scopeLabel} snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
