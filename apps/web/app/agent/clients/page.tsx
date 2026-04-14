import { can, getDefaultAppPath } from "@acre/auth";
import {
  getFrontOfficeClientsSnapshot,
  type FrontOfficeClientDuplicatePair,
  type FrontOfficeClientRecord,
} from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeClientDuplicatesCard } from "./front-office-client-duplicates-card";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../lib/auth-session";
import { getServerI18n } from "../../../lib/i18n/server";

type AgentClientsPageProps = {
  searchParams?: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

const clientListSectionIds = {
  intakeLaunch: "clients-intake-launch",
  executionQueue: "client-execution-queue",
  duplicateReview: "duplicate-review",
} as const;

type ClientWorkbenchView =
  | "all"
  | "follow_first"
  | "anchor_now"
  | "viewing_lane"
  | "boundary_review"
  | "duplicate_review";

function getClientWorkbenchViews(isZh: boolean): Record<
  ClientWorkbenchView,
  {
    label: string;
    subtitle: string;
    focusAnchor: string;
  }
> {
  return {
    all: {
      label: isZh ? "全部客户" : "All clients",
      subtitle: isZh
        ? "把整个 FO 队列保持可见，并在同一页面切到你需要的列表。"
        : "Keep the whole FO queue visible and switch to the list you need from the same page.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    follow_first: {
      label: isZh ? "优先跟进" : "Follow first",
      subtitle: isZh
        ? "让已逾期或今天到期的下一触达排在前面，保证队列始终以执行为先。"
        : "Lead with overdue or due-today next touches so the queue stays execution-first.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    anchor_now: {
      label: isZh ? "补下一步" : "Needs next step",
      subtitle: isZh
        ? "这个视图专门用来处理还缺第一次触达或缺少明确下一触达日期的客户记录。"
        : "Use this view for client records that still need a first touch or a dated next touch.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    viewing_lane: {
      label: isZh ? "带看" : "Showings",
      subtitle: isZh
        ? "把预约、带看和 tour 之后的跟进保持可见，同时不丢失主队列。"
        : "Keep appointments, showings, and tour follow-up visible without losing the queue.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    boundary_review: {
      label: isZh ? "交接审查" : "Handoff review",
      subtitle: isZh
        ? "把谈判、报价、申请和合同类工作放到交接前重新审查。"
        : "Review negotiation, offer, application, and contract work before formal handoff.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    duplicate_review: {
      label: isZh ? "重复记录审查" : "Duplicate review",
      subtitle: isZh
        ? "重新打开合并工作道，在整合记录之前逐对并排比较。"
        : "Reopen duplicate review and compare each pair side by side before you consolidate records.",
      focusAnchor: clientListSectionIds.duplicateReview,
    },
  };
}

const clientWorkbenchViewOrder: ClientWorkbenchView[] = [
  "all",
  "follow_first",
  "anchor_now",
  "viewing_lane",
  "boundary_review",
  "duplicate_review",
];

const clientDossierAnchors = {
  followUpForm: "#front-office-follow-up-form",
  leaseReminderForm: "#front-office-lease-reminder-form",
  appointmentsFollowUp: "#front-office-client-appointments-follow-up",
  nextStepRail: "#front-office-client-next-step-rail",
  closingSuggestion: "#front-office-client-closing-suggestion",
  backOfficeContext: "#front-office-client-back-office-context",
} as const;

const intakeReviewStages = new Set([
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Pending",
]);

type QueueBadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type DuplicateClientSignal = {
  pairHref: string;
  roleLabel: string;
  roleTone: QueueBadgeTone;
  partnerName: string;
  matchSummary: string;
  rationaleLabel: string;
};

type ClientExecutionQueueItem = FrontOfficeClientRecord & {
  priorityScore: number;
  queueOrder: number;
  queueLabel: string;
  queueTone: QueueBadgeTone;
  anchorLabel: string;
  whyNow: string;
  primaryActionHref: string;
  primaryActionLabel: string;
  reviewHref: string;
  reviewLabel: string;
  isUrgent: boolean;
  needsCleanup: boolean;
  needsBoundaryReview: boolean;
  isLeaseAnchored: boolean;
  isViewingLane: boolean;
  isClosedStage: boolean;
  duplicateSignal: DuplicateClientSignal | null;
};

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function resolveClientWorkbenchView(value: string | undefined) {
  switch (value) {
    case "follow_first":
    case "anchor_now":
    case "viewing_lane":
    case "boundary_review":
    case "duplicate_review":
      return value;
    default:
      return "all";
  }
}

function buildClientWorkbenchHref(view: ClientWorkbenchView, anchorId: string) {
  return `/agent/clients?clientView=${view}#${anchorId}`;
}

function buildClientWorkbenchViewActions(
  workbenchViews: ReturnType<typeof getClientWorkbenchViews>,
) {
  return clientWorkbenchViewOrder.map((view) => {
    const config = workbenchViews[view];

    return {
      href: buildClientWorkbenchHref(view, config.focusAnchor),
      label: config.label,
      title: config.subtitle,
    };
  });
}

function buildDuplicatePairAnchorId(pairId: string) {
  const sanitized = pairId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `duplicate-pair-${sanitized || "record"}`;
}

function isUrgentNextTouch(nextTouchLabel: string) {
  const normalized = normalizeLabel(nextTouchLabel);

  return (
    normalized.includes("overdue since") ||
    normalized.includes("lease reminder overdue") ||
    normalized.includes("due today")
  );
}

function isLeaseAnchored(nextTouchLabel: string) {
  return normalizeLabel(nextTouchLabel).includes("lease reminder");
}

function isMissingNextTouch(nextTouchLabel: string) {
  return normalizeLabel(nextTouchLabel).includes("no follow-up scheduled");
}

function isMissingContact(lastTouchLabel: string) {
  return normalizeLabel(lastTouchLabel).includes("no contact logged yet");
}

function isViewingLane(stage: string) {
  const normalized = normalizeLabel(stage);

  return (
    normalized.includes("viewing") ||
    normalized.includes("showing") ||
    normalized.includes("tour") ||
    normalized.includes("open house")
  );
}

function isBoundaryStage(stage: string) {
  const normalized = normalizeLabel(stage);

  return (
    normalized.includes("negotiation") ||
    normalized.includes("offer") ||
    normalized.includes("application") ||
    normalized.includes("contract")
  );
}

function isClosedStage(stage: string) {
  const normalized = normalizeLabel(stage);
  return normalized.includes("won") || normalized.includes("lost");
}

function buildDuplicateClientSignals(
  duplicatePairs: FrontOfficeClientDuplicatePair[],
  isZh: boolean,
) {
  const signals = new Map<string, DuplicateClientSignal>();

  for (const pair of duplicatePairs) {
    const pairHref = buildClientWorkbenchHref(
      "duplicate_review",
      buildDuplicatePairAnchorId(pair.id),
    );
    const matchSummary = pair.matchReasons.join(" · ");

    if (!signals.has(pair.recommendedClient.id)) {
      signals.set(pair.recommendedClient.id, {
        pairHref,
        roleLabel: isZh ? "保留候选" : "Keep candidate",
        roleTone: "accent",
        partnerName: pair.duplicateClient.fullName,
        matchSummary,
        rationaleLabel: pair.rationaleLabel,
      });
    }

    if (!signals.has(pair.duplicateClient.id)) {
      signals.set(pair.duplicateClient.id, {
        pairHref,
        roleLabel: isZh ? "合并审查" : "Merge review",
        roleTone: "warning",
        partnerName: pair.recommendedClient.fullName,
        matchSummary,
        rationaleLabel: pair.rationaleLabel,
      });
    }
  }

  return signals;
}

function buildClientQueueDescriptor(
  client: FrontOfficeClientRecord,
  duplicateSignal: DuplicateClientSignal | null,
  isZh: boolean,
): Omit<
  ClientExecutionQueueItem,
  keyof FrontOfficeClientRecord | "queueOrder"
> {
  const urgent = isUrgentNextTouch(client.nextTouchLabel);
  const leaseAnchored = isLeaseAnchored(client.nextTouchLabel);
  const missingNextTouch = isMissingNextTouch(client.nextTouchLabel);
  const missingContact = isMissingContact(client.lastTouchLabel);
  const viewingLane = isViewingLane(client.stage);
  const boundaryStage = isBoundaryStage(client.stage);
  const closedStage = isClosedStage(client.stage);
  const intakeStage = intakeReviewStages.has(client.stage);

  let priorityScore = 0;
  let queueLabel = isZh ? "继续推进" : "Keep moving";
  let queueTone: QueueBadgeTone = "accent";
  let anchorLabel = intakeStage
    ? isZh
      ? "录入审查"
      : "Intake review"
    : isZh
      ? "下一步"
      : "Next step";
  let whyNow = isZh
    ? "这个客户记录仍在活跃的 Front Office 流程里，下一步动作应该保持可见。"
    : "This client record is still active in Front Office and should keep a visible next move.";
  let primaryActionHref = `${client.href}${clientDossierAnchors.nextStepRail}`;
  let primaryActionLabel = intakeStage
    ? isZh
      ? "继续录入"
      : "Continue intake"
    : isZh
      ? "查看下一步"
      : "Review next step";

  if (duplicateSignal) {
    priorityScore += duplicateSignal.roleTone === "warning" ? 20 : 10;
  }

  if (boundaryStage) {
    priorityScore += 70;
  }

  if (viewingLane) {
    priorityScore += 45;
  }

  if (leaseAnchored) {
    priorityScore += 35;
  }

  if (missingContact) {
    priorityScore += 80;
  }

  if (missingNextTouch) {
    priorityScore += 110;
  }

  if (urgent) {
    priorityScore += 180;
  }

  if (closedStage) {
    priorityScore -= 120;
  }

  if (urgent) {
    queueLabel = isZh ? "优先跟进" : "Follow first";
    queueTone = "danger";
    anchorLabel = leaseAnchored
      ? isZh
        ? "租约提醒已逾期"
        : "Lease reminder overdue"
      : isZh
        ? "下一触达已逾期"
        : "Next touch overdue";
    whyNow = leaseAnchored
      ? "The lease or remarketing reminder is already active, so this client should stay ahead of stage-only cleanup."
      : "The next touch is already due, so this client record belongs at the front of today's FO queue.";
    primaryActionHref = leaseAnchored
      ? `${client.href}${clientDossierAnchors.leaseReminderForm}`
      : `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = leaseAnchored
      ? isZh
        ? "打开租约提醒"
        : "Open lease reminder"
      : isZh
        ? "打开跟进表单"
        : "Open follow-up form";
  } else if (missingNextTouch || missingContact) {
    queueLabel = isZh ? "补下一步" : "Needs next step";
    queueTone = "warning";
    anchorLabel = missingContact
      ? isZh
        ? "缺少第一次触达"
        : "First touch missing"
      : isZh
        ? "没有带日期的下一触达"
        : "No dated next touch";
    whyNow = missingContact
      ? "No contact is logged yet, so first-touch work should stay explicit instead of hiding inside a stage label."
      : "This active client record has no dated next touch, so it can fall out of the FO queue unless you anchor it now.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = missingContact
      ? isZh
        ? "规划第一次触达"
        : "Plan first touch"
      : isZh
        ? "安排下一触达"
        : "Set next touch";
  } else if (boundaryStage) {
    queueLabel = isZh ? "审查 BO" : "Review BO";
    queueTone = "warning";
    anchorLabel = isZh ? "BO 交接审查" : "BO handoff review";
    whyNow =
      "Negotiation, offer, or application work is active, so the next official record should be reviewed through Back Office handoff instead of duplicating formal workflow here.";
    primaryActionHref = `${client.href}${clientDossierAnchors.backOfficeContext}`;
    primaryActionLabel = isZh ? "审查 BO 交接" : "Review BO handoff";
  } else if (viewingLane) {
    queueLabel = isZh ? "带看" : "Showings";
    queueTone = "accent";
    anchorLabel = isZh ? "预约跟进" : "Appointment follow-up";
    whyNow =
      "Showing and viewing coordination is the live focus, so appointment timing, confirmation, and follow-up should stay easy to reopen.";
    primaryActionHref = `${client.href}${clientDossierAnchors.appointmentsFollowUp}`;
    primaryActionLabel = isZh ? "查看预约" : "Review appointments";
  } else if (leaseAnchored) {
    queueLabel = isZh ? "租约观察" : "Lease watch";
    queueTone = "accent";
    anchorLabel = isZh ? "续租 / 租约提醒" : "Renewal / lease reminder";
    whyNow =
      "Lease timing is the active priority here, so renewal or remarketing planning should stay visible on the same Front Office client record.";
    primaryActionHref = `${client.href}${clientDossierAnchors.leaseReminderForm}`;
    primaryActionLabel = isZh ? "打开租约提醒" : "Open lease reminder";
  } else if (closedStage) {
    queueLabel = isZh ? "维护" : "Nurture";
    queueTone = "neutral";
    anchorLabel = isZh ? "结果后续跟进" : "Outcome follow-through";
    whyNow =
      "Outcome context is already on record, so only closeout, recap, or respectful nurture should stay in Front Office.";
    primaryActionHref = `${client.href}${clientDossierAnchors.closingSuggestion}`;
    primaryActionLabel = isZh
      ? "查看结果后续跟进"
      : "Review outcome follow-through";
  } else if (intakeStage) {
    queueLabel = isZh ? "录入" : "Intake";
    queueTone = "accent";
    anchorLabel = isZh ? "录入后续跟进" : "Intake follow-up";
    whyNow =
      "Early-stage intake is still active, so the next move should stay explicit instead of turning the client list into a passive summary.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = isZh ? "继续录入复核" : "Continue intake review";
  }

  return {
    priorityScore,
    queueLabel,
    queueTone,
    anchorLabel,
    whyNow,
    primaryActionHref,
    primaryActionLabel,
    reviewHref: client.href,
    reviewLabel: isZh ? "打开客户页" : "Open client page",
    isUrgent: urgent,
    needsCleanup: missingNextTouch || missingContact,
    needsBoundaryReview: boundaryStage,
    isLeaseAnchored: leaseAnchored,
    isViewingLane: viewingLane,
    isClosedStage: closedStage,
    duplicateSignal,
  };
}

function buildClientExecutionQueue(
  clients: FrontOfficeClientRecord[],
  duplicateSignals: Map<string, DuplicateClientSignal>,
  isZh: boolean,
): ClientExecutionQueueItem[] {
  return clients
    .map((client, index) => ({
      ...client,
      ...buildClientQueueDescriptor(
        client,
        duplicateSignals.get(client.id) ?? null,
        isZh,
      ),
      originalIndex: index,
    }))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ originalIndex: _originalIndex, ...client }, index) => ({
      ...client,
      queueOrder: index + 1,
    }));
}

function matchesClientWorkbenchView(
  client: ClientExecutionQueueItem,
  view: ClientWorkbenchView,
) {
  switch (view) {
    case "follow_first":
      return client.isUrgent;
    case "anchor_now":
      return client.needsCleanup;
    case "viewing_lane":
      return client.isViewingLane;
    case "boundary_review":
      return client.needsBoundaryReview;
    case "duplicate_review":
      return Boolean(client.duplicateSignal);
    default:
      return true;
  }
}

function buildClientWorkbenchQueueEmptyState(
  view: ClientWorkbenchView,
  focusLabel: string,
  isZh: boolean,
) {
  switch (view) {
    case "follow_first":
      return {
        title: isZh ? "优先跟进列表已清空" : "Follow-first list is clear",
        description: isZh
          ? "当前没有客户记录处在逾期或今天到期的下一触达状态，所以你可以安全地重新打开更宽的队列，而不会丢失当前焦点。"
          : "No client record currently has an overdue or due-today next touch, so you can reopen the broader queue without losing the active route focus.",
      };
    case "anchor_now":
      return {
        title: isZh ? "补下一步列表已清空" : "Needs-next-step list is clear",
        description: isZh
          ? "当前所有可见的实时客户记录都已经有第一次触达或带日期的下一触达，因此这个列表可以安全地重新扩回更宽的队列。"
          : "Every visible live client record already has a first touch or a dated next touch, so this list can safely widen back into the broader queue.",
      };
    case "viewing_lane":
      return {
        title: isZh ? "带看列表已清空" : "Showing list is clear",
        description: isZh
          ? "当前没有任何可见客户记录以带看或预约后续路径为主。"
          : "No visible client record is currently leading with a showing or appointment-follow-through path.",
      };
    case "boundary_review":
      return {
        title: isZh ? "交接审查列表已清空" : "Handoff-review list is clear",
        description: isZh
          ? "当前没有任何可见客户记录在谈判、报价或申请工作上活跃到需要优先进入 BO 交接审查。"
          : "No visible client record is currently active enough in negotiation, offer, or application work to demand a BO handoff review first.",
      };
    case "duplicate_review":
      return {
        title: isZh ? "重复审查列表已清空" : "Duplicate-review list is clear",
        description: isZh
          ? "当前没有任何可见客户记录带着最强的重复配对信号，所以这个视图可以重新扩回完整执行队列。"
          : "No visible client record is currently carrying the strongest pairwise duplicate signal, so the view can widen back into the full execution queue.",
      };
    default:
      return {
        title: isZh ? "当前没有实时客户队列" : "No live client queue",
        description: isZh
          ? `当前没有客户记录匹配“${focusLabel}”，因为可见的 FO 队列仍然为空。`
          : `No client record currently matches ${focusLabel.toLowerCase()} because the visible FO queue is still empty.`,
      };
  }
}

export default async function AgentClientsPage(props: AgentClientsPageProps) {
  const context = await requireSessionContext();
  const { locale } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const isZh = locale === "zh-CN";
  const searchParams = (await props.searchParams) ?? {};
  const activeClientView = resolveClientWorkbenchView(
    typeof searchParams.clientView === "string"
      ? searchParams.clientView
      : undefined,
  );
  const clientWorkbenchViews = getClientWorkbenchViews(isZh);
  const activeClientViewConfig = clientWorkbenchViews[activeClientView];

  if (!can(context.currentMembership, "clients:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const snapshot = await getFrontOfficeClientsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });
  const duplicateSignals = buildDuplicateClientSignals(
    snapshot.duplicatePairs,
    isZh,
  );
  const executionQueue = buildClientExecutionQueue(
    snapshot.clients,
    duplicateSignals,
    isZh,
  );
  const focusedExecutionQueue = executionQueue.filter((client) =>
    matchesClientWorkbenchView(client, activeClientView),
  );
  const visibleExecutionQueue =
    activeClientView === "all" || focusedExecutionQueue.length
      ? focusedExecutionQueue
      : executionQueue;
  const queueEmptyState = buildClientWorkbenchQueueEmptyState(
    activeClientView,
    activeClientViewConfig.label,
    isZh,
  );
  const actNowCount = executionQueue.filter((client) => client.isUrgent).length;
  const cleanupCount =
    snapshot.summary.missingContactCount +
    snapshot.summary.missingNextTouchCount;
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
      description={
        isZh
          ? "先处理下一次触达，再补缺失信息；只有需要新线索时才打开录入。"
          : "Work the next touch first, fix missing info next, and only open intake when you need a new lead."
      }
      eyebrow={isZh ? "客户" : "Clients"}
      main={
        <>
          <SectionCard
            id={clientListSectionIds.executionQueue}
            actions={
              <>
                {buildClientWorkbenchViewActions(clientWorkbenchViews).map(
                  (viewAction) => (
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={viewAction.href}
                      key={viewAction.href}
                    >
                      {viewAction.label}
                    </FrontOfficeLink>
                  ),
                )}
              </>
            }
            className="office-list-card"
            subtitle={
              isZh
                ? `${activeClientViewConfig.label}。先做下一次触达，再补缺失信息；需要时再处理重复记录或交接。`
                : `${activeClientViewConfig.label}. Handle the next touch first, fill missing info next, and only step into duplicate review or handoff when needed.`
            }
            title={isZh ? "客户队列" : "Client queue"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh
                    ? "下一次触达已经到期或逾期的客户记录"
                    : "client records whose next touch is already due or overdue"
                }
                label={isZh ? "优先跟进" : "Follow first"}
                tone="accent"
                value={actNowCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "仍需要可见的首次触达或带日期下次触达锚点的记录"
                    : "records that still need a visible first-touch or dated next-touch anchor"
                }
                label={isZh ? "立即锚定" : "Anchor now"}
                tone="accent"
                value={cleanupCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "你当前可见 CRM 记录中的成对重复审查建议"
                    : "pairwise duplicate review suggestions across the CRM records visible to you"
                }
                label={isZh ? "重复审查" : "Duplicate review"}
                tone="accent"
                value={snapshot.summary.potentialDuplicateCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              {visibleExecutionQueue.length ? (
                visibleExecutionQueue.map((client) => (
                  <QueueItem
                    action={
                      <div className="list-row-meta front-office-record-meta">
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={client.primaryActionHref}
                        >
                          {client.primaryActionLabel}
                        </FrontOfficeLink>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={client.reviewHref}
                        >
                          {client.reviewLabel}
                        </FrontOfficeLink>
                      </div>
                    }
                    badgeLabel={client.queueLabel}
                    badgeTone={client.queueTone}
                    context={`${isZh ? "队列" : "Queue"} ${client.queueOrder}`}
                    description={client.whyNow}
                    key={client.id}
                    meta={
                      <>
                        <div className="list-row-meta front-office-record-meta">
                          <StatusBadge tone={client.stageTone}>
                            {client.stage}
                          </StatusBadge>
                          <span>{client.nextTouchLabel}</span>
                          {client.duplicateSignal ? (
                            <span>
                              {isZh ? "可能重复" : "Possible duplicate"}
                            </span>
                          ) : null}
                        </div>
                        <div className="list-row-meta front-office-record-meta">
                          <span>
                            {client.intentLabel} · {client.budgetLabel}
                          </span>
                          <span>{client.areasLabel}</span>
                          <span>{client.sourceLabel}</span>
                        </div>
                      </>
                    }
                    title={client.fullName}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={buildClientWorkbenchHref(
                        "anchor_now",
                        clientListSectionIds.intakeLaunch,
                      )}
                    >
                      {activeClientView === "all"
                        ? isZh
                          ? "启动录入辅助"
                          : "Launch intake assist"
                        : isZh
                          ? "打开更宽的队列"
                          : "Open broader queue"}
                    </FrontOfficeLink>
                  }
                  description={
                    activeClientView === "all"
                      ? isZh
                        ? "当 Front Office 开始把共享 CRM 当作实时客户队列来使用时，下一触达顺序就会显示在这里。"
                        : "When Front Office starts using the shared CRM as the active client queue, the next-touch order will appear here."
                      : queueEmptyState.description
                  }
                  title={
                    activeClientView === "all"
                      ? isZh
                        ? "当前没有实时客户队列"
                        : "No live client queue"
                      : queueEmptyState.title
                  }
                />
              )}
            </div>
          </SectionCard>

          {snapshot.duplicatePairs.length ? (
            <FrontOfficeClientDuplicatesCard
              clientView={activeClientView}
              duplicatePairs={snapshot.duplicatePairs}
            />
          ) : null}

          <div id={clientListSectionIds.intakeLaunch}>
            <FrontOfficeLeadIntakeCard
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="clients"
              subtitle={
                isZh
                  ? "只抓关键字段，确认后再写进表单。"
                  : "Pull key fields first, then fill the form with only what you want to keep."
              }
              title={isZh ? "快速录入" : "Quick lead intake"}
            />
          </div>
        </>
      }
      summary={
        <>
          <SummaryChip
            label={isZh ? "优先跟进" : "Follow first"}
            tone="accent"
            value={actNowCount}
          />
          <SummaryChip
            label={isZh ? "待处理" : "Needs attention"}
            tone="accent"
            value={cleanupCount}
          />
          <SummaryChip
            label={isZh ? "重复审查" : "Duplicate review"}
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
        </>
      }
      title={isZh ? "客户" : "Clients"}
    />
  );
}
