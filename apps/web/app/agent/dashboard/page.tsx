import type { ReactNode } from "react";
import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeDashboardSnapshot } from "@acre/db";
import {
  Badge,
  EmptyState,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { getSessionAccess, requireSessionContext } from "../../../lib/auth-session";

function DashboardLink(props: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isExternal = props.href.startsWith("http://") || props.href.startsWith("https://") || props.href.startsWith("mailto:") || props.href.startsWith("tel:");

  if (isExternal) {
    return (
      <a className={props.className} href={props.href} rel="noreferrer" target="_blank">
        {props.children}
      </a>
    );
  }

  return (
    <Link className={props.className} href={props.href}>
      {props.children}
    </Link>
  );
}

export default async function AgentDashboardPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const snapshot = await getFrontOfficeDashboardSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone
  });

  return (
    <FrontOfficePageTemplate
      description="Daily follow-up, commitments, listing outreach, and the next Back Office handoff in one view."
      eyebrow="Front Office"
      headerClassName="front-office-dashboard-header"
      layoutClassName="front-office-dashboard-layout"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="The queue stays inside Front Office until a client or document needs to become a formal Back Office record."
            title="Today action queue"
          >
            <div className="front-office-action-grid">
              {snapshot.actionQueue.map((item) => (
                <article className={`front-office-action-card tone-${item.tone}`} key={item.id}>
                  <div className="front-office-action-card-head">
                    <div>
                      <span className="front-office-action-card-label">{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <StatusBadge tone={item.tone}>{item.tone === "neutral" ? "In view" : "Active"}</StatusBadge>
                  </div>
                  <p>{item.description}</p>
                  <span className="front-office-action-card-helper">{item.helper}</span>
                  <DashboardLink className="office-inline-link front-office-inline-link" href={item.href}>
                    {item.actionLabel}
                  </DashboardLink>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Light pipeline visibility for the agent workday. Formal transaction reporting still belongs in Back Office."
            title="Client pipeline snapshot"
          >
            <div className="front-office-stage-grid">
              {snapshot.pipeline.stageMetrics.length ? (
                snapshot.pipeline.stageMetrics.map((metric) => (
                  <StatCard
                    className="front-office-stage-card"
                    hint="clients in this stage"
                    key={metric.label}
                    label={metric.label}
                    tone={metric.tone === "accent" || metric.tone === "success" ? "accent" : "default"}
                    value={metric.count}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Once Front Office is managing live clients in this scope, stage distribution will appear here."
                  title="No client stages yet"
                />
              )}
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.pipeline.recentClients.length ? (
                snapshot.pipeline.recentClients.map((client) => (
                  <article className="list-row front-office-record" key={client.id}>
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{client.fullName}</strong>
                        <p>{client.source}</p>
                      </div>
                      <StatusBadge tone={client.stageTone}>{client.stage}</StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{client.nextTouchLabel}</span>
                      <span>{client.lastTouchLabel}</span>
                    </div>
                    <DashboardLink className="office-inline-link front-office-inline-link" href={client.href}>
                      Open client workspace
                    </DashboardLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="When client activity starts flowing into the shared CRM, the latest active records will appear here."
                  title="No active client records"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Shared office commitments are visible now. Dedicated Front Office appointment scheduling remains a planned module."
            title="Calendar & commitments"
          >
            <div className="front-office-commitment-strip">
              <StatCard hint="visible today or upcoming in scope" label="Upcoming commitments" value={snapshot.commitments.items.length} />
              <StatCard
                hint={snapshot.commitments.appointmentModuleReady ? "agent scheduling is live" : "still planned, not yet shipped"}
                label="Appointment module"
                value={snapshot.commitments.appointmentModuleReady ? "Live" : "Planned"}
              />
            </div>

            <div className="front-office-placeholder-note">
              <Badge tone="neutral">Honest state</Badge>
              <p>{snapshot.commitments.appointmentMessage}</p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.commitments.items.length ? (
                snapshot.commitments.items.map((commitment) => (
                  <article className="list-row front-office-record" key={commitment.id}>
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{commitment.title}</strong>
                        <p>{commitment.startsAtLabel}</p>
                      </div>
                      <StatusBadge tone="accent">{commitment.visibilityLabel}</StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{commitment.locationLabel}</span>
                      <span>{commitment.rsvpLabel}</span>
                    </div>
                    <DashboardLink className="office-inline-link front-office-inline-link" href={commitment.href}>
                      Open notices & events
                    </DashboardLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="When this office publishes upcoming events or visible meetings, they will surface here."
                  title="No commitments scheduled"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Use listing inventory and tracked links to drive outreach without switching into formal Back Office workflows."
            title="Listing & content output"
          >
            <div className="front-office-stage-grid">
              <StatCard hint="active or hot listings in scope" label="Send-ready listings" value={snapshot.listingOutput.activeListingCount} />
              <StatCard hint="tracked links already created by you" label="Tracked links" value={snapshot.listingOutput.trackedLinkCount} />
              <StatCard hint="clicks recorded on your tracked links" label="Tracked clicks" value={snapshot.listingOutput.trackedClickCount} />
              <StatCard
                hint={snapshot.listingOutput.trackedSendingReady ? "existing share links are already producing engagement" : "listing outreach can start as soon as share links are created"}
                label="Tracked sending"
                value={snapshot.listingOutput.trackedSendingReady ? "Active" : "Ready"}
                tone="accent"
              />
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.listingOutput.recentListings.length ? (
                snapshot.listingOutput.recentListings.map((listing) => (
                  <article className="list-row front-office-record" key={listing.id}>
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{listing.title}</strong>
                        <p>{listing.neighborhoodLabel}</p>
                      </div>
                      <StatusBadge tone={listing.statusTone}>{listing.statusLabel}</StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{listing.priceLabel}</span>
                      <span>{listing.trackedLinkCount} tracked link(s)</span>
                      <span>{listing.trackedClickCount} click(s)</span>
                    </div>
                    <DashboardLink className="office-inline-link front-office-inline-link" href={listing.href}>
                      Open listings
                    </DashboardLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="Active listings will appear here once inventory is available in the shared listing model."
                  title="No listing inventory in scope"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These items should move into Back Office because they need formal transactions, signatures, or auditable document flow."
            title="Needs Back Office"
          >
            <div className="list-column front-office-record-list">
              {snapshot.backOffice.items.length ? (
                snapshot.backOffice.items.map((item) => (
                  <article className={`list-row front-office-record tone-${item.tone}`} key={item.id}>
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge tone={item.tone}>{item.contextLabel}</StatusBadge>
                    </div>
                    <DashboardLink className="office-inline-link front-office-inline-link" href={item.href}>
                      {item.actionLabel}
                    </DashboardLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link className="office-button-secondary" href="/office/transactions">
                      Open Back Office
                    </Link>
                  }
                  description="When a client is ready to become a transaction or a signature step needs formal follow-through, it will show up here."
                  title="Nothing waiting for formal workflow"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      pageClassName="front-office-dashboard-page"
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Office-level alerts and visibility cues that support daily follow-up."
            title="Resource & notice rail"
          >
            <div className="front-office-rail-list">
              {snapshot.noticeRail.notifications.length ? (
                snapshot.noticeRail.notifications.map((notification) => (
                  <article className="front-office-note-item" key={notification.id}>
                    <div className="front-office-note-head">
                      <Badge tone="accent">{notification.typeLabel}</Badge>
                      <span>{notification.createdAtLabel}</span>
                    </div>
                    <div className="front-office-note-copy">
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                    </div>
                    <div className="front-office-note-footer">
                      <DashboardLink className="office-inline-link front-office-inline-link" href={notification.href}>
                        Open notice
                      </DashboardLink>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Shared office notices and personal notifications will appear here when they are available."
                  title="No current notices"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Published documents, templates, and playbooks stay discoverable from the Front Office rail."
            title="Training & documents"
          >
            <div className="front-office-rail-list">
              {snapshot.noticeRail.resources.length ? (
                snapshot.noticeRail.resources.map((resource) => (
                  <article className="front-office-resource-item" key={resource.id}>
                    <div className="front-office-note-head">
                      <Badge tone="neutral">{resource.typeLabel}</Badge>
                    </div>
                    <strong>{resource.title}</strong>
                    <p>{resource.summary}</p>
                    <DashboardLink className="office-inline-link front-office-inline-link" href={resource.href}>
                      Open resource
                    </DashboardLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Published Front Office resources will surface here once the shared library is populated."
                  title="No resources published"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Operational shortcuts for vendors that agents need during client execution."
            title="Vendor shortcuts"
          >
            <div className="front-office-rail-list">
              {snapshot.noticeRail.vendors.length ? (
                snapshot.noticeRail.vendors.map((vendor) => (
                  <article className="front-office-vendor-item" key={vendor.id}>
                    <div className="front-office-note-head">
                      <Badge tone="success">{vendor.category}</Badge>
                    </div>
                    <strong>{vendor.name}</strong>
                    <p>{vendor.headline}</p>
                    <span className="front-office-vendor-contact">{vendor.contactLabel}</span>
                    {vendor.href ? (
                      <DashboardLink className="office-inline-link front-office-inline-link" href={vendor.href}>
                        Contact vendor
                      </DashboardLink>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Featured vendors for this office scope will appear here when the shared vendor directory is available."
                  title="No vendor shortcuts yet"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Office scope" value={context.currentOffice?.name ?? context.currentOrganization.name} />
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip label="Today actions" tone="accent" value={snapshot.summary.todayActionCount} />
          <SummaryChip label="Follow-up due" value={snapshot.summary.followUpDueCount} />
          <SummaryChip label="Today commitments" value={snapshot.summary.todayCommitmentCount} />
          <SummaryChip label="Needs Back Office" tone="accent" value={snapshot.summary.needsBackOfficeCount} />
        </>
      }
      title="Front Office dashboard"
    />
  );
}
