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
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
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
      label: isZh ? "全部工作道" : "All lanes",
      subtitle: isZh
        ? "把整个 FO 队列保持可见，并在同一页面重新打开你需要的工作道。"
        : "Keep the whole FO queue visible and re-open the lane you need from the same page.",
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
      label: isZh ? "立即锚定" : "Anchor now",
      subtitle: isZh
        ? "这个视图专门用来处理还缺第一次触达或缺少明确下一触达日期的 dossier。"
        : "Use this view for dossiers that still need a first touch or a dated next touch.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    viewing_lane: {
      label: isZh ? "带看工作道" : "Viewing lane",
      subtitle: isZh
        ? "把预约、带看和 tour 之后的跟进保持可见，同时不丢失主队列。"
        : "Keep appointments, showings, and tour follow-up visible without losing the queue.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    boundary_review: {
      label: isZh ? "边界审查" : "Boundary review",
      subtitle: isZh
        ? "把谈判、报价、申请和合同类工作放到 FO → BO 边界上重新审查。"
        : "Review negotiation, offer, application, and contract work against the FO → BO boundary.",
      focusAnchor: clientListSectionIds.executionQueue,
    },
    duplicate_review: {
      label: isZh ? "重复记录审查" : "Duplicate review",
      subtitle: isZh
        ? "重新打开合并工作道，在整合记录之前逐对并排比较。"
        : "Reopen the merge lane and compare each pair side by side before you consolidate records.",
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
      ? "下一步轨道"
      : "Next-step rail";
  let whyNow =
    isZh
      ? "这个 dossier 仍在活跃的 Front Office 工作道里，下一步动作应该保持可见。"
      : "This dossier is still in the active Front Office lane and should keep a visible next move.";
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
      : "The next touch is already due, so this dossier belongs at the front of today's FO queue.";
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
    queueLabel = isZh ? "立即锚定" : "Anchor now";
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
      : "This active dossier has no dated next touch, so it can fall out of the FO queue unless you anchor it now.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = missingContact
      ? isZh
        ? "规划第一次触达"
        : "Plan first touch"
      : isZh
        ? "锚定下一触达"
        : "Anchor next touch";
  } else if (boundaryStage) {
    queueLabel = isZh ? "审查 BO" : "Review BO";
    queueTone = "warning";
    anchorLabel = isZh ? "BO 边界审查" : "BO boundary review";
    whyNow =
      "Negotiation, offer, or application work is active, so the next official record should be reviewed through the Back Office boundary instead of duplicating formal workflow here.";
    primaryActionHref = `${client.href}${clientDossierAnchors.backOfficeContext}`;
    primaryActionLabel = isZh ? "审查 BO 交接" : "Review BO handoff";
  } else if (viewingLane) {
    queueLabel = isZh ? "带看工作道" : "Viewing lane";
    queueTone = "accent";
    anchorLabel = isZh ? "预约跟进" : "Appointment follow-up";
    whyNow =
      "Showing and viewing coordination is the live lane, so appointment timing, confirmation, and follow-up should stay easy to reopen.";
    primaryActionHref = `${client.href}${clientDossierAnchors.appointmentsFollowUp}`;
    primaryActionLabel = isZh ? "查看预约" : "Review appointments";
  } else if (leaseAnchored) {
    queueLabel = isZh ? "租约观察" : "Lease watch";
    queueTone = "accent";
    anchorLabel = isZh ? "续租 / 租约锚点" : "Renewal / lease anchor";
    whyNow =
      "Lease timing is the active anchor here, so renewal or remarketing planning should stay visible in the same FO dossier.";
    primaryActionHref = `${client.href}${clientDossierAnchors.leaseReminderForm}`;
    primaryActionLabel = isZh ? "打开租约提醒" : "Open lease reminder";
  } else if (closedStage) {
    queueLabel = isZh ? "维护" : "Nurture";
    queueTone = "neutral";
    anchorLabel = isZh ? "结果后续跟进" : "Outcome follow-through";
    whyNow =
      "Outcome context is already on record, so only closeout, recap, or respectful nurture should stay in Front Office.";
    primaryActionHref = `${client.href}${clientDossierAnchors.closingSuggestion}`;
    primaryActionLabel = isZh ? "查看结果后续跟进" : "Review outcome follow-through";
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
    reviewLabel: isZh ? "打开 dossier" : "Open dossier",
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

function buildStageSummaryLabel(
  stageMetrics: Awaited<
    ReturnType<typeof getFrontOfficeClientsSnapshot>
  >["stageMetrics"],
  isZh: boolean,
) {
  if (!stageMetrics.length) {
    return isZh ? "当前还没有实时阶段分布。" : "No live stage mix yet.";
  }

  return stageMetrics
    .map((metric) => `${metric.label} · ${metric.count}`)
    .join(" · ");
}

function buildDuplicateBoardDescription(
  pair: FrontOfficeClientDuplicatePair,
  isZh: boolean,
) {
  return isZh
    ? `${pair.rationaleLabel} 只有在你并排确认过两个 dossier 之后，再合并 ${pair.duplicateClient.fullName}。如果后面还有别的配对在等，合并后请通过同一个重复审查锚点重新进入。`
    : `${pair.rationaleLabel} Merge ${pair.duplicateClient.fullName} only after you confirm both dossiers side by side. After the merge, re-enter through the same duplicate-review anchor if another pair is still waiting.`;
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
        title: isZh ? "优先跟进工作道已清空" : "Follow-first lane is clear",
        description: isZh
          ? "当前没有 dossier 处在逾期或今天到期的下一触达状态，所以你可以安全地重新打开更宽的队列，而不会丢失当前焦点。"
          : "No dossier currently has an overdue or due-today next touch, so you can reopen the broader queue without losing the active route focus.",
      };
    case "anchor_now":
      return {
        title: isZh ? "立即锚定工作道已清空" : "Anchor-now lane is clear",
        description: isZh
          ? "当前所有可见的 live dossier 都已经有第一次触达或带日期的下一触达锚点，因此这个路由可以安全地重新扩回更宽的队列。"
          : "Every visible live dossier already has a first touch or a dated next-touch anchor, so the route can safely widen back into the broader queue.",
      };
    case "viewing_lane":
      return {
        title: isZh ? "带看工作道已清空" : "Viewing lane is clear",
        description: isZh
          ? "当前没有任何可见 dossier 以带看或预约后续路径为主。"
          : "No visible dossier is currently leading with a showing or appointment-follow-through path.",
      };
    case "boundary_review":
      return {
        title: isZh ? "边界审查工作道已清空" : "Boundary-review lane is clear",
        description: isZh
          ? "当前没有任何可见 dossier 在谈判、报价或申请工作上活跃到需要优先进入 BO 边界审查。"
          : "No visible dossier is currently active enough in negotiation, offer, or application work to demand a BO-boundary review first.",
      };
    case "duplicate_review":
      return {
        title: isZh ? "重复审查工作道已清空" : "Duplicate-review lane is clear",
        description: isZh
          ? "当前没有任何可见 dossier 带着最强的重复配对信号，所以这个路由可以重新扩回完整执行队列。"
          : "No visible dossier is currently carrying the strongest pairwise duplicate signal, so the route can widen back into the full execution queue.",
      };
    default:
      return {
        title: isZh ? "当前没有实时客户队列" : "No live client queue",
        description: isZh
          ? `当前没有 dossier 匹配“${focusLabel}”，因为可见的 FO 队列仍然为空。`
          : `No dossier currently matches ${focusLabel.toLowerCase()} because the visible FO queue is still empty.`,
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
  const focusedQueueLeader = focusedExecutionQueue[0] ?? null;
  const queueEmptyState = buildClientWorkbenchQueueEmptyState(
    activeClientView,
    activeClientViewConfig.label,
    isZh,
  );
  const actNowCount = executionQueue.filter((client) => client.isUrgent).length;
  const cleanupCount =
    snapshot.summary.missingContactCount +
    snapshot.summary.missingNextTouchCount;
  const boundaryCount = snapshot.summary.boundaryReviewCount;
  const viewingCount = snapshot.summary.viewingLaneCount;
  const leaseWatchCount = snapshot.summary.leaseWatchCount;
  const topQueueClient = executionQueue[0] ?? null;
  const topCleanupClient =
    executionQueue.find((client) => client.needsCleanup) ?? null;
  const topBoundaryClient =
    executionQueue.find((client) => client.needsBoundaryReview) ?? null;
  const topDuplicatePair = snapshot.duplicatePairs[0] ?? null;
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
          ? `${snapshot.workspaceAnchor.description} 把 Clients 工作区当作实时队列来用，而不是被动列表；只有当当前工作道足够清晰时，才重新打开录入。`
          : `${snapshot.workspaceAnchor.description} Keep the Clients workspace as the live queue, not a passive list, and reopen intake only when the lane is clear enough for more work.`
      }
      eyebrow={isZh ? "客户" : "Clients"}
      main={
        <>
          <SectionCard
            className="office-list-card"
            actions={
              <>
                {buildClientWorkbenchViewActions(clientWorkbenchViews).map((viewAction) => (
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={viewAction.href}
                    key={viewAction.href}
                  >
                    {viewAction.label}
                  </FrontOfficeLink>
                ))}
              </>
            }
            subtitle={
              isZh
                ? `${snapshot.workspaceAnchor.contextLabel}。当前路由焦点：${activeClientViewConfig.label}。${activeClientViewConfig.subtitle}`
                : `${snapshot.workspaceAnchor.contextLabel}. Current route focus: ${activeClientViewConfig.label}. ${activeClientViewConfig.subtitle}`
            }
            title={isZh ? "今天的 FO 客户工作台" : "Today's FO clients workspace"}
          >
            <div className="office-queue-list">
              <QueueItem
                action={
                  <div className="list-row-meta front-office-record-meta">
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={snapshot.workspaceAnchor.primaryActionHref}
                    >
                      {snapshot.workspaceAnchor.primaryActionLabel}
                    </FrontOfficeLink>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={snapshot.workspaceAnchor.secondaryActionHref}
                    >
                      {snapshot.workspaceAnchor.secondaryActionLabel}
                    </FrontOfficeLink>
                  </div>
                }
                badgeLabel={snapshot.workspaceAnchor.label}
                badgeTone={snapshot.workspaceAnchor.tone}
                context={snapshot.workspaceAnchor.contextLabel}
                description={snapshot.workspaceAnchor.description}
                meta={
                  <div className="list-row-meta front-office-record-meta">
                    <span>
                      {snapshot.summary.liveContacts}{" "}
                      {isZh ? "个实时 dossier" : "live dossiers"}
                    </span>
                    <span>{activeClientViewConfig.label}</span>
                  </div>
                }
                title={isZh ? "工作区锚点" : "Workspace anchor"}
              />

              {focusedQueueLeader ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={focusedQueueLeader.primaryActionHref}
                      >
                        {focusedQueueLeader.primaryActionLabel}
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={buildClientWorkbenchHref(
                          activeClientView,
                          activeClientViewConfig.focusAnchor,
                        )}
                      >
                        {isZh ? "重新打开这个工作道" : "Reopen this lane"}
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel={activeClientViewConfig.label}
                  badgeTone={
                    activeClientView === "all"
                      ? "accent"
                      : focusedExecutionQueue.length
                        ? "warning"
                        : "neutral"
                  }
                  context={
                    activeClientView === "all"
                      ? isZh
                        ? "完整 FO 队列"
                        : "Full FO queue"
                      : isZh
                        ? `${focusedExecutionQueue.length} 个 dossier 在焦点中`
                        : `${focusedExecutionQueue.length} dossier(s) in focus`
                  }
                  description={
                    focusedQueueLeader
                      ? isZh
                        ? `${focusedQueueLeader.fullName} 是当前路由焦点下最明确的 dossier。${focusedQueueLeader.whyNow}`
                        : `${focusedQueueLeader.fullName} is the clearest dossier inside this route focus. ${focusedQueueLeader.whyNow}`
                      : `${activeClientViewConfig.subtitle} ${queueEmptyState.description}`
                  }
                  meta={
                    focusedQueueLeader ? (
                      <div className="list-row-meta front-office-record-meta">
                        <StatusBadge tone={focusedQueueLeader.stageTone}>
                          {focusedQueueLeader.stage}
                        </StatusBadge>
                        <span>{focusedQueueLeader.nextTouchLabel}</span>
                        <span>{focusedQueueLeader.anchorLabel}</span>
                      </div>
                    ) : (
                      <div className="list-row-meta front-office-record-meta">
                        <span>{activeClientViewConfig.label}</span>
                        <span>{queueEmptyState.title}</span>
                      </div>
                    )
                  }
                  title={isZh ? "当前路由焦点" : "Current route focus"}
                />
              ) : null}

              {topQueueClient ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topQueueClient.primaryActionHref}
                      >
                        {topQueueClient.primaryActionLabel}
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topQueueClient.reviewHref}
                      >
                        {isZh ? "打开 dossier" : "Open dossier"}
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel={isZh ? "优先跟进" : "Follow first"}
                  badgeTone={topQueueClient.queueTone}
                  context={`${isZh ? "队列" : "Queue"} ${topQueueClient.queueOrder} · ${topQueueClient.anchorLabel}`}
                  description={topQueueClient.whyNow}
                  meta={
                    <div className="list-row-meta front-office-record-meta">
                      <StatusBadge tone={topQueueClient.stageTone}>
                        {topQueueClient.stage}
                      </StatusBadge>
                      <span>{topQueueClient.nextTouchLabel}</span>
                      <span>{topQueueClient.lastTouchLabel}</span>
                    </div>
                  }
                  title={topQueueClient.fullName}
                />
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description={
                    isZh
                      ? "一旦有 live dossier 进入队列，第一次触达顺序就会显示在这里。"
                      : "The first-touch order will appear here as soon as live dossiers enter the queue."
                  }
                  title={isZh ? "还没有队列领头记录" : "No queue leader yet"}
                />
              )}

              {topCleanupClient ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topCleanupClient.primaryActionHref}
                      >
                        {topCleanupClient.primaryActionLabel}
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topCleanupClient.reviewHref}
                      >
                        {isZh ? "打开 dossier" : "Open dossier"}
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel={isZh ? "锚定下一步" : "Anchor next"}
                  badgeTone="warning"
                  context={`${isZh ? "队列" : "Queue"} ${topCleanupClient.queueOrder} · ${topCleanupClient.anchorLabel}`}
                  description={
                    isZh
                      ? "当某个 dossier 缺少第一次触达或缺少带日期的下一触达时，就走这条工作道。"
                      : "Use this lane when a dossier is missing a first touch or a dated next touch."
                  }
                  meta={
                    <div className="list-row-meta front-office-record-meta">
                      <StatusBadge tone={topCleanupClient.stageTone}>
                        {topCleanupClient.stage}
                      </StatusBadge>
                      <span>{topCleanupClient.nextTouchLabel}</span>
                      <span>{topCleanupClient.sourceLabel}</span>
                    </div>
                  }
                  title={topCleanupClient.fullName}
                />
              ) : (
                <QueueItem
                  badgeLabel={isZh ? "锚点已清空" : "Anchor clear"}
                  badgeTone="success"
                  description={
                    isZh
                      ? "所有可见的 live dossier 都已经有第一次触达记录或带日期的下一触达锚点。"
                      : "Every visible live dossier already has a first-touch log or dated next-touch anchor."
                  }
                  title={isZh ? "锚点工作道已清空" : "Anchor lane is clear"}
                />
              )}

              {topDuplicatePair ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={buildClientWorkbenchHref(
                          "duplicate_review",
                          buildDuplicatePairAnchorId(topDuplicatePair.id),
                        )}
                      >
                        {isZh ? "查看这一对" : "Review pair"}
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topDuplicatePair.recommendedClient.href}
                      >
                        {isZh ? "打开保留 dossier" : "Open keep dossier"}
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel={isZh ? "下一步合并" : "Merge next"}
                  badgeTone="warning"
                  context={topDuplicatePair.matchReasons.join(" · ")}
                  description={buildDuplicateBoardDescription(topDuplicatePair, isZh)}
                  meta={
                    <div className="list-row-meta front-office-record-meta">
                      <span>
                        Keep {topDuplicatePair.recommendedClient.fullName}
                      </span>
                      <span>
                        {isZh ? "合并" : "Merge"} {topDuplicatePair.duplicateClient.fullName}
                      </span>
                    </div>
                  }
                  title={isZh ? "下一条应该审查的重复记录工作道" : "Duplicate lane that should be reviewed next"}
                />
              ) : (
                <QueueItem
                  badgeLabel={isZh ? "合并已清空" : "Merge clear"}
                  badgeTone="success"
                  description={
                    isZh
                      ? "当前没有任何可见的成对重复建议在等待处理。"
                      : "No visible pairwise duplicate suggestion is waiting right now."
                  }
                  title={isZh ? "重复工作道已清空" : "Duplicate lane is clear"}
                />
              )}

              {topDuplicatePair ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={snapshot.workspaceAnchor.returnSectionHref}
                      >
                        {snapshot.workspaceAnchor.returnSectionLabel}
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={snapshot.workspaceAnchor.returnHref}
                      >
                        {snapshot.workspaceAnchor.returnLabel}
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel={isZh ? "合并后返回" : "Merge return"}
                  badgeTone="accent"
                  context={snapshot.workspaceAnchor.label}
                  description={snapshot.workspaceAnchor.returnDescription}
                  meta={
                    <>
                      <div className="list-row-meta front-office-record-meta">
                        <span>{snapshot.workspaceAnchor.contextLabel}</span>
                        <span>{snapshot.workspaceAnchor.description}</span>
                      </div>
                      <div className="list-row-meta front-office-record-meta">
                        <span>
                          {snapshot.workspaceAnchor.returnSectionDescription}
                        </span>
                      </div>
                    </>
                  }
                  title={isZh ? "合并后的清理回入口" : "Cleanup re-entry after merge"}
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            id={clientListSectionIds.executionQueue}
            actions={
              <>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={buildClientWorkbenchHref(
                    "duplicate_review",
                    clientListSectionIds.duplicateReview,
                  )}
                >
                  {isZh ? "查看重复记录" : "Review duplicates"}
                </FrontOfficeLink>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={buildClientWorkbenchHref(
                    "anchor_now",
                    clientListSectionIds.intakeLaunch,
                  )}
                >
                  {isZh ? "打开录入辅助" : "Open intake assist"}
                </FrontOfficeLink>
              </>
            }
            className="office-list-card"
            subtitle={
              isZh
                ? `队列顺序始终以执行优先：逾期下一触达、缺少锚点、带看协调、重复审查信号和 BO 就绪阶段审查都会保持可见，同时不会假装 Acre 已经具备自动发送、隐藏自动化或双向同步。工作区锚点：${snapshot.workspaceAnchor.label}。当前路由焦点：${activeClientViewConfig.label}。`
                : `Queue order stays execution-first: overdue next touches, missing anchors, viewing coordination, duplicate review signals, and BO-ready stage review all stay visible without pretending Acre already has auto-send, hidden automation, or two-way sync. Workspace anchor: ${snapshot.workspaceAnchor.label}. Current route focus: ${activeClientViewConfig.label}.`
            }
            title={isZh ? "客户执行队列" : "Client execution queue"}
          >
            <ListPageStatsGrid>
              <StatCard
                hint={
                  isZh
                    ? "下一次触达已经到期或逾期的 dossier"
                    : "dossiers whose next touch is already due or overdue"
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
                    ? "应优先重新打开预约工作道的带看或看房记录"
                    : "showing or viewing records that should reopen the appointment lane first"
                }
                label={isZh ? "带看工作道" : "Viewing lane"}
                value={viewingCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "已经正式到需要按 FO -> BO 边界审查的阶段"
                    : "stages that are formal enough to review against the FO -> BO boundary"
                }
                label={isZh ? "BO 边界" : "BO boundary"}
                value={boundaryCount}
              />
              <StatCard
                hint={
                  isZh
                    ? "已进入活跃期但尚未逾期的租约或续租窗口"
                    : "lease or renewal windows that are active but not yet overdue"
                }
                label={isZh ? "租约观察" : "Lease watch"}
                value={leaseWatchCount}
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

            <div className="list-row-meta front-office-record-meta">
              <span>{buildStageSummaryLabel(snapshot.stageMetrics, isZh)}</span>
            </div>

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
                        {client.duplicateSignal ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={client.duplicateSignal.pairHref}
                          >
                            {isZh ? "查看重复工作道" : "Review duplicate lane"}
                          </FrontOfficeLink>
                        ) : null}
                      </div>
                    }
                    badgeLabel={client.queueLabel}
                    badgeTone={client.queueTone}
                    context={`${isZh ? "队列" : "Queue"} ${client.queueOrder} · ${client.anchorLabel}`}
                    description={client.whyNow}
                    key={client.id}
                    meta={
                      <>
                        <div className="list-row-meta front-office-record-meta">
                          <StatusBadge tone={client.stageTone}>
                            {client.stage}
                          </StatusBadge>
                      <span>{isZh ? "锚点" : "Anchor"} · {client.anchorLabel}</span>
                      {client.duplicateSignal ? (
                        <span>
                              {isZh ? "重复审查" : "Duplicate review"} ·{" "}
                              {client.duplicateSignal.roleLabel}
                        </span>
                      ) : null}
                        </div>
                        <div className="list-row-meta front-office-record-meta">
                          <span>{client.nextTouchLabel}</span>
                          <span>{client.lastTouchLabel}</span>
                          {client.duplicateSignal ? (
                            <span>
                              {client.duplicateSignal.matchSummary} ·{" "}
                              {client.duplicateSignal.roleLabel}{" "}
                              {isZh ? "对应" : "with"}{" "}
                              {client.duplicateSignal.partnerName}
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
          ) : (
            <SectionCard
              id={clientListSectionIds.duplicateReview}
              className="office-list-card"
              subtitle={
                isZh
                  ? "即使 Acre 当前看不到任何成对重复，这个锚点也会保持稳定，所以录入预警和仪表盘里的复查跳转都能把你带回同一个清理工作道。"
                  : "This anchor stays stable even when Acre does not see any pairwise duplicates right now, so intake warnings and dashboard review jumps can always send you back to the same cleanup lane."
              }
              title={isZh ? "重复审查工作道" : "Duplicate review lane"}
            >
              <EmptyState
                description={
                  isZh
                    ? "当前这个客户范围里没有可见的成对重复建议。"
                    : "No pairwise duplicate suggestions are visible in this client scope right now."
                }
                title={isZh ? "重复工作道已清空" : "Duplicate lane is clear"}
              />
            </SectionCard>
          )}

          <div id={clientListSectionIds.intakeLaunch}>
            <FrontOfficeLeadIntakeCard
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="clients"
              subtitle={
                isZh
                  ? "只有当实时队列已经清理到足够能接纳新工作时，再重新打开录入。录入卡始终保持审查优先，不会声称已有 provider 级导入、隐藏自动化或自动发送。"
                  : "Only reopen intake after the live queue is clear enough to add new work. The intake card stays review-first and never claims provider-backed ingestion, hidden automation, or auto-send."
              }
              title={isZh ? "开始或继续录入复核" : "Start or continue intake review"}
            />
          </div>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "让路由保持一眼可读：先跟进，再补锚点；需要时审查正式阶段边界；重复记录一次只处理一对。"
                : "Keep the routing obvious: follow first, anchor next, review formal-stage boundary when needed, and handle one duplicate pair at a time."
            }
            title={isZh ? "快速路由" : "Quick routing"}
          >
            <div className="office-queue-list">
              {topQueueClient ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={topQueueClient.primaryActionHref}
                    >
                      {topQueueClient.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  badgeLabel={topQueueClient.queueLabel}
                  badgeTone={topQueueClient.queueTone}
                  context={`${isZh ? "队列" : "Queue"} ${topQueueClient.queueOrder} · ${topQueueClient.anchorLabel}`}
                  description={topQueueClient.whyNow}
                  meta={
                    <span>
                      {topQueueClient.fullName} ·{" "}
                      {topQueueClient.nextTouchLabel}
                    </span>
                  }
                  title={
                    isZh
                      ? `优先跟进 ${topQueueClient.fullName}`
                      : `Follow ${topQueueClient.fullName} first`
                  }
                />
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description={
                    isZh
                      ? "当实时客户 dossier 进入队列后，首次触达顺序会显示在这里。"
                      : "The first-touch order will appear here when live client dossiers are in queue."
                  }
                  title={isZh ? "还没有队列领头记录" : "No queue leader yet"}
                />
              )}

              {topCleanupClient ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={topCleanupClient.primaryActionHref}
                    >
                      {topCleanupClient.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  badgeLabel={isZh ? "锚点" : "Anchor"}
                  badgeTone="warning"
                  context={`${isZh ? "队列" : "Queue"} ${topCleanupClient.queueOrder} · ${topCleanupClient.anchorLabel}`}
                  description={
                    isZh
                      ? "当某个 dossier 缺少首次触达或缺少带日期的下一次触达时，就走这条工作道。"
                      : "Use this lane when a dossier is missing a first touch or a dated next touch."
                  }
                  meta={
                    <span>
                      {topCleanupClient.fullName} ·{" "}
                      {topCleanupClient.nextTouchLabel}
                    </span>
                  }
                  title={
                    isZh
                      ? `下一步先锚定 ${topCleanupClient.fullName}`
                      : `Anchor ${topCleanupClient.fullName} next`
                  }
                />
              ) : null}

              {topBoundaryClient ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={topBoundaryClient.primaryActionHref}
                    >
                      {topBoundaryClient.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  badgeLabel={isZh ? "边界" : "Boundary"}
                  badgeTone="warning"
                  context={`${isZh ? "队列" : "Queue"} ${topBoundaryClient.queueOrder} · ${topBoundaryClient.anchorLabel}`}
                  description={
                    isZh
                      ? "当 dossier 已进入正式阶段时，应通过 BO 边界审查，而不是把 FO 队列变成第二套报价或合同系统。"
                      : "Review formal-stage dossiers through the BO boundary instead of turning the FO queue into a second offer or contract system."
                  }
                  meta={
                    <span>
                      {topBoundaryClient.fullName} · {topBoundaryClient.stage}
                    </span>
                  }
                  title={
                    isZh
                      ? `审查 ${topBoundaryClient.fullName} 的 BO 交接`
                      : `Review ${topBoundaryClient.fullName} for BO handoff`
                  }
                />
              ) : null}

              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={
                      topDuplicatePair
                        ? buildClientWorkbenchHref(
                            "duplicate_review",
                            buildDuplicatePairAnchorId(topDuplicatePair.id),
                          )
                        : buildClientWorkbenchHref(
                            "duplicate_review",
                            clientListSectionIds.duplicateReview,
                          )
                    }
                  >
                    {topDuplicatePair
                      ? isZh
                        ? "审查下一对"
                        : "Review next pair"
                      : isZh
                        ? "打开重复工作道"
                        : "Open duplicate lane"}
                  </FrontOfficeLink>
                }
                badgeLabel={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? isZh
                      ? "合并"
                      : "Merge"
                    : isZh
                      ? "已清空"
                      : "Clear"
                }
                badgeTone={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? "warning"
                    : "neutral"
                }
                context={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? isZh
                      ? `${snapshot.summary.potentialDuplicateCount} 对待处理`
                      : `${snapshot.summary.potentialDuplicateCount} pair(s) waiting`
                    : isZh
                      ? "当前视图中没有成对重复记录"
                      : "No pairwise duplicates in view"
                }
                description={
                  topDuplicatePair
                    ? buildDuplicateBoardDescription(topDuplicatePair, isZh)
                    : isZh
                      ? "重复清理始终保持审查优先：先对比 dossier，确认保留记录，再在你确认无误时执行合并。"
                      : "Duplicate cleanup stays review-first: compare dossiers, confirm the surviving record, and merge only when you are comfortable with the keep choice."
                }
                meta={
                  <span>
                    {topDuplicatePair
                      ? isZh
                        ? `保留 ${topDuplicatePair.recommendedClient.fullName} · 合并 ${topDuplicatePair.duplicateClient.fullName}`
                        : `Keep ${topDuplicatePair.recommendedClient.fullName} · Merge ${topDuplicatePair.duplicateClient.fullName}`
                      : isZh
                        ? "合并不会生成任何隐藏的 BO 记录。"
                        : "Merge never creates a hidden BO record."}
                  </span>
                }
                title={
                  topDuplicatePair
                    ? isZh
                      ? "下一对待审查的重复记录"
                      : "Duplicate pair waiting next"
                    : isZh
                      ? "让重复审查保持显式"
                      : "Keep duplicate review explicit"
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "这些规则让 `/agent/clients` 始终符合 FO brief：先保证队列可读，再处理正式 BO 交接，中间不假装存在自动化。"
                : "These rules keep `/agent/clients` aligned to the FO brief: readable queue first, formal BO handoff second, and no fake automation in between."
            }
            title={isZh ? "执行规则" : "Execution rules"}
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel={isZh ? "队列" : "Queue"}
                badgeTone="accent"
                description={
                  isZh
                    ? "谁该先联系，应该能从下一触达压力、缺失锚点、阶段上下文和可见重复风险中直接读出来，而不必先打开完整管理表单。"
                    : "Who to touch first should be readable from next-touch pressure, missing anchors, stage context, and visible duplicate risk without opening a full admin form."
                }
                title={isZh ? "列表顺序必须保持执行导向" : "List order must stay operational"}
              />
              <FrontOfficeRailItem
                badgeLabel={isZh ? "边界" : "Boundary"}
                badgeTone="warning"
                description={
                  isZh
                    ? "谈判、申请、报价和合同阶段一旦进入正式流程，就应指向 Back Office。Front Office 保留的是面向客户的执行上下文，而不是最终正式记录。"
                    : "Negotiation, application, offer, and contract-era work should point into Back Office when it becomes formal. Front Office keeps the client-facing execution context, not the final record."
                }
                title={isZh ? "FO -> BO 边界必须保持显式" : "FO -> BO boundary stays explicit"}
              />
              <FrontOfficeRailItem
                badgeLabel={isZh ? "安全" : "Safe"}
                badgeTone="neutral"
                description={
                  isZh
                    ? "这个页面只应该暴露审查跳转和队列锚点，不能假装 Acre 已有 provider 级导入、双向同步、微信集成或自动发送。"
                    : "This page should surface review jumps and queue anchors only. It must not pretend Acre already has provider-backed ingestion, two-way sync, WeChat integration, or auto-send."
                }
                title={isZh ? "不允许隐藏式自动化表述" : "No hidden automation claims"}
              />
            </div>
          </SectionCard>
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
            label={isZh ? "工作区锚点" : "Workspace anchor"}
            tone="accent"
            value={snapshot.workspaceAnchor.label}
          />
          <SummaryChip
            label={isZh ? "清理回入口" : "Cleanup re-entry"}
            tone="accent"
            value={snapshot.workspaceAnchor.returnLabel}
          />
          <SummaryChip
            label={isZh ? "返回区段" : "Return section"}
            tone="accent"
            value={snapshot.workspaceAnchor.returnSectionLabel}
          />
          <SummaryChip
            label={isZh ? "立即锚定" : "Anchor now"}
            tone="accent"
            value={cleanupCount}
          />
          {activeClientView !== "all" ? (
            <SummaryChip
              label={
                isZh
                  ? `${activeClientViewConfig.label} 焦点中`
                  : `${activeClientViewConfig.label} in focus`
              }
              tone="accent"
              value={focusedExecutionQueue.length}
            />
          ) : null}
          <SummaryChip
            label={isZh ? "带看工作道" : "Viewing lane"}
            value={viewingCount}
          />
          <SummaryChip
            label={isZh ? "BO 边界" : "BO boundary"}
            value={boundaryCount}
          />
          <SummaryChip
            label={isZh ? "重复审查" : "Duplicate review"}
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
          <SummaryChip
            label={isZh ? "实时 dossier" : "Live dossiers"}
            value={snapshot.summary.liveContacts}
          />
          <SummaryChip label={isZh ? "访问级别" : "Access"} value={access.label} />
        </>
      }
      title={isZh ? "客户执行队列" : "Client execution queue"}
    />
  );
}
