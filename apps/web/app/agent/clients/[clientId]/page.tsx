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
import { FrontOfficeClientChatListClient } from "./front-office-client-chat-list-client";
import { FrontOfficeClientAiSuggestionsClient } from "./front-office-client-ai-suggestions-client";
import { FrontOfficeClientDossierClient } from "./front-office-client-dossier-client";
import { FrontOfficeClientLeaseReminderClient } from "./front-office-client-lease-reminder-client";
import {
  getSessionAccess,
  requireSessionContext,
} from "../../../../lib/auth-session";

type AgentClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
  searchParams: Promise<{
    followUpTitle?: string;
    followUpDueAt?: string;
    followUpSource?: string;
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
  const searchParams = await props.searchParams;
  const access = getSessionAccess(context);
  const canUseAi = can(context.currentMembership, "ai:use");
  const suggestedFollowUpTitle = searchParams.followUpTitle?.trim() || "";
  const suggestedFollowUpDueAt =
    searchParams.followUpDueAt &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.followUpDueAt)
      ? searchParams.followUpDueAt
      : undefined;
  const suggestedFollowUp = suggestedFollowUpTitle
    ? {
        title: suggestedFollowUpTitle,
        dueAt: suggestedFollowUpDueAt,
        sourceLabel:
          searchParams.followUpSource === "ai"
            ? "AI suggestion loaded into the follow-up form below."
            : null,
      }
    : null;
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
            actions={
              <a
                className="office-button-secondary"
                href={`/api/agent/clients/${snapshot.id}/pdf`}
                rel="noreferrer"
                target="_blank"
              >
                Download client PDF
              </a>
            }
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
                <span>Lease end</span>
                <strong>{snapshot.leaseReminder.leaseEndDateLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Lease reminder</span>
                <strong>{snapshot.leaseReminder.reminderAtLabel}</strong>
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
            subtitle="Lease renewal and remarketing dates should live beside the live client dossier, not inside a separate spreadsheet."
            title="Lease-date reminder"
          >
            <FrontOfficeClientLeaseReminderClient snapshot={snapshot} />
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
                          href={appointment.listingOutputHref}
                        >
                          Open listing output
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

            <FrontOfficeClientDossierClient
              snapshot={snapshot}
              suggestedFollowUp={suggestedFollowUp}
            />
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeLink
                className="office-button-secondary"
                href={`/agent/listings?clientId=${snapshot.id}`}
              >
                Open listing output
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="Send records turn listing output into a real execution trail, not just clipboard activity."
            title="Send record & engagement"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="client-linked sends recorded from Front Office"
                label="Sends"
                value={snapshot.engagement.sendCount}
              />
              <StatCard
                hint="send records with at least one open"
                label="Opened sends"
                value={snapshot.engagement.openedSendCount}
              />
              <StatCard
                hint="extra opens after the first one"
                label="Revisits"
                value={snapshot.engagement.revisitCount}
              />
              <StatCard
                hint="most recent tracked engagement"
                label="Latest engagement"
                tone="accent"
                value={snapshot.engagement.lastEngagementLabel}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              {snapshot.sendRecords.length ? (
                snapshot.sendRecords.map((record) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={record.href}
                      >
                        Send another listing
                      </FrontOfficeLink>
                    }
                    badgeLabel={record.engagementLabel}
                    badgeTone={record.engagementTone}
                    context={`${record.channelLabel} · ${record.stageLabel}`}
                    description={[`Sent ${record.sentAtLabel}`, record.appointmentLabel]
                      .filter(Boolean)
                      .join(" · ")}
                    key={record.id}
                    meta={<span>{record.lastActivityLabel}</span>}
                    title={record.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={`/agent/listings?clientId=${snapshot.id}`}
                    >
                      Send first listing
                    </FrontOfficeLink>
                  }
                  description="Client-linked listing sends will appear here once you open listing output in this client's context."
                  title="No send record yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeLink
                className="office-button-secondary"
                href={snapshot.negotiation.primaryActionHref}
              >
                {snapshot.negotiation.primaryActionLabel}
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="Keep negotiation prep in Front Office until it needs a formal Back Office offer record, then jump straight into the shared offer workspace."
            title="Offer & negotiation"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across FO prep and BO offer execution"
                label="Workspace stage"
                tone="accent"
                value={snapshot.negotiation.boundaryLabel}
              />
              <StatCard
                hint="formal Back Office offers already tracked for the linked transaction"
                label="BO offers"
                value={snapshot.negotiation.offerCount}
              />
              <StatCard
                hint="offers that are close to expiration in the shared BO workspace"
                label="Expiring soon"
                value={snapshot.negotiation.expiringSoonCount}
              />
              <StatCard
                hint="accepted offer or current primary state"
                label="Accepted / primary"
                value={snapshot.negotiation.acceptedOfferLabel}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              <QueueItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={snapshot.negotiation.primaryActionHref}
                  >
                    {snapshot.negotiation.primaryActionLabel}
                  </FrontOfficeLink>
                }
                badgeLabel={snapshot.negotiation.boundaryLabel}
                badgeTone={snapshot.negotiation.boundaryTone}
                description={snapshot.negotiation.boundaryDescription}
                meta={<span>{snapshot.negotiation.boundaryMetaLabel}</span>}
                title={snapshot.negotiation.boundaryTitle}
              />
            </div>

            <div className="office-queue-list">
              {snapshot.negotiation.offers.length ? (
                snapshot.negotiation.offers.map((offer) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={offer.href}
                      >
                        Open BO offer
                      </FrontOfficeLink>
                    }
                    badgeLabel={offer.statusLabel}
                    badgeTone={offer.statusTone}
                    context={offer.partyLabel}
                    description={[offer.priceLabel, offer.expirationLabel]
                      .filter(Boolean)
                      .join(" · ")}
                    key={offer.id}
                    meta={<span>{offer.updatedAtLabel}</span>}
                    title={offer.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.negotiation.primaryActionHref}
                    >
                      {snapshot.negotiation.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  description={snapshot.negotiation.emptyStateDescription}
                  title={snapshot.negotiation.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              <FrontOfficeLink
                className="office-button-secondary"
                href={snapshot.inspection.primaryActionHref}
              >
                {snapshot.inspection.primaryActionLabel}
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="Inspection-era support should surface the next formal milestone from the shared BO transaction instead of creating a second Front Office checklist."
            title="Inspection & contract support"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across FO prep, contract setup, and live inspection-era BO execution"
                label="Contract stage"
                tone="accent"
                value={snapshot.inspection.boundaryLabel}
              />
              <StatCard
                hint="open checklist work already living on the shared BO transaction"
                label="BO open tasks"
                value={snapshot.inspection.openTaskCount}
              />
              <StatCard
                hint="open signature requests that still need send / review / signer progress"
                label="Pending signatures"
                value={snapshot.inspection.pendingSignatureCount}
              />
              <StatCard
                hint="incoming transaction updates still waiting on BO review"
                label="Review queue"
                value={snapshot.inspection.pendingIncomingUpdateCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              <QueueItem
                action={
                  <FrontOfficeLink
                    className="office-inline-link"
                    href={snapshot.inspection.primaryActionHref}
                  >
                    {snapshot.inspection.primaryActionLabel}
                  </FrontOfficeLink>
                }
                badgeLabel={snapshot.inspection.boundaryLabel}
                badgeTone={snapshot.inspection.boundaryTone}
                description={snapshot.inspection.boundaryDescription}
                meta={<span>{snapshot.inspection.boundaryMetaLabel}</span>}
                title={snapshot.inspection.boundaryTitle}
              />
            </div>

            <div className="office-queue-list">
              {snapshot.inspection.items.length ? (
                snapshot.inspection.items.map((item) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link"
                        href={item.href}
                      >
                        {item.actionLabel}
                      </FrontOfficeLink>
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.statusTone}
                    context={item.contextLabel}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.inspection.primaryActionHref}
                    >
                      {snapshot.inspection.primaryActionLabel}
                    </FrontOfficeLink>
                  }
                  description={snapshot.inspection.emptyStateDescription}
                  title={snapshot.inspection.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            actions={
              snapshot.closing.primaryActionOpensInNewTab ? (
                <a
                  className="office-button-secondary"
                  href={snapshot.closing.primaryActionHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {snapshot.closing.primaryActionLabel}
                </a>
              ) : (
                <FrontOfficeLink
                  className="office-button-secondary"
                  href={snapshot.closing.primaryActionHref}
                >
                  {snapshot.closing.primaryActionLabel}
                </FrontOfficeLink>
              )
            }
            className="office-list-card"
            subtitle="Once the formal deal is active or closed, Front Office should turn that shared BO outcome into smart wrap-up and post-close guidance instead of stopping at status visibility."
            title="Closing & win suggestions"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="where this client currently sits across pre-close planning, fresh win follow-through, and post-close nurture"
                label="Close stage"
                tone={
                  snapshot.closing.boundaryTone === "neutral"
                    ? "default"
                    : "accent"
                }
                value={snapshot.closing.boundaryLabel}
              />
              <StatCard
                hint="formal shared transaction state currently attached to this dossier"
                label="Deal status"
                value={snapshot.closing.transactionStatusLabel}
              />
              <StatCard
                hint="next shared milestone date captured from the linked transaction"
                label="Key date"
                value={snapshot.closing.keyDateLabel}
              />
              <StatCard
                hint="latest client-facing follow-up timing already visible in Front Office"
                label="Next touch"
                tone="accent"
                value={snapshot.closing.nextTouchLabel}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list">
              <QueueItem
                action={
                  snapshot.closing.primaryActionOpensInNewTab ? (
                    <a
                      className="office-inline-link"
                      href={snapshot.closing.primaryActionHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {snapshot.closing.primaryActionLabel}
                    </a>
                  ) : (
                    <FrontOfficeLink
                      className="office-inline-link"
                      href={snapshot.closing.primaryActionHref}
                    >
                      {snapshot.closing.primaryActionLabel}
                    </FrontOfficeLink>
                  )
                }
                badgeLabel={snapshot.closing.boundaryLabel}
                badgeTone={snapshot.closing.boundaryTone}
                description={snapshot.closing.boundaryDescription}
                meta={<span>{snapshot.closing.boundaryMetaLabel}</span>}
                title={snapshot.closing.boundaryTitle}
              />
            </div>

            <div className="office-queue-list">
              {snapshot.closing.suggestions.length ? (
                snapshot.closing.suggestions.map((item) => (
                  <QueueItem
                    action={
                      item.opensInNewTab ? (
                        <a
                          className="office-inline-link"
                          href={item.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.actionLabel}
                        </a>
                      ) : (
                        <FrontOfficeLink
                          className="office-inline-link"
                          href={item.href}
                        >
                          {item.actionLabel}
                        </FrontOfficeLink>
                      )
                    }
                    badgeLabel={item.statusLabel}
                    badgeTone={item.statusTone}
                    context={item.contextLabel}
                    description={item.description}
                    key={item.id}
                    meta={<span>{item.metaLabel}</span>}
                    title={item.title}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    snapshot.closing.primaryActionOpensInNewTab ? (
                      <a
                        className="office-button-secondary"
                        href={snapshot.closing.primaryActionHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {snapshot.closing.primaryActionLabel}
                      </a>
                    ) : (
                      <FrontOfficeLink
                        className="office-button-secondary"
                        href={snapshot.closing.primaryActionHref}
                      >
                        {snapshot.closing.primaryActionLabel}
                      </FrontOfficeLink>
                    )
                  }
                  description={snapshot.closing.emptyStateDescription}
                  title={snapshot.closing.emptyStateTitle}
                />
              )}
            </div>
          </SectionCard>

          {canUseAi ? (
            <div id="front-office-ai-suggestions">
              <SectionCard
                actions={
                  snapshot.aiSuggestions.primaryActionOpensInNewTab ? (
                    <a
                      className="office-button-secondary"
                      href={snapshot.aiSuggestions.primaryActionHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {snapshot.aiSuggestions.primaryActionLabel}
                    </a>
                  ) : (
                    <FrontOfficeLink
                      className="office-button-secondary"
                      href={snapshot.aiSuggestions.primaryActionHref}
                    >
                      {snapshot.aiSuggestions.primaryActionLabel}
                    </FrontOfficeLink>
                  )
                }
                className="office-list-card"
                subtitle="Acre now grounds the next-touch suggestion in the live dossier trail, but still leaves the final wording and send decision to the agent."
                title="AI next-touch suggestions"
              >
                <FrontOfficeClientAiSuggestionsClient snapshot={snapshot} />
              </SectionCard>
            </div>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="Phone strategy and copy-ready outreach stay embedded in the active dossier instead of hiding in a training doc."
            title="Chat List & phone strategy"
          >
            <FrontOfficeClientChatListClient snapshot={snapshot} />
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
            label="Lease reminder"
            tone={snapshot.leaseReminder.needsAttention ? "accent" : "default"}
            value={snapshot.leaseReminder.statusLabel}
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
          <SummaryChip
            label="Negotiation"
            tone="accent"
            value={snapshot.negotiation.boundaryLabel}
          />
          <SummaryChip
            label="Contract support"
            tone="accent"
            value={snapshot.inspection.boundaryLabel}
          />
          <SummaryChip
            label="Closing"
            tone="accent"
            value={snapshot.closing.boundaryLabel}
          />
          {canUseAi ? (
            <SummaryChip
              label="AI next touch"
              value={snapshot.aiSuggestions.statusLabel}
            />
          ) : null}
        </>
      }
      title={snapshot.fullName}
    />
  );
}
