import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeDashboardSnapshot } from "@acre/db";
import {
  Badge,
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../lib/auth-session";

export default async function AgentDashboardPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "dashboard:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const access = getSessionAccess(context);
  const snapshot = await getFrontOfficeDashboardSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
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
            <div className="list-column front-office-record-list">
              {snapshot.actionQueue.map((item) => (
                <article
                  className={`list-row front-office-record tone-${item.tone}`}
                  key={item.id}
                >
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <StatusBadge tone={item.tone}>
                      {item.tone === "neutral" ? "In view" : "Active"}
                    </StatusBadge>
                  </div>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{item.count} item(s)</span>
                    <span>{item.helper}</span>
                  </div>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={item.href}
                  >
                    {item.actionLabel}
                  </FrontOfficeLink>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Light pipeline visibility for the agent workday. Formal transaction reporting still belongs in Back Office."
            title="Client pipeline snapshot"
          >
            <ListPageStatsGrid>
              {snapshot.pipeline.stageMetrics.length ? (
                snapshot.pipeline.stageMetrics.map((metric) => (
                  <StatCard
                    className="front-office-stage-card"
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
                  description="Once Front Office is managing live clients in this scope, stage distribution will appear here."
                  title="No client stages yet"
                />
              )}
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.pipeline.recentClients.length ? (
                snapshot.pipeline.recentClients.map((client) => (
                  <article
                    className="list-row front-office-record"
                    key={client.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{client.fullName}</strong>
                        <p>{client.source}</p>
                      </div>
                      <StatusBadge tone={client.stageTone}>
                        {client.stage}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{client.nextTouchLabel}</span>
                      <span>{client.lastTouchLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={client.href}
                    >
                      Open client workspace
                    </FrontOfficeLink>
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
            subtitle="Your own Front Office appointments now sit next to shared office commitments so the workday stays in one place."
            title="Calendar & commitments"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="visible today or upcoming in scope"
                label="Upcoming commitments"
                value={snapshot.commitments.items.length}
              />
              <StatCard
                hint={
                  snapshot.commitments.appointmentModuleReady
                    ? "agent scheduling is live"
                    : "not live yet"
                }
                label="Appointment module"
                value={
                  snapshot.commitments.appointmentModuleReady
                    ? "Live"
                    : "In progress"
                }
              />
            </ListPageStatsGrid>

            <div className="front-office-placeholder-note">
              <Badge
                tone={
                  snapshot.commitments.appointmentModuleReady
                    ? "accent"
                    : "neutral"
                }
              >
                {snapshot.commitments.appointmentModuleReady
                  ? "Live now"
                  : "Honest state"}
              </Badge>
              <p>{snapshot.commitments.appointmentMessage}</p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.commitments.items.length ? (
                snapshot.commitments.items.map((commitment) => (
                  <article
                    className="list-row front-office-record"
                    key={commitment.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{commitment.title}</strong>
                        <p>{commitment.startsAtLabel}</p>
                      </div>
                      <StatusBadge tone={commitment.badgeTone}>
                        {commitment.badgeLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{commitment.locationLabel}</span>
                      <span>{commitment.contextLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={commitment.href}
                    >
                      Open calendar
                    </FrontOfficeLink>
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
            <ListPageStatsGrid>
              <StatCard
                hint="active or hot listings in scope"
                label="Send-ready listings"
                value={snapshot.listingOutput.activeListingCount}
              />
              <StatCard
                hint="tracked links already created by you"
                label="Tracked links"
                value={snapshot.listingOutput.trackedLinkCount}
              />
              <StatCard
                hint="clicks recorded on your tracked links"
                label="Tracked clicks"
                value={snapshot.listingOutput.trackedClickCount}
              />
              <StatCard
                hint="client-linked sends recorded from Front Office"
                label="Client sends"
                value={snapshot.listingOutput.sendRecordCount}
              />
              <StatCard
                hint="send records that have at least one open"
                label="Opened sends"
                value={snapshot.listingOutput.openedSendCount}
              />
              <StatCard
                hint="unique clients who opened at least one send"
                label="Engaged clients"
                value={snapshot.listingOutput.engagedClientCount}
              />
              <StatCard
                hint={
                  snapshot.listingOutput.trackedSendingReady
                    ? "existing share links are already producing engagement"
                    : "listing outreach can start as soon as share links are created"
                }
                label="Tracked sending"
                value={
                  snapshot.listingOutput.trackedSendingReady
                    ? "Active"
                    : "Ready"
                }
                tone="accent"
              />
            </ListPageStatsGrid>

            <div className="list-column front-office-record-list">
              {snapshot.listingOutput.recentListings.length ? (
                snapshot.listingOutput.recentListings.map((listing) => (
                  <article
                    className="list-row front-office-record"
                    key={listing.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{listing.title}</strong>
                        <p>{listing.neighborhoodLabel}</p>
                      </div>
                      <StatusBadge tone={listing.statusTone}>
                        {listing.statusLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{listing.priceLabel}</span>
                      <span>{listing.trackedLinkCount} tracked link(s)</span>
                      <span>{listing.trackedClickCount} click(s)</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={listing.href}
                    >
                      Open listings
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="Active listings will appear here once inventory is available in the shared listing model."
                  title="No listing inventory in scope"
                />
              )}
            </div>

            <div className="front-office-placeholder-note">
              <strong>Recent client engagement</strong>
              <p>
                Client-linked sends now turn tracked links into real execution
                history, so you can see who was sent what and whether they
                opened it.
              </p>
            </div>

            <div className="list-column front-office-record-list">
              {snapshot.listingOutput.recentEngagement.length ? (
                snapshot.listingOutput.recentEngagement.map((record) => (
                  <article
                    className="list-row front-office-record"
                    key={record.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{record.clientName}</strong>
                        <p>{record.listingTitle}</p>
                      </div>
                      <StatusBadge tone={record.engagementTone}>
                        {record.engagementLabel}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{record.channelLabel}</span>
                      <span>{record.sentAtLabel}</span>
                      <span>{record.detailLabel}</span>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={record.href}
                    >
                      Open client dossier
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="Open listing output from a client dossier to create client-linked send records and show engagement here."
                  title="No client-linked sends yet"
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
                  <article
                    className={`list-row front-office-record tone-${item.tone}`}
                    key={item.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge tone={item.tone}>
                        {item.contextLabel}
                      </StatusBadge>
                    </div>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={item.href}
                    >
                      {item.actionLabel}
                    </FrontOfficeLink>
                  </article>
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="office-button-secondary"
                      href="/office/transactions"
                    >
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
            <div className="office-queue-list">
              {snapshot.noticeRail.notifications.length ? (
                snapshot.noticeRail.notifications.map((notification) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={notification.href}
                      >
                        Open notice
                      </FrontOfficeLink>
                    }
                    badgeLabel={notification.typeLabel}
                    badgeTone="accent"
                    description={notification.body}
                    key={notification.id}
                    meta={
                      <>
                        <span>{notification.createdAtLabel}</span>
                      </>
                    }
                    title={notification.title}
                  />
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
            <div className="office-queue-list">
              {snapshot.noticeRail.resources.length ? (
                snapshot.noticeRail.resources.map((resource) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={resource.href}
                      >
                        Open resource
                      </FrontOfficeLink>
                    }
                    badgeLabel={resource.typeLabel}
                    description={resource.summary}
                    key={resource.id}
                    title={resource.title}
                  />
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
            subtitle="Lease renewal and remarketing windows should show up before they turn into a last-minute fire drill."
            title="Lease-date reminders"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="lease reminders due within the next two weeks"
                label="Due soon"
                value={snapshot.leaseReminders.dueCount}
              />
              <StatCard
                hint="lease reminders already past their target touch date"
                label="Overdue"
                value={snapshot.leaseReminders.overdueCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              {snapshot.leaseReminders.items.length ? (
                snapshot.leaseReminders.items.map((item) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={item.href}
                      >
                        Open client dossier
                      </FrontOfficeLink>
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.tone}
                    description={item.detailLabel}
                    key={item.id}
                    meta={<span>{item.reminderLabel}</span>}
                    title={item.clientName}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Lease-date reminders will appear here once clients start carrying renewal or move timing."
                  title="No lease reminders due"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Operational shortcuts for vendors that agents need during client execution."
            title="Vendor shortcuts"
          >
            <div className="office-queue-list">
              {snapshot.noticeRail.vendors.length ? (
                snapshot.noticeRail.vendors.map((vendor) => (
                  <FrontOfficeRailItem
                    action={
                      vendor.href ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={vendor.href}
                        >
                          Contact vendor
                        </FrontOfficeLink>
                      ) : null
                    }
                    badgeLabel={vendor.category}
                    badgeTone="success"
                    description={vendor.headline}
                    key={vendor.id}
                    meta={
                      <>
                        <span>{vendor.contactLabel}</span>
                      </>
                    }
                    title={vendor.name}
                  />
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

          {snapshot.leadershipQueue.visible ? (
            <SectionCard
              className="office-list-card"
              subtitle="Team leads and office admins should see overdue follow-up pressure before it becomes a formal Back Office fire drill."
              title={snapshot.leadershipQueue.scopeLabel}
            >
              <ListPageStatsGrid>
                <StatCard
                  hint="open shared follow-up tasks already overdue"
                  label="Overdue tasks"
                  value={snapshot.leadershipQueue.overdueTaskCount}
                />
                <StatCard
                  hint="active clients with 15+ days of inactivity"
                  label="15+ day stale"
                  value={snapshot.leadershipQueue.staleClientCount}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list">
                {snapshot.leadershipQueue.items.length ? (
                  snapshot.leadershipQueue.items.map((item) => (
                    <FrontOfficeRailItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      }
                      badgeLabel={item.contextLabel}
                      badgeTone={item.tone}
                      description={item.description}
                      key={item.id}
                      title={item.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="No overdue team or office follow-up pressure is visible right now."
                    title="Leadership queue is clear"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Office scope"
            value={
              context.currentOffice?.name ?? context.currentOrganization.name
            }
          />
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip
            label="Today actions"
            tone="accent"
            value={snapshot.summary.todayActionCount}
          />
          <SummaryChip
            label="Follow-up due"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label="Lease reminders"
            tone="accent"
            value={snapshot.summary.leaseReminderCount}
          />
          <SummaryChip
            label="Overdue tasks"
            value={snapshot.summary.overdueTaskCount}
          />
          <SummaryChip
            label="15+ day stale"
            value={snapshot.summary.staleClientCount}
          />
          <SummaryChip
            label="Today commitments"
            value={snapshot.summary.todayCommitmentCount}
          />
          <SummaryChip
            label="Needs Back Office"
            tone="accent"
            value={snapshot.summary.needsBackOfficeCount}
          />
          {snapshot.leadershipQueue.visible ? (
            <SummaryChip
              label="Leadership pressure"
              tone="accent"
              value={snapshot.summary.leadershipPressureCount}
            />
          ) : null}
        </>
      }
      title="Front Office dashboard"
    />
  );
}
