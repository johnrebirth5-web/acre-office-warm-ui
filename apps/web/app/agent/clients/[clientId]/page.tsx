import Link from "next/link";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeClientDetail } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { FrontOfficeLink } from "../../_components/front-office-link";
import { FrontOfficePageTemplate } from "../../_components/front-office-page-template";
import { FrontOfficeClientDossierClient } from "./front-office-client-dossier-client";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../../lib/auth-session";

type AgentClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function AgentClientDetailPage(
  props: AgentClientDetailPageProps,
) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "clients:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const { clientId } = await props.params;
  const access = getSessionAccess(context);
  const snapshot = await getFrontOfficeClientDetail({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    clientId,
    timeZone: context.currentUser.timezone,
  });

  if (!snapshot) {
    notFound();
  }

  const primaryHandoff = snapshot.handoffs[0] ?? null;

  return (
    <FrontOfficePageTemplate
      description="Client dossier stays focused on execution context: stage movement, next touches, appointments, and the moment formal Back Office workflow needs to take over."
      eyebrow="Client dossier"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Core FO context stays readable here so the next call, showing, or handoff does not require opening a full admin form."
            title="Overview"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="open or in-progress follow-up tasks"
                label="Open follow-up"
                tone="accent"
                value={snapshot.summary.openTaskCount}
              />
              <StatCard
                hint="scheduled appointments from now forward"
                label="Upcoming appointments"
                value={snapshot.summary.upcomingAppointmentCount}
              />
              <StatCard
                hint="recent stage changes captured on this client"
                label="Stage history"
                value={snapshot.summary.stageHistoryCount}
              />
              <StatCard
                hint="draft or ready Back Office handoffs"
                label="BO handoffs"
                tone="accent"
                value={snapshot.summary.openHandoffCount}
              />
            </ListPageStatsGrid>

            <div className="office-detail-grid">
              <div className="office-detail-field">
                <span>Source</span>
                <strong>{snapshot.sourceLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Intent</span>
                <strong>{snapshot.intentLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Budget</span>
                <strong>{snapshot.budgetLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Preferred areas</span>
                <strong>{snapshot.preferredAreasLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Owner</span>
                <strong>{snapshot.ownerLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Last touch</span>
                <strong>{snapshot.lastTouchLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Next touch</span>
                <strong>{snapshot.nextTouchLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Email</span>
                <strong>{snapshot.email || "No email captured"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Phone</span>
                <strong>{snapshot.phone || "No phone captured"}</strong>
              </div>
              <div className="office-detail-field office-detail-field-wide">
                <span>Notes</span>
                <strong>{snapshot.notesLabel}</strong>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Stage changes are now durable FO records instead of hidden CRM mutations."
            title="Stage timeline"
          >
            <div className="office-queue-list">
              {snapshot.stageHistory.length ? (
                snapshot.stageHistory.map((entry) => (
                  <QueueItem
                    badgeLabel={entry.changedAtLabel}
                    badgeTone={entry.tone}
                    description={entry.description}
                    key={entry.id}
                    title={entry.title}
                  />
                ))
              ) : (
                <EmptyState
                  description="Stage changes will appear here as this client moves through Front Office."
                  title="No stage history yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Appointments and follow-up tasks stay visible together so the next move is obvious."
            title="Appointments & follow-up"
          >
            <div className="office-list-page-stack">
              <div className="office-queue-list">
                {snapshot.appointments.length ? (
                  snapshot.appointments.map((appointment) => (
                    <QueueItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link"
                          href={`/agent/calendar?clientId=${snapshot.id}`}
                        >
                          Schedule another appointment
                        </FrontOfficeLink>
                      }
                      badgeLabel={appointment.typeLabel}
                      badgeTone={appointment.typeTone}
                      context={appointment.statusLabel}
                      description={`${appointment.startsAtLabel} · ${appointment.locationLabel}`}
                      key={appointment.id}
                      meta={<span>{appointment.contextLabel}</span>}
                      title={appointment.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    action={
                      <FrontOfficeLink
                        className="office-button-secondary"
                        href={`/agent/calendar?clientId=${snapshot.id}`}
                      >
                        Schedule appointment
                      </FrontOfficeLink>
                    }
                    description="Showings, consultations, and meetings for this client will surface here."
                    title="No appointments yet"
                  />
                )}
              </div>
            </div>

            <FrontOfficeClientDossierClient snapshot={snapshot} />
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="The dossier should help the agent act immediately, not only describe the record."
            title="Next actions"
          >
            <div className="office-queue-list">
              <QueueItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={snapshot.workflow.actionHref}
                  >
                    {snapshot.workflow.actionLabel}
                  </FrontOfficeLink>
                }
                badgeLabel={snapshot.workflow.pressureLabel}
                badgeTone={snapshot.workflow.pressureTone}
                description={snapshot.workflow.nextStepDescription}
                title={snapshot.workflow.nextStepTitle}
              />
              <QueueItem
                action={
                  snapshot.email ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={`mailto:${snapshot.email}`}
                    >
                      Email client
                    </FrontOfficeLink>
                  ) : undefined
                }
                badgeLabel="Contact"
                badgeTone="neutral"
                description={
                  snapshot.phone
                    ? `Phone on record: ${snapshot.phone}`
                    : "No direct phone on record yet."
                }
                title="Use the latest contact info"
              />
              <QueueItem
                action={
                  primaryHandoff ? (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={primaryHandoff.href}
                    >
                      {primaryHandoff.statusLabel === "Committed"
                        ? "Open Back Office record"
                        : "Open Back Office create flow"}
                    </FrontOfficeLink>
                  ) : undefined
                }
                badgeLabel="BO"
                badgeTone={primaryHandoff?.tone ?? "neutral"}
                description={
                  primaryHandoff
                    ? primaryHandoff.summary
                    : "This client has not yet reached a formal Back Office handoff stage."
                }
                title={
                  primaryHandoff
                    ? `${primaryHandoff.statusLabel} · ${primaryHandoff.stageLabel}`
                    : "No active Back Office handoff"
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Once formal transaction work starts, Front Office should point into the shared BO record instead of duplicating it."
            title="Back Office context"
          >
            <div className="office-queue-list">
              {snapshot.handoffs.length ? (
                snapshot.handoffs.map((handoff) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={handoff.href}
                      >
                        {handoff.statusLabel === "Committed"
                          ? "Open transaction"
                          : "Open create flow"}
                      </FrontOfficeLink>
                    }
                    badgeLabel={handoff.statusLabel}
                    badgeTone={handoff.tone}
                    description={handoff.summary}
                    key={handoff.id}
                    meta={<span>{handoff.updatedAtLabel}</span>}
                    title={handoff.stageLabel}
                  />
                ))
              ) : (
                <EmptyState
                  description="When this client reaches negotiation, offer, application, or contract-style stages, the BO handoff queue will show up here."
                  title="No Back Office handoff yet"
                />
              )}
            </div>

            <div className="office-queue-list">
              {snapshot.linkedTransactions.length ? (
                snapshot.linkedTransactions.map((transaction) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={transaction.href}
                      >
                        Open transaction
                      </FrontOfficeLink>
                    }
                    badgeLabel={transaction.statusLabel}
                    badgeTone="accent"
                    description={transaction.roleLabel}
                    key={transaction.id}
                    title={transaction.label}
                  />
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
                  description="Linked transaction records will appear here after the formal BO workflow begins."
                  title="No linked transactions"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip label="Stage" tone="accent" value={snapshot.stage} />
          <SummaryChip
            label="Workflow"
            value={snapshot.workflow.pressureLabel}
          />
          <SummaryChip
            label="Open follow-up"
            value={snapshot.summary.openTaskCount}
          />
          <SummaryChip
            label="Upcoming appointments"
            value={snapshot.summary.upcomingAppointmentCount}
          />
          <SummaryChip
            label="BO handoffs"
            tone="accent"
            value={snapshot.summary.openHandoffCount}
          />
        </>
      }
      title={snapshot.fullName}
    />
  );
}
