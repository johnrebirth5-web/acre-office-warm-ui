import { can } from "@acre/auth";
import { getFrontOfficeClientsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import { FrontOfficeLink } from "../_components/front-office-link";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeClientsWorkbenchClient } from "./front-office-clients-workbench-client";
import { requireSessionContext } from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";
import { copyForLocale } from "../_lib/front-office-language";

export default async function AgentClientsPage() {
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

  const snapshot = await getFrontOfficeClientsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";

  const duplicatePreviewCandidates: FrontOfficeLeadDuplicatePreviewCandidate[] =
    snapshot.clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      sourceLabel: client.sourceLabel,
      nextTouchLabel: client.nextTouchLabel,
      href: client.href,
      areasLabel: client.areasLabel,
    }));

  return (
    <FrontOfficePageTemplate
      description={copyForLocale(
        isZh,
        "Keep the Front Office client page focused on the current follow-up clock, a lightweight note, and the few fields that actually drive execution.",
        "把前台客户页聚焦在当前跟进节奏、轻量备注，以及真正推动执行的少数字段。",
      )}
      eyebrow={isZh ? "前台" : "Front Office"}
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle={isZh ? "围绕当前跟进时钟整理的轻量队列。" : "A lightweight queue built around the current follow-up clock."}
            title={isZh ? "客户跟进队列" : "Client follow-up queue"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={isZh ? "分配给你的客户" : "Clients assigned to you"}
                label={isZh ? "活跃客户" : "Live clients"}
                tone="accent"
                value={snapshot.summary.liveContacts}
              />
              <StatCard
                hint={isZh ? "今天到期或已经逾期" : "Due today or already overdue"}
                label={isZh ? "待跟进" : "Due now"}
                tone="accent"
                value={snapshot.summary.followUpDueCount}
              />
              <StatCard
                hint={isZh ? "还没有设置下次提醒日期的客户" : "Clients missing a dated next reminder"}
                label={isZh ? "缺少提醒" : "Missing reminder"}
                tone="default"
                value={snapshot.summary.missingNextTouchCount}
              />
              <StatCard
                hint={isZh ? "仍需检查的潜在重复客户" : "Potential duplicate pairs still visible"}
                label={isZh ? "重复检查" : "Duplicate review"}
                tone="accent"
                value={snapshot.summary.potentialDuplicateCount}
              />
            </ListPageStatsGrid>

            {snapshot.clients.length ? (
              <FrontOfficeClientsWorkbenchClient clients={snapshot.clients} />
            ) : (
              <EmptyState
                description={
                  isZh
                    ? "这个队列会保持轻量。你可以在下方录入一个新线索，Acre 会把它放进跟进列表。"
                    : "The queue stays intentionally light. Add one new lead in the intake section below and Acre will place it into this follow-up list."
                }
                title={isZh ? "跟进队列里还没有客户" : "No clients in your follow-up queue"}
              />
            )}
          </SectionCard>

          <FrontOfficeLeadIntakeCard
            initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
            sourceSurface="clients"
            subtitle={
              isZh
                ? "AI 只填写姓名、预算、目标区域和跟进状态；其他信息会放进可编辑的备注里。"
                : "AI only fills Name, Budget, Target Area, and Follow-up Status. Everything else is folded into a Note that you can still edit."
            }
            title={isZh ? "快速录入" : "Quick intake"}
          />

          {snapshot.duplicatePairs.length ? (
            <SectionCard
              className="office-list-card"
              subtitle={isZh ? "重复检查仍保留，但不再占据主队列。" : "Duplicate review stays available, but it no longer dominates the main queue."}
              title={isZh ? "重复检查" : "Duplicate review"}
            >
              <div className="office-queue-list">
                {snapshot.duplicatePairs.slice(0, 4).map((pair) => (
                  <QueueItem
                    badgeLabel={pair.matchReasons.join(" · ")}
                    badgeTone="warning"
                    description={pair.rationaleLabel}
                    key={pair.id}
                    meta={
                      <>
                        <span>{isZh ? "保留：" : "Keep: "}{pair.recommendedClient.fullName}</span>
                        <span>{isZh ? "检查：" : "Review: "}{pair.duplicateClient.fullName}</span>
                      </>
                    }
                    action={
                      <>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={pair.recommendedClient.href}
                        >
                          {isZh ? "打开保留记录" : "Open keep record"}
                        </FrontOfficeLink>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={pair.duplicateClient.href}
                        >
                          {isZh ? "打开重复记录" : "Open duplicate"}
                        </FrontOfficeLink>
                      </>
                    }
                    title={pair.matchReasons.join(" / ")}
                  />
                ))}
              </div>
            </SectionCard>
          ) : null}
        </>
      }
      summary={
        <>
          <SummaryChip
            label={isZh ? "活跃客户" : "Live clients"}
            tone="accent"
            value={snapshot.summary.liveContacts}
          />
          <SummaryChip
            label={isZh ? "待跟进" : "Due now"}
            tone="accent"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label={isZh ? "重复检查" : "Duplicate review"}
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
        </>
      }
      title={isZh ? "客户" : "Clients"}
    />
  );
}
