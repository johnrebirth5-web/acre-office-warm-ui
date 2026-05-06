import {
  canAccessOfficeDocumentApprovals,
  canApproveOfficeDocuments,
  canReviewOfficeTasks,
  canSecondaryReviewOfficeTasks
} from "@acre/auth";
import { SummaryChip } from "@acre/ui";
import { listOfficeDocumentApprovalQueue } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { OfficeApproveDocsClient } from "./approve-docs-client";

type OfficeApproveDocsPageProps = {
  searchParams?: Promise<{
    queue?: string;
    assigneeMembershipId?: string;
    dueWindow?: string;
    q?: string;
  }>;
};

function translateQueueLabel(label: string, isZh: boolean) {
  if (!isZh) {
    return label;
  }

  const queueMap: Record<string, string> = {
    "All open review items": "全部待处理审批",
    "Awaiting my review": "等待我审核",
    "Awaiting second review": "等待二级审核",
    Rejected: "已退回",
    "Waiting for signatures": "等待签署",
    "Missing required document": "缺少必交文件"
  };

  return queueMap[label] ?? label;
}

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
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale
  });
  const isZh = locale === "zh-CN";

  return (
    <OfficeListPageShell className="office-approve-docs-page">
      <OfficeListPageHeader
        description={
          isZh
            ? "集中处理等待审批、被退回需跟进、签署受阻或缺少必交文件的任务。"
            : "Review documents waiting on approval, rejection follow-up, signature blockers, and missing required files."
        }
        eyebrow={isZh ? "文档审批" : "Approve docs"}
        summary={
          <>
            <SummaryChip label={isZh ? "办公室范围" : "Office scope"} value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label={isZh ? "队列" : "Queue"} tone="accent" value={translateQueueLabel(snapshot.selectedQueueLabel, isZh)} />
            <SummaryChip label={isZh ? "当前记录" : "Records in view"} value={snapshot.itemCount} />
          </>
        }
        title={isZh ? "审批文档" : "Approve docs"}
      />

      <OfficeApproveDocsClient
        canApproveDocuments={canApproveOfficeDocuments(context.currentMembership)}
        canReviewTasks={canReviewOfficeTasks(context.currentMembership)}
        canSecondaryReviewTasks={canSecondaryReviewOfficeTasks(context.currentMembership)}
        currentMembershipId={context.currentMembership.id}
        snapshot={snapshot}
      />
    </OfficeListPageShell>
  );
}
