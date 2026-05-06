import { can } from "@acre/auth";
import { getContactById } from "@acre/db";
import { QueueItem, SectionCard, StatusBadge, SummaryChip } from "@acre/ui";
import { notFound } from "next/navigation";
import { FrontOfficeAccessNotice } from "../../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../../_components/front-office-page-template";
import { FrontOfficeClientExecutionClient } from "./front-office-client-execution-client";
import { requireSessionContext } from "../../../../lib/auth-session";
import { getServerI18n } from "../../../../lib/i18n/server";
import {
  copyForLocale,
  translateFrontOfficeLabel,
} from "../../_lib/front-office-language";

type AgentClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function AgentClientDetailPage(
  props: AgentClientDetailPageProps,
) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "clients:view")) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="clients"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const { clientId } = await props.params;
  const contact = await getContactById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    contactId: clientId,
  });

  if (!contact) {
    notFound();
  }

  const legacyOpenTaskCount = contact.followUpTasks.filter(
    (task) => task.status !== "completed" && task.status !== "canceled",
  ).length;
  const linkedBackOfficeHref = contact.linkedTransactions[0]
    ? `/office/transactions/${contact.linkedTransactions[0].id}`
    : null;
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const budgetLabel = contact.budgetMax || (isZh ? "预算未设置" : "Budget not set");
  const areaLabel = contact.areas.join(", ") || (isZh ? "目标区域未设置" : "Target area not set");
  const notFollowedUpLabel = isZh ? "尚未跟进" : "Not followed up yet";
  const notSetLabel = isZh ? "未设置" : "Not set";

  return (
    <FrontOfficePageTemplate
      description={copyForLocale(
        isZh,
        "This page keeps the client record focused on the next follow-up move, the current reminder clock, and one editable note.",
        "这个客户页只聚焦下一步跟进、当前提醒时间和一条可编辑备注。",
      )}
      eyebrow={isZh ? "前台" : "Front Office"}
      main={
        <FrontOfficeClientExecutionClient
          contact={contact}
          legacyOpenTaskCount={legacyOpenTaskCount}
          linkedBackOfficeHref={linkedBackOfficeHref}
        />
      }
      rail={
        <SectionCard
          className="office-list-card"
          subtitle={isZh ? "只显示核心执行背景。" : "Core execution context only."}
          title={isZh ? "当前快照" : "Current snapshot"}
        >
          <div className="office-queue-list">
            <QueueItem
              badge={
                <StatusBadge tone="accent">
                  {translateFrontOfficeLabel(contact.followUpStatusLabel, isZh)}
                </StatusBadge>
              }
              context={translateFrontOfficeLabel(contact.followUpReminderModeLabel, isZh)}
              description={`${budgetLabel} · ${areaLabel}`}
              meta={
                <>
                  <span>
                    {isZh ? "上次跟进：" : "Last follow-up: "}
                    {contact.lastContactAt || notFollowedUpLabel}
                  </span>
                  <span>
                    {isZh ? "下次提醒：" : "Next reminder: "}{contact.nextFollowUpAt || notSetLabel}
                  </span>
                  {legacyOpenTaskCount > 0 ? (
                    <span>{isZh ? "旧跟进任务：" : "Legacy follow-up tasks: "}{legacyOpenTaskCount}</span>
                  ) : null}
                </>
              }
              title={contact.displayName}
            />
          </div>
        </SectionCard>
      }
      summary={
        <>
          <SummaryChip
            label={isZh ? "跟进状态" : "Follow-up status"}
            tone="accent"
            value={translateFrontOfficeLabel(contact.followUpStatusLabel, isZh)}
          />
          <SummaryChip
            label={isZh ? "下次提醒" : "Next reminder"}
            tone="accent"
            value={contact.nextFollowUpAt || notSetLabel}
          />
          <SummaryChip
            label={isZh ? "旧任务" : "Legacy tasks"}
            tone={legacyOpenTaskCount > 0 ? "accent" : "default"}
            value={legacyOpenTaskCount}
          />
        </>
      }
      title={contact.displayName}
    />
  );
}
