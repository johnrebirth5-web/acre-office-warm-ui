import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeClientsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
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

const intakeReviewStages = new Set([
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Pending",
]);

function getClientReviewActionLabel(stage: string) {
  return intakeReviewStages.has(stage)
    ? "Continue intake review"
    : "Open client workspace";
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
      description="Client work stays lean here: launch intake assist, keep pending review obvious, catch duplicate cues early, and continue the next client conversation without leaving the list."
      eyebrow="Clients"
      main={
        <>
          <div id="clients-intake-launch">
            <FrontOfficeLeadIntakeCard
              initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
              sourceSurface="clients"
              subtitle="Start a new lead or reopen a screenshot / transcript extract that still has review-pending suggestions. The card below keeps field-level confidence, provenance, and review-first duplicate warnings visible before anything is written into the live dossier."
              title="Start or continue intake review"
            />
          </div>

          {snapshot.duplicatePairs.length ? (
            <FrontOfficeClientDuplicatesCard
              duplicatePairs={snapshot.duplicatePairs}
            />
          ) : (
            <SectionCard
              id="duplicate-review"
              className="office-list-card"
              subtitle="This anchor stays stable even when Acre does not see any pairwise duplicates right now, so launch surfaces can always send you back here if a create-time warning tells you to review before merge."
              title="Duplicate review"
            >
              <EmptyState
                description="No pairwise duplicate suggestions are visible in this client scope right now."
                title="Duplicate lane is clear"
              />
            </SectionCard>
          )}

          <SectionCard
            id="client-pipeline"
            actions={
              <>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href="#clients-intake-launch"
                >
                  Open intake assist
                </FrontOfficeLink>
                <FrontOfficeLink
                  className="office-inline-link front-office-inline-link"
                  href="#duplicate-review"
                >
                  Review duplicates
                </FrontOfficeLink>
              </>
            }
            className="office-list-card"
            subtitle="Front Office keeps the active client list readable and action-oriented, so an agent can continue intake review, scan next-touch pressure, and only hand off once work becomes formal."
            title="Client pipeline review"
          >
            <ListPageStatsGrid>
              {snapshot.stageMetrics.length ? (
                snapshot.stageMetrics.map((metric) => (
                  <StatCard
                    hint="clients in this stage"
                    key={metric.label}
                    label={metric.label}
                    tone={
                      metric.tone === "accent" || metric.tone === "success"
                        ? "accent"
                        : "default"
                    }
                    value={metric.count}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Client stage distribution will appear here once Front Office starts managing live CRM records in this scope."
                  title="No stages in view"
                />
              )}
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.clients.length ? (
                snapshot.clients.map((client) => (
                  <article
                    className="list-row front-office-record"
                    key={client.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{client.fullName}</strong>
                        <p>
                          {client.intentLabel} · {client.budgetLabel}
                        </p>
                      </div>
                      <StatusBadge tone={client.stageTone}>
                        {client.stage}
                      </StatusBadge>
                    </div>
                    <p>{client.areasLabel}</p>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{client.sourceLabel}</span>
                      <span>{client.lastTouchLabel}</span>
                      <span>{client.nextTouchLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={client.href}
                    >
                      {getClientReviewActionLabel(client.stage)}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="When Front Office starts using the shared CRM as the active client queue, records will appear here."
                  title="No live client records"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="The client list should make launch and continuation obvious: jump back into intake assist, reopen duplicate review, or scan the live queue without hunting for the right surface."
            title="Launch & continue review"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href="#clients-intake-launch"
                  >
                    Jump to intake assist
                  </FrontOfficeLink>
                }
                badgeLabel="Assist"
                badgeTone="accent"
                context="Start or continue"
                description="Reopen the intake card above whenever OCR or transcript suggestions are still pending review. Create only uses the live form values, so unfinished review stays visible in one place."
                meta={<span>Review-pending assist stays in the card above.</span>}
                title="Continue intake assist review"
              />
              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href="#duplicate-review"
                  >
                    Open duplicate review
                  </FrontOfficeLink>
                }
                badgeLabel={
                  snapshot.summary.potentialDuplicateCount > 0
                    ? "Review"
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
                    : "No duplicate pairs in view"
                }
                description="Keep the duplicate cue close to intake. If Acre flags a collision during create, this lane is where you compare records before a merge."
                meta={<span>Duplicate review stays review-first.</span>}
                title="Follow the duplicate cue"
              />
              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href="#client-pipeline"
                  >
                    Jump to client queue
                  </FrontOfficeLink>
                }
                badgeLabel="Queue"
                badgeTone="accent"
                context={`${snapshot.summary.liveContacts} live contact(s)`}
                description="Stay in the list when you need the active dossier queue, stage context, and next-touch ordering to continue review across existing clients."
                meta={
                  <span>
                    {snapshot.summary.followUpDueCount} follow-up item(s) are due
                    in this view.
                  </span>
                }
                title="Review the live client list"
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="A compact read on intake pressure, follow-up pressure, and whether duplicate review needs attention before the next client touch."
            title="Workflow signals"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="records visible in this scope"
                label="Live contacts"
                value={snapshot.summary.liveContacts}
              />
              <StatCard
                hint="stages represented in the current list"
                label="Active stages"
                value={snapshot.summary.activeStages}
              />
              <StatCard
                hint="overdue or same-day follow-up markers in scope"
                label="Follow-up due"
                value={snapshot.summary.followUpDueCount}
              />
              <StatCard
                hint="scheduled follow-up tasks already overdue"
                label="Overdue tasks"
                value={snapshot.summary.overdueTaskCount}
              />
              <StatCard
                hint="pairwise duplicate review suggestions across the CRM records visible to you"
                label="Potential dupes"
                tone="accent"
                value={snapshot.summary.potentialDuplicateCount}
              />
              <StatCard
                hint="current role template in Front Office"
                label="Access"
                tone="accent"
                value={access.label}
              />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These are the operating rules for the real FO CRM workspace."
            title="Current scope"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="CRM"
                description="Agents should be able to scan client stage, intent, budget, and next touchpoint without opening a full admin form."
                title="Capture stays light"
              />
              <FrontOfficeRailItem
                badgeLabel="Today"
                description="The page should highlight who needs a same-day touch and who has gone stale before it turns into a Back Office issue."
                title="Follow-up stays visible"
              />
              <FrontOfficeRailItem
                badgeLabel="BO"
                description="Once a client becomes a formal transaction, the next step should hand off into Back Office instead of duplicating transaction editing here."
                title="Formal workflow still lives elsewhere"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Follow-up due"
            tone="accent"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label="Duplicate review"
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
          <SummaryChip
            label="Overdue tasks"
            value={snapshot.summary.overdueTaskCount}
          />
          <SummaryChip
            label="Live contacts"
            value={snapshot.summary.liveContacts}
          />
          <SummaryChip
            label="Stages in view"
            value={snapshot.summary.activeStages}
          />
          <SummaryChip label="Access" value={access.label} />
        </>
      }
      title="Client intake & pipeline"
    />
  );
}
