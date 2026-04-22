import { can } from "@acre/auth";
import { getFrontOfficeListingsSnapshot } from "@acre/db";
import {
  QueueItem,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeAgentMaterialWindow } from "./front-office-agent-material-window";
import { FrontOfficeListingsOutputClient } from "./front-office-listings-output-client";
import {
  buildFrontOfficeListingsRouteState,
  parseFrontOfficeListingsSearchParams,
} from "./front-office-listings-route-state";
import { buildFrontOfficeListingUsagePulse } from "../../../../../packages/db/src/front-office-listing-output";
import { requireSessionContext } from "../../../lib/auth-session";

type AgentListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AgentListingsPage(props: AgentListingsPageProps) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "listings:view")) {
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="listings"
        userLocale={context.currentUser.locale}
      />
    );
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
  const usagePulse = buildFrontOfficeListingUsagePulse(snapshot.listings);

  return (
    <FrontOfficePageTemplate
      description="Use this page to keep the next share, support copy, and agent materials together."
      eyebrow="Listings"
      layoutClassName="front-office-listings-layout"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Focus on the next listing send, the active follow-up, and the materials needed to ship it."
          title="Listing follow-up"
        >
          <FrontOfficeListingsOutputClient
            draftAssist={draftAssist}
            routeState={routeState}
            snapshot={snapshot}
            usagePulse={usagePulse}
          />
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Keep the current pulse and route context visible without repeating the same work twice."
            title="Listing pulse"
          >
            <ListPageStatsGrid className="front-office-listings-rail-stats">
              <StatCard
                className="front-office-listings-rail-stat"
                hint="Inventory visible to agents"
                label="Listings"
                value={snapshot.summary.listingCount}
              />
              <StatCard
                className="front-office-listings-rail-stat"
                label="Tracked links"
                value={snapshot.summary.trackedLinks}
              />
              <StatCard
                className="front-office-listings-rail-stat"
                label="Tracked clicks"
                value={snapshot.summary.trackedClicks}
              />
              <StatCard
                className="front-office-listings-rail-stat front-office-listings-rail-stat-detail"
                hint={usagePulse.pulseDescription}
                label="Pulse"
                tone="accent"
                value={usagePulse.pulseLabel}
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
            subtitle="Keep the client or appointment context, saved view, draft state, and support copy visible before you share a listing."
            title="Current context"
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
                        Open client page
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.hasDraftAssist ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.contextHref}
                      >
                        Clear draft help
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.diagnostics.length ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.cleanHref}
                      >
                        Reset view
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
                      Open this page from a client or appointment to keep the
                      next step attached to a real record.
                    </span>
                  )
                }
                title={
                  snapshot.targetClient
                    ? `${routeState.focusedRouteLaneLabel} for ${snapshot.targetClient.fullName}`
                    : `${routeState.focusedRouteLaneLabel} for tracked listings`
                }
              />
              <FrontOfficeRailItem
                action={
                  routeState.stableHref !== routeState.contextHref ? (
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={routeState.stableHref}
                    >
                      {routeState.focusedRouteLaneActionLabel}
                    </FrontOfficeLink>
                  ) : null
                }
                badgeLabel={routeState.stableReentryLabel}
                badgeTone="accent"
                description={routeState.stableReentryDescription}
                title="Saved view"
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
                        Clear draft
                      </FrontOfficeLink>
                    ) : null}
                    {routeState.diagnostics.length ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={routeState.cleanHref}
                      >
                        Reset view
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
                title="View cleanup"
              />
              <FrontOfficeRailItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={`${routeState.stableHref}#agent-send-package`}
                  >
                    Open send kit
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
                    <span>Preview only</span>
                    <span>
                      {snapshot.agentMaterial.featuredCaseCount} proof point(s)
                      ready
                    </span>
                  </>
                }
                title="Support copy"
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
                  description="A saved draft is active here. Copying the matching channel keeps the assisted copy while still appending the tracked private listing link."
                  meta={
                    <>
                      <span>
                        Channel ·{" "}
                        {draftAssist.channel === "sms" ? "SMS" : "Email"}
                      </span>
                      <span>{draftAssist.title}</span>
                    </>
                  }
                  title="Draft help is loaded"
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
            subtitle="Profile, contact, and proof materials stay together here so each listing leaves with identity and context."
            title="Agent materials"
          >
            <FrontOfficeAgentMaterialWindow
              material={snapshot.agentMaterial}
              routeState={routeState}
              targetAppointment={snapshot.targetAppointment}
              targetClient={snapshot.targetClient}
            />
          </SectionCard>
        </>
      }
      pageClassName="front-office-listings-page"
      summary={
        <>
          <SummaryChip label="Listings" value={snapshot.summary.listingCount} />
          <SummaryChip
            label="Tracked links"
            value={snapshot.summary.trackedLinks}
          />
          <SummaryChip
            label="Tracked clicks"
            tone="accent"
            value={snapshot.summary.trackedClicks}
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
        </>
      }
      title="Listings"
    />
  );
}
