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
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { translateOfficeTaskCopy, translateOfficeTaskWindowLabel } from "../_utils/task-copy";
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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell className="office-tasks-page">
      <OfficeListPageHeader
        description={
          isZh
            ? "集中管理交易任务、合规审核和到期优先级。"
            : "Back-office task management for transaction work, compliance review, and due-date prioritization."
        }
        eyebrow={isZh ? "任务" : "Task list"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={isZh ? "当前视图" : "Current view"} value={translateOfficeTaskCopy(snapshot.selectedViewName, isZh)} />
            <SummaryChip label={isZh ? "时间窗口" : "Window"} tone="accent" value={translateOfficeTaskWindowLabel(snapshot.maxWindowLabel, isZh)} />
          </>
        }
        title={isZh ? "任务" : "Task list"}
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
