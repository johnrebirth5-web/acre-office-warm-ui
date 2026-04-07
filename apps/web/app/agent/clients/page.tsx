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
) {
  const signals = new Map<string, DuplicateClientSignal>();

  for (const pair of duplicatePairs) {
    const pairHref = `#${buildDuplicatePairAnchorId(pair.id)}`;
    const matchSummary = pair.matchReasons.join(" · ");

    if (!signals.has(pair.recommendedClient.id)) {
      signals.set(pair.recommendedClient.id, {
        pairHref,
        roleLabel: "Keep candidate",
        roleTone: "accent",
        partnerName: pair.duplicateClient.fullName,
        matchSummary,
        rationaleLabel: pair.rationaleLabel,
      });
    }

    if (!signals.has(pair.duplicateClient.id)) {
      signals.set(pair.duplicateClient.id, {
        pairHref,
        roleLabel: "Merge review",
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
  let queueLabel = "Keep moving";
  let queueTone: QueueBadgeTone = "accent";
  let anchorLabel = intakeStage ? "Intake review" : "Next-step rail";
  let whyNow =
    "This dossier is still in the active Front Office lane and should keep a visible next move.";
  let primaryActionHref = `${client.href}${clientDossierAnchors.nextStepRail}`;
  let primaryActionLabel = intakeStage ? "Continue intake" : "Review next step";

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
    queueLabel = "Follow first";
    queueTone = "danger";
    anchorLabel = leaseAnchored
      ? "Lease reminder overdue"
      : "Next touch overdue";
    whyNow = leaseAnchored
      ? "The lease or remarketing reminder is already active, so this client should stay ahead of stage-only cleanup."
      : "The next touch is already due, so this dossier belongs at the front of today's FO queue.";
    primaryActionHref = leaseAnchored
      ? `${client.href}${clientDossierAnchors.leaseReminderForm}`
      : `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = leaseAnchored
      ? "Open lease reminder"
      : "Open follow-up form";
  } else if (missingNextTouch || missingContact) {
    queueLabel = "Anchor now";
    queueTone = "warning";
    anchorLabel = missingContact
      ? "First touch missing"
      : "No dated next touch";
    whyNow = missingContact
      ? "No contact is logged yet, so first-touch work should stay explicit instead of hiding inside a stage label."
      : "This active dossier has no dated next touch, so it can fall out of the FO queue unless you anchor it now.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = missingContact
      ? "Plan first touch"
      : "Anchor next touch";
  } else if (boundaryStage) {
    queueLabel = "Review BO";
    queueTone = "warning";
    anchorLabel = "BO boundary review";
    whyNow =
      "Negotiation, offer, or application work is active, so the next official record should be reviewed through the Back Office boundary instead of duplicating formal workflow here.";
    primaryActionHref = `${client.href}${clientDossierAnchors.backOfficeContext}`;
    primaryActionLabel = "Review BO handoff";
  } else if (viewingLane) {
    queueLabel = "Viewing lane";
    queueTone = "accent";
    anchorLabel = "Appointment follow-up";
    whyNow =
      "Showing and viewing coordination is the live lane, so appointment timing, confirmation, and follow-up should stay easy to reopen.";
    primaryActionHref = `${client.href}${clientDossierAnchors.appointmentsFollowUp}`;
    primaryActionLabel = "Review appointments";
  } else if (leaseAnchored) {
    queueLabel = "Lease watch";
    queueTone = "accent";
    anchorLabel = "Renewal / lease anchor";
    whyNow =
      "Lease timing is the active anchor here, so renewal or remarketing planning should stay visible in the same FO dossier.";
    primaryActionHref = `${client.href}${clientDossierAnchors.leaseReminderForm}`;
    primaryActionLabel = "Open lease reminder";
  } else if (closedStage) {
    queueLabel = "Nurture";
    queueTone = "neutral";
    anchorLabel = "Outcome follow-through";
    whyNow =
      "Outcome context is already on record, so only closeout, recap, or respectful nurture should stay in Front Office.";
    primaryActionHref = `${client.href}${clientDossierAnchors.closingSuggestion}`;
    primaryActionLabel = "Review outcome follow-through";
  } else if (intakeStage) {
    queueLabel = "Intake";
    queueTone = "accent";
    anchorLabel = "Intake follow-up";
    whyNow =
      "Early-stage intake is still active, so the next move should stay explicit instead of turning the client list into a passive summary.";
    primaryActionHref = `${client.href}${clientDossierAnchors.followUpForm}`;
    primaryActionLabel = "Continue intake review";
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
    reviewLabel: "Open dossier",
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
): ClientExecutionQueueItem[] {
  return clients
    .map((client, index) => ({
      ...client,
      ...buildClientQueueDescriptor(
        client,
        duplicateSignals.get(client.id) ?? null,
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
) {
  if (!stageMetrics.length) {
    return "No live stage mix yet.";
  }

  return stageMetrics
    .map((metric) => `${metric.label} · ${metric.count}`)
    .join(" · ");
}

function buildDuplicateBoardDescription(pair: FrontOfficeClientDuplicatePair) {
  return `${pair.rationaleLabel} Merge ${pair.duplicateClient.fullName} only after you confirm both dossiers side by side.`;
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
  const duplicateSignals = buildDuplicateClientSignals(snapshot.duplicatePairs);
  const executionQueue = buildClientExecutionQueue(
    snapshot.clients,
    duplicateSignals,
  );
  const actNowCount = executionQueue.filter((client) => client.isUrgent).length;
  const cleanupCount = executionQueue.filter(
    (client) => client.needsCleanup,
  ).length;
  const boundaryCount = executionQueue.filter(
    (client) => client.needsBoundaryReview,
  ).length;
  const viewingCount = executionQueue.filter(
    (client) => client.isViewingLane,
  ).length;
  const leaseWatchCount = executionQueue.filter(
    (client) => client.isLeaseAnchored && !client.isUrgent,
  ).length;
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
      description="Run Front Office CRM here as an execution queue, not a summary: see who to touch first, which dossier still needs an anchor, which pair should merge next, and only then reopen intake."
      eyebrow="Clients"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Keep the daily decision obvious in three passes: follow first, anchor next, and review one duplicate pair at a time before you create or merge anything."
            title="Today's FO operating board"
          >
            <div className="office-queue-list">
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
                        Open dossier
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel="Follow first"
                  badgeTone={topQueueClient.queueTone}
                  context={`Queue ${topQueueClient.queueOrder} · ${topQueueClient.anchorLabel}`}
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
                  description="The first-touch order will appear here as soon as live dossiers enter the queue."
                  title="No queue leader yet"
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
                        Open dossier
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel="Anchor next"
                  badgeTone="warning"
                  context={`Queue ${topCleanupClient.queueOrder} · ${topCleanupClient.anchorLabel}`}
                  description="Use this lane when a dossier is missing a first touch or a dated next touch."
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
                  badgeLabel="Anchor clear"
                  badgeTone="success"
                  description="Every visible live dossier already has a first-touch log or dated next-touch anchor."
                  title="Anchor lane is clear"
                />
              )}

              {topDuplicatePair ? (
                <QueueItem
                  action={
                    <div className="list-row-meta front-office-record-meta">
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={`#${buildDuplicatePairAnchorId(topDuplicatePair.id)}`}
                      >
                        Review pair
                      </FrontOfficeLink>
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={topDuplicatePair.recommendedClient.href}
                      >
                        Open keep dossier
                      </FrontOfficeLink>
                    </div>
                  }
                  badgeLabel="Merge next"
                  badgeTone="warning"
                  context={topDuplicatePair.matchReasons.join(" · ")}
                  description={buildDuplicateBoardDescription(topDuplicatePair)}
                  meta={
                    <div className="list-row-meta front-office-record-meta">
                      <span>
                        Keep {topDuplicatePair.recommendedClient.fullName}
                      </span>
                      <span>
                        Merge {topDuplicatePair.duplicateClient.fullName}
                      </span>
                    </div>
                  }
                  title="Duplicate lane that should be reviewed next"
                />
              ) : (
                <QueueItem
                  badgeLabel="Merge clear"
                  badgeTone="success"
                  description="No visible pairwise duplicate suggestion is waiting right now."
                  title="Duplicate lane is clear"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            id={clientListSectionIds.executionQueue}
            actions={
              <>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={`#${clientListSectionIds.duplicateReview}`}
                >
                  Review duplicates
                </FrontOfficeLink>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href={`#${clientListSectionIds.intakeLaunch}`}
                >
                  Open intake assist
                </FrontOfficeLink>
              </>
            }
            className="office-list-card"
            subtitle="Queue order stays execution-first: overdue next touches, missing anchors, viewing coordination, duplicate review signals, and BO-ready stage review all stay visible without pretending Acre already has auto-send, hidden automation, or two-way sync."
            title="Client execution queue"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="dossiers whose next touch is already due or overdue"
                label="Follow first"
                tone="accent"
                value={actNowCount}
              />
              <StatCard
                hint="records that still need a visible first-touch or dated next-touch anchor"
                label="Anchor now"
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
                hint="lease or renewal windows that are active but not yet overdue"
                label="Lease watch"
                value={leaseWatchCount}
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
                        {client.duplicateSignal ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={client.duplicateSignal.pairHref}
                          >
                            Review duplicate lane
                          </FrontOfficeLink>
                        ) : null}
                      </div>
                    }
                    badgeLabel={client.queueLabel}
                    badgeTone={client.queueTone}
                    context={`Queue ${client.queueOrder} · ${client.anchorLabel}`}
                    description={client.whyNow}
                    key={client.id}
                    meta={
                      <>
                        <div className="list-row-meta front-office-record-meta">
                          <StatusBadge tone={client.stageTone}>
                            {client.stage}
                          </StatusBadge>
                          <span>Anchor · {client.anchorLabel}</span>
                          {client.duplicateSignal ? (
                            <span>
                              Duplicate review ·{" "}
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
                              {client.duplicateSignal.roleLabel} with{" "}
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

          <div id={clientListSectionIds.intakeLaunch}>
            <FrontOfficeLeadIntakeCard
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="clients"
              subtitle="Only reopen intake after the live queue is clear enough to add new work. The intake card stays review-first and never claims provider-backed ingestion, hidden automation, or auto-send."
              title="Start or continue intake review"
            />
          </div>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Keep the routing obvious: follow first, anchor next, review formal-stage boundary when needed, and handle one duplicate pair at a time."
            title="Quick routing"
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
                  context={`Queue ${topQueueClient.queueOrder} · ${topQueueClient.anchorLabel}`}
                  description={topQueueClient.whyNow}
                  meta={
                    <span>
                      {topQueueClient.fullName} ·{" "}
                      {topQueueClient.nextTouchLabel}
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
                  badgeLabel="Anchor"
                  badgeTone="warning"
                  context={`Queue ${topCleanupClient.queueOrder} · ${topCleanupClient.anchorLabel}`}
                  description="Use this lane when a dossier is missing a first touch or a dated next touch."
                  meta={
                    <span>
                      {topCleanupClient.fullName} ·{" "}
                      {topCleanupClient.nextTouchLabel}
                    </span>
                  }
                  title={`Anchor ${topCleanupClient.fullName} next`}
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
                  context={`Queue ${topBoundaryClient.queueOrder} · ${topBoundaryClient.anchorLabel}`}
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
                    href={
                      topDuplicatePair
                        ? `#${buildDuplicatePairAnchorId(topDuplicatePair.id)}`
                        : `#${clientListSectionIds.duplicateReview}`
                    }
                  >
                    {topDuplicatePair
                      ? "Review next pair"
                      : "Open duplicate lane"}
                  </FrontOfficeLink>
                }
                badgeLabel={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? "Merge"
                    : "Clear"
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
                description={
                  topDuplicatePair
                    ? buildDuplicateBoardDescription(topDuplicatePair)
                    : "Duplicate cleanup stays review-first: compare dossiers, confirm the surviving record, and merge only when you are comfortable with the keep choice."
                }
                meta={
                  <span>
                    {topDuplicatePair
                      ? `Keep ${topDuplicatePair.recommendedClient.fullName} · Merge ${topDuplicatePair.duplicateClient.fullName}`
                      : "Merge never creates a hidden BO record."}
                  </span>
                }
                title={
                  topDuplicatePair
                    ? "Duplicate pair waiting next"
                    : "Keep duplicate review explicit"
                }
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
                description="Who to touch first should be readable from next-touch pressure, missing anchors, stage context, and visible duplicate risk without opening a full admin form."
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
          <SummaryChip label="Follow first" tone="accent" value={actNowCount} />
          <SummaryChip label="Anchor now" tone="accent" value={cleanupCount} />
          <SummaryChip label="Viewing lane" value={viewingCount} />
          <SummaryChip label="BO boundary" value={boundaryCount} />
          <SummaryChip
            label="Duplicate review"
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
          <SummaryChip
            label="Live dossiers"
            value={snapshot.summary.liveContacts}
          />
          <SummaryChip label="Access" value={access.label} />
        </>
      }
      title="Client execution queue"
    />
  );
}
