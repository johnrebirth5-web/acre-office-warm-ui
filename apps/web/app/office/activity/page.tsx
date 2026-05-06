import Link from "next/link";
import { canAccessAccountActivity, canReviewOfficeTasks, canSecondaryReviewOfficeTasks } from "@acre/auth";
import {
  Button,
  EmptyState,
  FilterBar,
  FilterField,
  SectionCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { getOfficeActivityLogSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeListPageHeader, OfficeListPageShell } from "../_components/office-list-page-template";
import { ActivityAlertsLayout } from "./activity-alerts-layout";
import { ActivityCommentComposer } from "./activity-comment-composer";

type OfficeActivityPageProps = {
  searchParams?: Promise<{
    view?: string;
    activitySection?: string;
    alertSection?: string;
    actorMembershipId?: string;
    objectType?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
};

type ActivitySearchParams = {
  view?: string;
  activitySection?: string;
  alertSection?: string;
  actorMembershipId?: string;
  objectType?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
};

const ACTIVITY_PAGE_SIZE = 10;

function normalizePage(value: string | undefined) {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildActivityHref(currentSearchParams: ActivitySearchParams, nextSearchParams: ActivitySearchParams) {
  const merged = new URLSearchParams();
  const finalSearchParams = {
    view: currentSearchParams.view,
    activitySection: currentSearchParams.activitySection,
    alertSection: currentSearchParams.alertSection,
    actorMembershipId: currentSearchParams.actorMembershipId,
    objectType: currentSearchParams.objectType,
    startDate: currentSearchParams.startDate,
    endDate: currentSearchParams.endDate,
    page: currentSearchParams.page,
    ...nextSearchParams
  };

  for (const [key, value] of Object.entries(finalSearchParams)) {
    if (typeof value === "string" && value.trim().length > 0) {
      merged.set(key, value);
    }
  }

  const query = merged.toString();
  return query ? `/office/activity?${query}` : "/office/activity";
}

export default async function OfficeActivityPage(props: OfficeActivityPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessAccountActivity(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const searchParams = (await props.searchParams) ?? {};
  const snapshot = await getOfficeActivityLogSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    currentMembershipId: context.currentMembership.id,
    canReviewTasks: canReviewOfficeTasks(context.currentMembership),
    canSecondaryReviewTasks: canSecondaryReviewOfficeTasks(context.currentMembership),
    view: searchParams.view,
    activitySection: searchParams.activitySection,
    alertSection: searchParams.alertSection,
    actorMembershipId: searchParams.actorMembershipId,
    objectType: searchParams.objectType,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate
  });

  const selectedView = snapshot.selectedView;
  const currentPage = normalizePage(searchParams.page);
  const normalizedSearchParams = {
    view: selectedView === "all" ? "" : selectedView,
    activitySection: selectedView === "activity" ? snapshot.activitySelectedSection : "",
    alertSection: typeof searchParams.alertSection === "string" ? searchParams.alertSection : "",
    actorMembershipId: snapshot.filters.actorMembershipId,
    objectType: snapshot.filters.objectType === "all" ? "" : snapshot.filters.objectType,
    startDate: snapshot.filters.startDate,
    endDate: snapshot.filters.endDate,
    page: ""
  };
  const totalActivityRecords = snapshot.activityEvents.length;
  const totalActivityPages = Math.max(Math.ceil(totalActivityRecords / ACTIVITY_PAGE_SIZE), 1);
  const activityPage = Math.min(currentPage, totalActivityPages);
  const activityPageStartIndex = totalActivityRecords === 0 ? 0 : (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivityEvents = snapshot.activityEvents.slice(
    activityPageStartIndex,
    activityPageStartIndex + ACTIVITY_PAGE_SIZE
  );
  const activityPageStartLabel = totalActivityRecords === 0 ? 0 : activityPageStartIndex + 1;
  const activityPageEndLabel = totalActivityRecords === 0 ? 0 : activityPageStartIndex + paginatedActivityEvents.length;
  const activitySubtitle = totalActivityRecords
    ? `显示 ${activityPageStartLabel}-${activityPageEndLabel} / 共 ${totalActivityRecords} 条审计记录`
    : "显示 0 条审计记录";
  const liveAlertsSummaryValue =
    selectedView === "activity" ? "按需加载" : selectedView === "alerts" ? "仅提醒" : "下方包含";
  const activityPaginationBaseHref = buildActivityHref(normalizedSearchParams, { page: "" });
  const activitySidebar = (
    <SectionCard
      className="office-activity-sections-card"
      subtitle="统计最近 200 条审计记录窗口"
      title="活动日志"
    >
      <nav className="office-activity-section-list">
        {snapshot.activitySections.map((section) => (
          <Link
            className={`office-activity-section-link${selectedView === "activity" && section.key === snapshot.activitySelectedSection ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "activity",
              activitySection: section.key,
              alertSection: "",
              page: ""
            })}
            key={section.key}
          >
            <strong>{section.label}</strong>
            <span>{section.count}</span>
          </Link>
        ))}
      </nav>
    </SectionCard>
  );
  const activityStream =
    selectedView !== "alerts" ? (
      <SectionCard
        className="office-activity-log-card"
        subtitle={activitySubtitle}
        title={selectedView === "activity" ? snapshot.activitySelectedSectionLabel : "活动日志"}
      >
        <div className="office-activity-records">
          {paginatedActivityEvents.length ? (
            paginatedActivityEvents.map((event) => (
              <article className="office-activity-record" key={event.id}>
                <div className="office-activity-record-top">
                  <div className="office-activity-record-copy">
                    <div className="office-activity-record-summary">
                      <strong>{event.actorDisplayName}</strong>
                      <span>{event.summary}</span>
                    </div>
                    {event.href ? (
                      <Link className="office-activity-object-link" href={event.href}>
                        {event.objectLabel}
                      </Link>
                    ) : (
                      <p className="office-activity-object-link is-static">{event.objectLabel}</p>
                    )}
                  </div>

                  <div className="office-activity-record-meta">
                    <StatusBadge tone={event.isComment ? "neutral" : "accent"}>{event.actionLabel}</StatusBadge>
                    <time>{event.timestampLabel}</time>
                  </div>
                </div>

                {event.detailSummary.length ? (
                  <ul className="office-activity-detail-list">
                    {event.detailSummary.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState description="可以尝试扩大日期范围，或使用更宽的视图筛选。" title="当前范围内没有可用的审计事件。" />
          )}
        </div>
        {totalActivityRecords > ACTIVITY_PAGE_SIZE ? (
          <div className="office-list-page-pagination office-activity-pagination">
            {activityPage > 1 ? (
              <Link
                className="office-list-page-button"
                href={buildActivityHref(normalizedSearchParams, {
                  page: activityPage - 1 > 1 ? String(activityPage - 1) : ""
                })}
              >
                上一页
              </Link>
            ) : (
              <span className="office-list-page-button is-disabled">上一页</span>
            )}

            <form action={activityPaginationBaseHref} className="office-activity-page-jump" method="get">
              <label className="office-activity-page-jump-label" htmlFor="activity-page-jump-input">
                页码
              </label>
              <input
                aria-label="跳转到页码"
                className="office-input office-activity-page-jump-input"
                defaultValue={activityPage}
                id="activity-page-jump-input"
                max={totalActivityPages}
                min={1}
                name="page"
                type="number"
              />
              <span className="office-list-page-indicator">/ {totalActivityPages}</span>
              <Button size="sm" type="submit" variant="secondary">
                跳转
              </Button>
            </form>

            {activityPage < totalActivityPages ? (
              <Link
                className="office-list-page-button"
                href={buildActivityHref(normalizedSearchParams, {
                  page: String(activityPage + 1)
                })}
              >
                下一页
              </Link>
            ) : (
              <span className="office-list-page-button is-disabled">下一页</span>
            )}
          </div>
        ) : null}
      </SectionCard>
    ) : null;

  return (
    <OfficeListPageShell className="office-activity-page">
      <OfficeListPageHeader
        actions={
          <ActivityCommentComposer
            officeId={context.currentOffice?.id ?? null}
            scopeLabel={context.currentOffice?.name ?? context.currentOrganization.name}
          />
        }
        description="以审计记录为准；运营提醒则从当前交易、任务和联系人状态实时推导。"
        eyebrow="账户活动"
        summary={
          <>
            <SummaryChip label="办公室范围" value={context.currentOffice?.name ?? context.currentOrganization.name} />
            <SummaryChip label="审计窗口" tone="accent" value={snapshot.latestWindowCount} />
            <SummaryChip label="实时提醒" value={liveAlertsSummaryValue} />
          </>
        }
        title="账户活动"
      />

      <FilterBar as="form" className="office-activity-filter-bar office-activity-toolbar-card" method="get">
        <div className="office-filter-strip office-toggle-strip">
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "all" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "all",
              activitySection: "",
              alertSection: "",
              page: ""
            })}
          >
            全部
          </Link>
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "activity" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "activity",
              alertSection: "",
              page: ""
            })}
          >
            仅活动
          </Link>
          <Link
            className={`office-toggle-link office-button-sm${selectedView === "alerts" ? " is-active" : ""}`}
            href={buildActivityHref(normalizedSearchParams, {
              view: "alerts",
              activitySection: "",
              page: ""
            })}
          >
            仅提醒
          </Link>
        </div>

        <div className="office-activity-filter-grid">
          <FilterField className="office-activity-filter-field" label="操作人（仅活动）">
            <select defaultValue={snapshot.filters.actorMembershipId} disabled={selectedView === "alerts"} name="actorMembershipId">
              <option value="">全部操作人</option>
              {snapshot.filters.actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField className="office-activity-filter-field" label="对象类型">
            <select defaultValue={snapshot.filters.objectType} name="objectType">
              <option value="all">全部对象</option>
              <option value="transaction">交易</option>
              <option value="contact">联系人</option>
              <option value="task">任务</option>
              <option value="agent">经纪人 / 团队</option>
              <option value="document">文件 / 表单</option>
              <option value="accounting">财务</option>
              <option value="comment">评论</option>
              <option value="auth">认证</option>
            </select>
          </FilterField>

          <FilterField className="office-activity-filter-field" label="开始日期">
            <input defaultValue={snapshot.filters.startDate} name="startDate" type="date" />
          </FilterField>

          <FilterField className="office-activity-filter-field" label="结束日期">
            <input defaultValue={snapshot.filters.endDate} name="endDate" type="date" />
          </FilterField>

          <div className="office-activity-filter-actions">
            <input name="view" type="hidden" value={selectedView} />
            {selectedView === "activity" ? (
              <input name="activitySection" type="hidden" value={snapshot.activitySelectedSection} />
            ) : null}
            {selectedView === "alerts" ? (
              <input name="alertSection" type="hidden" value={normalizedSearchParams.alertSection} />
            ) : null}
            <Button type="submit" variant="secondary">
              应用筛选
            </Button>
            <Link className="office-button-secondary" href="/office/activity">
              重置
            </Link>
          </div>
        </div>
      </FilterBar>

      <ActivityAlertsLayout
        activitySidebar={activitySidebar}
        activityStream={activityStream}
        currentSearchParams={normalizedSearchParams}
        selectedView={selectedView}
      />
    </OfficeListPageShell>
  );
}
