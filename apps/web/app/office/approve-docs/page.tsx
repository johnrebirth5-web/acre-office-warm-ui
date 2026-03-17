import {
  canAccessOfficeDocumentApprovals,
  canApproveOfficeDocuments,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import { PageHeader, PageHeaderSummary, PageShell, SummaryChip } from "@acre/ui";
import { listOfficeDocumentApprovalQueue } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeApproveDocsClient } from "./approve-docs-client";

type OfficeApproveDocsPageProps = {
  searchParams?: Promise<{
    queue?: string;
    assigneeMembershipId?: string;
    dueWindow?: string;
    q?: string;
  }>;
};

export default async function OfficeApproveDocsPage(props: OfficeApproveDocsPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeDocumentApprovals(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listOfficeDocumentApprovalQueue({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    canSecondaryReviewTasks: canSecondaryReviewOfficeTasks(context.currentMembership),
    queue: searchParams.queue,
    assigneeMembershipId: searchParams.assigneeMembershipId,
    dueWindow: searchParams.dueWindow,
    q: searchParams.q
  });

  return (
    <PageShell className="office-list-page office-approve-docs-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Queue" tone="accent" value={snapshot.selectedQueueLabel} />
            <SummaryChip label="Records in view" value={snapshot.itemCount} />
          </PageHeaderSummary>
        }
        description="Focused document review workbench for first approval, second approval, rejection follow-up, signature blockers, and missing required files."
        eyebrow="Approve docs"
        title="Approve docs"
      />

      <OfficeApproveDocsClient
        canApproveDocuments={canApproveOfficeDocuments(context.currentMembership)}
        canReviewTasks={canReviewOfficeTasks(context.currentMembership)}
        canSecondaryReviewTasks={canSecondaryReviewOfficeTasks(context.currentMembership)}
        currentMembershipId={context.currentMembership.id}
        snapshot={snapshot}
      />
    </PageShell>
  );
}
