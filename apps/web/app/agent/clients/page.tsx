import { can, getDefaultAppPath } from "@acre/auth";
import {
  getFrontOfficeClientsSnapshot,
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

const clientListSectionIds = {
  intakeLaunch: "clients-intake-launch",
  executionQueue: "client-execution-queue",
  duplicateReview: "duplicate-review",
} as const;

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

type ClientExecutionQueueItem = FrontOfficeClientRecord & {
  priorityScore: number;
  queueOrder: number;
  queueLabel: string;
  queueTone: QueueBadgeTone;
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
};

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
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

function buildClientQueueDescriptor(
  client: FrontOfficeClientRecord,
): Omit<ClientExecutionQueueItem, keyof FrontOfficeClientRecord | "queueOrder"> {
  const urgent = isUrgentNextTouch(client.nextTouchLabel);
  const leaseAnchored = isLeaseAnchored(client.nextTouchLabel);
  const missingNextTouch = isMissingNextTouch(client.nextTouchLabel);
  const missingContact = isMissingContact(client.lastTouchLabel);
  const viewingLane = isViewingLane(client.stage);
  const boundaryStage = isBoundaryStage(client.stage);
  const closedStage = isClosedStage(client.stage);
  const intakeStage = intakeReviewStages.has(client.stage);

  let priorityScore = 0;
  let queueLabel = "Keep moving";
  let queueTone: QueueBadgeTone = "accent";
  let whyNow =
    "This dossier is still in the active Front Office lane and should keep a visible next move.";
  let primaryActionHref = `${client.href}${clientDossierAnchors.nextStepRail}`;
  let primaryActionLabel = intakeStage
    ? "Continue dossier review"
    : "Review next-step rail";

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
    queueLabel = "Act now";
    queueTone = "danger";
    whyNow = leaseAnchored
      ? "The lease or remarketing reminder is already active, so this client should stay ahead of stage-only cleanup."
      : "The next touch is already due, so this dossier belongs at the front of today's FO queue.";
    primaryActionHref = leaseAnchored
      ? `${client.href}${clientDossierAnchors.leaseReminderForm}`
      : `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = leaseAnchored
      ? "Review lease touch"
      : "Plan next touch";
  } else if (missingNextTouch || missingContact) {
    queueLabel = missingContact ? "Make first touch" : "Clean next touch";
    queueTone = "warning";
    whyNow = missingContact
      ? "No contact is logged yet, so first-touch work should stay explicit instead of hiding inside a stage label."
      : "This active dossier has no dated next touch, so it can fall out of the FO queue unless you anchor it now.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = missingContact
      ? "Plan first touch"
      : "Anchor next touch";
  } else if (boundaryStage) {
    queueLabel = "Review BO boundary";
    queueTone = "warning";
    whyNow =
      "Negotiation, offer, or application work is active, so the next official record should be reviewed through the Back Office boundary instead of duplicating formal workflow here.";
    primaryActionHref = `${client.href}${clientDossierAnchors.backOfficeContext}`;
    primaryActionLabel = "Review BO handoff";
  } else if (viewingLane) {
    queueLabel = "Coordinate viewing";
    queueTone = "accent";
    whyNow =
      "Showing and viewing coordination is the live lane, so appointment timing, confirmation, and follow-up should stay easy to reopen.";
    primaryActionHref = `${client.href}${clientDossierAnchors.appointmentsFollowUp}`;
    primaryActionLabel = "Review appointments";
  } else if (leaseAnchored) {
    queueLabel = "Watch renewal window";
    queueTone = "accent";
    whyNow =
      "Lease timing is the active anchor here, so renewal or remarketing planning should stay visible in the same FO dossier.";
    primaryActionHref = `${client.href}${clientDossierAnchors.leaseReminderForm}`;
    primaryActionLabel = "Open lease reminder";
  } else if (closedStage) {
    queueLabel = "Closeout / nurture";
    queueTone = "neutral";
    whyNow =
      "Outcome context is already on record, so only closeout, recap, or respectful nurture should stay in Front Office.";
    primaryActionHref = `${client.href}${clientDossierAnchors.closingSuggestion}`;
    primaryActionLabel = "Review outcome follow-through";
  } else if (intakeStage) {
    queueLabel = "Continue intake";
    queueTone = "accent";
    whyNow =
      "Early-stage intake is still active, so the next move should stay explicit instead of turning the client list into a passive summary.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = "Continue intake review";
  }

  return {
    priorityScore,
    queueLabel,
    queueTone,
    whyNow,
    primaryActionHref,
    primaryActionLabel,
    reviewHref: client.href,
    reviewLabel: intakeStage ? "Open overview" : "Open dossier",
    isUrgent: urgent,
    needsCleanup: missingNextTouch || missingContact || leaseAnchored,
    needsBoundaryReview: boundaryStage,
    isLeaseAnchored: leaseAnchored,
    isViewingLane: viewingLane,
    isClosedStage: closedStage,
  };
}

function buildClientExecutionQueue(
  clients: FrontOfficeClientRecord[],
): ClientExecutionQueueItem[] {
  return clients
    .map((client, index) => ({
      ...client,
      ...buildClientQueueDescriptor(client),
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
  stageMetrics: Awaited<ReturnType<typeof getFrontOfficeClientsSnapshot>>["stageMetrics"],
) {
  if (!stageMetrics.length) {
    return "No live stage mix yet.";
  }

  return stageMetrics
    .map((metric) => `${metric.label} · ${metric.count}`)
    .join(" · ");
}

export default async function AgentClientsPage() {
  const context = await requireSessionContext();

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
  const executionQueue = buildClientExecutionQueue(snapshot.clients);
  const actNowCount = executionQueue.filter((client) => client.isUrgent).length;
  const cleanupCount = executionQueue.filter((client) => client.needsCleanup).length;
  const boundaryCount = executionQueue.filter(
    (client) => client.needsBoundaryReview,
  ).length;
  const viewingCount = executionQueue.filter(
    (client) => client.isViewingLane,
  ).length;
  const closedStageCount = executionQueue.filter(
    (client) => client.isClosedStage,
  ).length;
  const topQueueClient = executionQueue[0] ?? null;
  const topCleanupClient =
    executionQueue.find((client) => client.needsCleanup) ?? null;
  const topBoundaryClient =
    executionQueue.find((client) => client.needsBoundaryReview) ?? null;
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
      description="Use this page as the real FO CRM workbench: queue the next touch, reopen the exact dossier block that matches the work, and clear duplicate risk before it turns into formal Back Office friction."
      eyebrow="Clients"
      main={
        <>
          <div id={clientListSectionIds.intakeLaunch}>
            <FrontOfficeLeadIntakeCard
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="clients"
              subtitle="Start a new lead or reopen a screenshot / transcript extract that still has review-pending suggestions. The intake card stays review-first and never claims provider-backed ingestion, hidden automation, or auto-send."
              title="Start or continue intake review"
            />
          </div>

          <SectionCard
            id={clientListSectionIds.executionQueue}
            actions={
              <>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={`#${clientListSectionIds.intakeLaunch}`}
                >
                  Open intake assist
                </FrontOfficeLink>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={`#${clientListSectionIds.duplicateReview}`}
                >
                  Review duplicates
                </FrontOfficeLink>
              </>
            }
            className="office-list-card"
            subtitle="Queue order stays execution-first: overdue touches, missing anchors, viewing coordination, and BO-ready stage review all stay visible without pretending Acre already has auto-send, hidden automation, or two-way sync."
            title="Client execution queue"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="dossiers whose next touch is already due now"
                label="Act now"
                tone="accent"
                value={actNowCount}
              />
              <StatCard
                hint="records that need a visible first-touch, next-touch, or lease anchor"
                label="Needs cleanup"
                tone="accent"
                value={cleanupCount}
              />
              <StatCard
                hint="showing or viewing records that should reopen the appointment lane first"
                label="Viewing lane"
                value={viewingCount}
              />
              <StatCard
                hint="stages that are formal enough to review against the FO -> BO boundary"
                label="BO boundary"
                value={boundaryCount}
              />
              <StatCard
                hint="outcome-stage dossiers still visible for nurture or wrap-up"
                label="Closed / nurture"
                value={closedStageCount}
              />
              <StatCard
                hint="pairwise duplicate review suggestions across the CRM records visible to you"
                label="Duplicate review"
                tone="accent"
                value={snapshot.summary.potentialDuplicateCount}
              />
            </ListPageStatsGrid>

            <div className="list-row-meta front-office-record-meta">
              <span>{buildStageSummaryLabel(snapshot.stageMetrics)}</span>
            </div>

            <div className="office-queue-list">
              {executionQueue.length ? (
                executionQueue.map((client) => (
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
                    badge={
                      <StatusBadge tone={client.stageTone}>
                        {client.stage}
                      </StatusBadge>
                    }
                    context={`Queue ${client.queueOrder} · ${client.queueLabel}`}
                    description={client.whyNow}
                    key={client.id}
                    meta={
                      <div className="list-row-meta front-office-record-meta">
                        <span>
                          {client.intentLabel} · {client.budgetLabel}
                        </span>
                        <span>{client.areasLabel}</span>
                        <span>{client.sourceLabel}</span>
                        <span>{client.lastTouchLabel}</span>
                        <span>{client.nextTouchLabel}</span>
                      </div>
                    }
                    title={client.fullName}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={`#${clientListSectionIds.intakeLaunch}`}
                    >
                      Launch intake assist
                    </FrontOfficeLink>
                  }
                  description="When Front Office starts using the shared CRM as the active client queue, the next-touch order will appear here."
                  title="No live client queue"
                />
              )}
            </div>
          </SectionCard>

          {snapshot.duplicatePairs.length ? (
            <FrontOfficeClientDuplicatesCard
              duplicatePairs={snapshot.duplicatePairs}
            />
          ) : (
            <SectionCard
              id={clientListSectionIds.duplicateReview}
              className="office-list-card"
              subtitle="This anchor stays stable even when Acre does not see any pairwise duplicates right now, so intake warnings and dashboard review jumps can always send you back to the same cleanup lane."
              title="Duplicate review lane"
            >
              <EmptyState
                description="No pairwise duplicate suggestions are visible in this client scope right now."
                title="Duplicate lane is clear"
              />
            </SectionCard>
          )}
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Keep the daily decision obvious: who to contact first, which dossier needs cleanup next, and where duplicate review or BO boundary review should happen."
            title="Today's operating order"
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
                  context={`Queue ${topQueueClient.queueOrder}`}
                  description={topQueueClient.whyNow}
                  meta={
                    <span>
                      {topQueueClient.fullName} · {topQueueClient.nextTouchLabel}
                    </span>
                  }
                  title={`Follow ${topQueueClient.fullName} first`}
                />
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="The first-touch order will appear here when live client dossiers are in queue."
                  title="No queue leader yet"
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
                  badgeLabel="Cleanup"
                  badgeTone="warning"
                  context={`Queue ${topCleanupClient.queueOrder}`}
                  description="Use this lane when a dossier is missing a first touch, a dated next touch, or a visible lease / renewal anchor."
                  meta={
                    <span>
                      {topCleanupClient.fullName} ·{" "}
                      {topCleanupClient.nextTouchLabel}
                    </span>
                  }
                  title={`Clean ${topCleanupClient.fullName} next`}
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
                  badgeLabel="Boundary"
                  badgeTone="warning"
                  context={`Queue ${topBoundaryClient.queueOrder}`}
                  description="Review formal-stage dossiers through the BO boundary instead of turning the FO queue into a second offer or contract system."
                  meta={
                    <span>
                      {topBoundaryClient.fullName} · {topBoundaryClient.stage}
                    </span>
                  }
                  title={`Review ${topBoundaryClient.fullName} for BO handoff`}
                />
              ) : null}

              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={`#${clientListSectionIds.duplicateReview}`}
                  >
                    Open duplicate lane
                  </FrontOfficeLink>
                }
                badgeLabel={
                  snapshot.summary.potentialDuplicateCount > 0 ? "Merge" : "Clear"
                }
                badgeTone={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? "warning"
                    : "neutral"
                }
                context={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? `${snapshot.summary.potentialDuplicateCount} pair(s) waiting`
                    : "No pairwise duplicates in view"
                }
                description="Duplicate cleanup stays review-first: compare dossiers, confirm the surviving record, and merge only when you are comfortable with the keep choice."
                meta={<span>Merge never creates a hidden BO record.</span>}
                title="Keep duplicate review explicit"
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These rules keep `/agent/clients` aligned to the FO brief: readable queue first, formal BO handoff second, and no fake automation in between."
            title="Execution rules"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Queue"
                badgeTone="accent"
                description="Who to touch first should be readable from next-touch pressure, missing anchors, and stage context without opening a full admin form."
                title="List order must stay operational"
              />
              <FrontOfficeRailItem
                badgeLabel="Boundary"
                badgeTone="warning"
                description="Negotiation, application, offer, and contract-era work should point into Back Office when it becomes formal. Front Office keeps the client-facing execution context, not the final record."
                title="FO -> BO boundary stays explicit"
              />
              <FrontOfficeRailItem
                badgeLabel="Safe"
                badgeTone="neutral"
                description="This page should surface review jumps and queue anchors only. It must not pretend Acre already has provider-backed ingestion, two-way sync, WeChat integration, or auto-send."
                title="No hidden automation claims"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Act now" tone="accent" value={actNowCount} />
          <SummaryChip label="Needs cleanup" tone="accent" value={cleanupCount} />
          <SummaryChip label="BO boundary" value={boundaryCount} />
          <SummaryChip
            label="Duplicate review"
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
          <SummaryChip label="Live contacts" value={snapshot.summary.liveContacts} />
          <SummaryChip label="Access" value={access.label} />
        </>
      }
      title="Client execution queue"
    />
  );
}
