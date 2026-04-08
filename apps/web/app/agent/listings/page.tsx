import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeListingsSnapshot } from "@acre/db";
import {
  QueueItem,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeAgentMaterialWindow } from "./front-office-agent-material-window";
import { FrontOfficeListingsOutputClient } from "./front-office-listings-output-client";
import {
  buildFrontOfficeListingsRouteState,
  parseFrontOfficeListingsSearchParams,
} from "./front-office-listings-route-state";
import { requireSessionContext } from "../../../lib/auth-session";

type AgentListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildMaterialStatusLabel(input: {
  portraitReady: boolean;
  featuredCaseCount: number;
}) {
  if (input.featuredCaseCount > 0) {
    return "Proof-ready";
  }

  return input.portraitReady ? "Identity-ready" : "Lean package";
}

export default async function AgentListingsPage(props: AgentListingsPageProps) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "listings:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const searchParams = (await props.searchParams) ?? {};
  const parsedSearch = parseFrontOfficeListingsSearchParams(searchParams);
  const targetClientId = parsedSearch.requestedClientId;
  const targetAppointmentId = parsedSearch.requestedAppointmentId;
  const requestedRouteLane = parsedSearch.requestedRouteLane;
  const draftAssist = parsedSearch.draftAssist;
  const snapshot = await getFrontOfficeListingsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    targetClientId,
    targetAppointmentId,
  });
  const routeState = buildFrontOfficeListingsRouteState({
    snapshot,
    requestedClientId: targetClientId ?? null,
    requestedAppointmentId: targetAppointmentId ?? null,
    requestedRouteLane,
    hasRouteLaneParams: parsedSearch.hasRouteLaneParams,
    requestedDraftChannel: parsedSearch.requestedDraftChannel,
    draftAssist,
    hasDraftAssistParams: parsedSearch.hasDraftAssistParams,
  });
  const materialStatusLabel = buildMaterialStatusLabel({
    portraitReady: snapshot.agentMaterial.portraitReady,
    featuredCaseCount: snapshot.agentMaterial.featuredCaseCount,
  });

  return (
    <FrontOfficePageTemplate
      description="Work the outbound desk here: choose the send lane, follow the lane checklist, package the agent materials, keep tracked-link context visible, and manually push the next touch back into Front Office without pretending Acre auto-sends anything."
      eyebrow="Listings"
      layoutClassName="front-office-listings-layout"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Use this as the real manual send desk for listing recommendations, appointment follow-up, tracked-send rescue, focused lane re-entry, lane execution steps, and agent-material packaging."
          title="Outbound listing workspace"
        >
          <FrontOfficeListingsOutputClient
            draftAssist={draftAssist}
            routeState={routeState}
            snapshot={snapshot}
          />
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Quick read on how ready this workspace is for tracked outbound send work right now."
            title="Outbound signals"
          >
            <ListPageStatsGrid className="front-office-listings-rail-stats">
              <StatCard
                className="front-office-listings-rail-stat"
                hint="inventory visible to agents"
                label="Listings"
                value={snapshot.summary.listingCount}
              />
              <StatCard
                className="front-office-listings-rail-stat"
                hint="currently marked public-ready"
                label="Public-ready"
                value={snapshot.summary.publicReadyCount}
              />
              <StatCard
                className="front-office-listings-rail-stat"
                hint="sum of tracked links already created by you"
                label="Tracked links"
                value={snapshot.summary.trackedLinks}
              />
              <StatCard
                className="front-office-listings-rail-stat"
                hint="sum of tracked clicks in your feed"
                label="Tracked clicks"
                value={snapshot.summary.trackedClicks}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint={routeState.routeStatusDescription}
                label="Route"
                tone={routeState.diagnostics.length ? "default" : "accent"}
                value={routeState.routeStatusLabel}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint="current writeback mode for this route"
                label="Mode"
                tone="accent"
                value={routeState.modeLabel}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint={routeState.focusedRouteLaneDescription}
                label="Lane"
                tone={
                  routeState.focusedRouteLane === "send-rescue"
                    ? "default"
                    : "accent"
                }
                value={routeState.focusedRouteLaneLabel}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint={
                  routeState.draftStatusDescription
                }
                label="Draft"
                value={routeState.draftStatusLabel}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint={routeState.preferredSupportLaneDescription}
                label="Package lane"
                value={routeState.preferredSupportLaneLabel}
              />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle={routeState.focusedRouteLanePanelDescription}
            title={routeState.focusedRouteLanePanelLabel}
          >
            <div className="office-queue-list">
              {routeState.focusedRouteLaneSteps.map((step, index) => (
                <QueueItem
                  badgeLabel={`Step ${index + 1}`}
                  badgeTone={step.tone}
                  description={step.detail}
                  key={step.label}
                  title={step.label}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Keep recipient binding, appointment loop, focused lane, draft lane, route hygiene, and package pairing visible before the listing leaves this desk."
            title="Workspace context"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                action={
                  <>
                    {routeState.stableHref !== routeState.contextHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.stableHref}
                      >
                        {routeState.focusedRouteLaneActionLabel}
                      </FrontOfficeLink>
                    ) : null}
                    {snapshot.targetClient ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={snapshot.targetClient.href}
                      >
                        Open client dossier
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.hasDraftAssist ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.contextHref}
                      >
                        Dismiss draft assist
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.diagnostics.length ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.cleanHref}
                      >
                        Open clean route
                      </FrontOfficeLink>
                    ) : null}
                  </>
                }
                badgeLabel={routeState.focusedRouteLaneLabel}
                badgeTone={
                  routeState.focusedRouteLane === "send-rescue"
                    ? "warning"
                    : "accent"
                }
                description={routeState.focusedRouteLaneDescription}
                meta={
                  snapshot.targetClient ? (
                    <>
                      <span>{snapshot.targetClient.stage}</span>
                      <span>{snapshot.targetClient.nextTouchLabel}</span>
                      <span>Mode · {routeState.modeLabel}</span>
                    </>
                  ) : (
                    <span>
                      Open from a dossier or appointment to turn the focused
                      lane into a real send trail.
                    </span>
                  )
                }
                title={
                  snapshot.targetClient
                    ? `${routeState.focusedRouteLaneLabel} for ${snapshot.targetClient.fullName}`
                    : `${routeState.focusedRouteLaneLabel} for tracked listings`
                }
              />
              {snapshot.targetAppointment ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={snapshot.targetAppointment.href}
                    >
                      Open appointment
                    </FrontOfficeLink>
                  }
                  badgeLabel={snapshot.targetAppointment.statusLabel}
                  badgeTone={snapshot.targetAppointment.statusTone}
                  description={`${snapshot.targetAppointment.typeLabel} · ${snapshot.targetAppointment.locationLabel}. Sends from this page now stay tied to the appointment loop instead of becoming detached outreach.`}
                  title={`${snapshot.targetAppointment.title} · ${snapshot.targetAppointment.startsAtLabel}`}
                />
              ) : null}
              <FrontOfficeRailItem
                action={
                  <>
                    {routeState.stableHref !== routeState.contextHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.stableHref}
                      >
                        {routeState.focusedRouteLaneActionLabel}
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.hasDraftAssist ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.contextHref}
                      >
                        Clear draft lane
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.diagnostics.length ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.cleanHref}
                      >
                        Open clean route
                      </FrontOfficeLink>
                    ) : null}
                  </>
                }
                badgeLabel={routeState.routeStatusLabel}
                badgeTone={routeState.diagnostics.length ? "warning" : "accent"}
                description={routeState.draftStatusDescription}
                meta={
                  <>
                    <span>{routeState.draftStatusLabel}</span>
                    <span>{routeState.routeStatusDescription}</span>
                  </>
                }
                title="Route hygiene and draft guardrails"
              />
              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={`${routeState.stableHref}#agent-send-package`}
                  >
                    Open send package
                  </FrontOfficeLink>
                }
                badgeLabel={routeState.preferredSupportLaneLabel}
                badgeTone={
                  routeState.preferredSupportLane === "mixed"
                    ? "warning"
                    : "accent"
                }
                description={routeState.preferredSupportLaneDescription}
                meta={
                  <>
                    <span>{materialStatusLabel}</span>
                    <span>
                      {snapshot.agentMaterial.featuredCaseCount} proof point(s)
                      ready
                    </span>
                  </>
                }
                title="Companion package lane"
              />
              {draftAssist ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={routeState.contextHref}
                    >
                      Keep context, clear draft
                    </FrontOfficeLink>
                  }
                  badgeLabel="AI draft"
                  badgeTone="accent"
                  description="A deep-linked draft is active here. Copying the matching channel will keep the assisted copy but still append a tracked private listing link."
                  meta={
                    <>
                      <span>
                        Channel · {draftAssist.channel === "sms" ? "SMS" : "Email"}
                      </span>
                      <span>{draftAssist.title}</span>
                    </>
                  }
                  title="Deep-linked draft assist is in scope"
                />
              ) : null}
              {routeState.diagnostics.map((diagnostic) => (
                <FrontOfficeRailItem
                  badgeLabel={diagnostic.badgeLabel}
                  badgeTone={diagnostic.badgeTone}
                  description={diagnostic.description}
                  key={diagnostic.id}
                  title={diagnostic.title}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            id="agent-send-package"
            className="office-list-card"
            subtitle="Business card, intro copy, and proof points stay here as send support so each listing can leave with identity and context, not as a separate profile toy."
            title="Agent send package"
          >
            <FrontOfficeAgentMaterialWindow
              material={snapshot.agentMaterial}
              routeState={routeState}
              targetAppointment={snapshot.targetAppointment}
              targetClient={snapshot.targetClient}
            />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Acre creates tracked links and writeback context here, but the actual send still happens only when the agent manually pastes and sends the copied content."
            title="Manual send guardrails"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Trail"
                description="Tracked share links stay private, feed click behavior back into Front Office, and become send records when launched from a dossier or appointment."
                title="Tracked send trail"
              />
              <FrontOfficeRailItem
                badgeLabel="Cue"
                description="Unopened sends and quiet-after-open behavior should rise back into the same cleanup loop instead of living as invisible clipboard history."
                title="Follow-up rescue cues"
              />
              <FrontOfficeRailItem
                badgeLabel="Bundle"
                description="Agent materials stay beside the listing so each send can carry identity, intro copy, and proof without becoming a portal or auto-send system."
                title="Material package pairing"
              />
            </div>
          </SectionCard>
        </>
      }
      pageClassName="front-office-listings-page"
      summary={
        <>
          <SummaryChip label="Listings" value={snapshot.summary.listingCount} />
          <SummaryChip
            label="Public-ready"
            value={snapshot.summary.publicReadyCount}
          />
          <SummaryChip
            label="Tracked links"
            value={snapshot.summary.trackedLinks}
          />
          <SummaryChip
            label="Tracked clicks"
            tone="accent"
            value={snapshot.summary.trackedClicks}
          />
          <SummaryChip label="Route" value={routeState.routeStatusLabel} />
          <SummaryChip
            label="Mode"
            tone={routeState.mode === "tracked-link" ? "default" : "accent"}
            value={routeState.modeLabel}
          />
          <SummaryChip
            label="Lane"
            tone={
              routeState.focusedRouteLane === "send-rescue"
                ? "default"
                : "accent"
            }
            value={routeState.focusedRouteLaneLabel}
          />
          {snapshot.targetClient ? (
            <SummaryChip
              label="Recipient"
              tone="accent"
              value={snapshot.targetClient.fullName}
            />
          ) : null}
          {snapshot.targetAppointment ? (
            <SummaryChip
              label="Appointment"
              value={snapshot.targetAppointment.typeLabel}
            />
          ) : null}
          <SummaryChip label="Draft" value={routeState.draftStatusLabel} />
          <SummaryChip
            label="Package"
            value={routeState.preferredSupportLaneLabel}
          />
          <SummaryChip label="Materials" value={materialStatusLabel} />
        </>
      }
      title="Listing outbound workspace"
    />
  );
}
