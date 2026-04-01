import {
  canAccessOfficeTasks,
  canApproveOfficeDocuments,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { listOfficeTasks } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeTasksClient } from "./tasks-client";

type OfficeTasksPageProps = {
  searchParams?: Promise<{
    view?: string;
    transactionStatus?: string;
    assigneeMembershipId?: string;
    dueWindow?: string;
    noDueDate?: string;
    reviewStatus?: string;
    requiresSecondaryApproval?: string;
    complianceStatus?: string | string[];
    transactionId?: string;
    q?: string;
    includeCompleted?: string;
  }>;
};

export default async function OfficeTasksPage(props: OfficeTasksPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOfficeTasks(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await listOfficeTasks({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId: context.currentMembership.id,
    view: searchParams.view,
    transactionStatus: searchParams.transactionStatus,
    assigneeMembershipId: searchParams.assigneeMembershipId,
    dueWindow: searchParams.dueWindow,
    noDueDate: searchParams.noDueDate,
    reviewStatus: searchParams.reviewStatus,
    requiresSecondaryApproval: searchParams.requiresSecondaryApproval,
    complianceStatus: searchParams.complianceStatus,
    transactionId: searchParams.transactionId,
    q: searchParams.q,
    includeCompleted: searchParams.includeCompleted
  });

  return (
    <OfficeListPageShell className="office-tasks-page">
      <OfficeListPageHeader
        description="Back-office task management for transaction work, compliance review, and due-date prioritization."
        eyebrow="Task list"
        summary={
          <>
            <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="Current view" value={snapshot.selectedViewName} />
            <SummaryChip label="Window" tone="accent" value={snapshot.maxWindowLabel} />
          </>
        }
        title="Task list"
      />

      <OfficeTasksClient
        canApproveDocuments={canApproveOfficeDocuments(context.currentMembership)}
        canReviewTasks={canReviewOfficeTasks(context.currentMembership)}
        canSecondaryReviewTasks={canSecondaryReviewOfficeTasks(context.currentMembership)}
        currentMembershipId={context.currentMembership.id}
        snapshot={snapshot}
      />
    </OfficeListPageShell>
  );
}
