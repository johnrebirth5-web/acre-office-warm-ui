import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeClientsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { getSessionAccess, requireSessionContext } from "../../../lib/auth-session";

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
    timeZone: context.currentUser.timezone
  });

  return (
    <FrontOfficePageTemplate
      description="Client work stays lean here: pipeline visibility, follow-up context, and the next conversation to move."
      eyebrow="Clients"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Front Office keeps the active client list readable and action-oriented instead of forcing agents through a heavy CRM workflow."
          title="Active client pipeline"
        >
          <ListPageStatsGrid>
            {snapshot.stageMetrics.length ? (
              snapshot.stageMetrics.map((metric) => (
                <StatCard
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
                description="Client stage distribution will appear here once Front Office starts managing live CRM records in this scope."
                title="No stages in view"
              />
            )}
          </ListPageStatsGrid>

          <div className="list-column front-office-record-list">
            {snapshot.clients.length ? (
              snapshot.clients.map((client) => (
                <article className="list-row front-office-record" key={client.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{client.fullName}</strong>
                      <p>{client.intentLabel} · {client.budgetLabel}</p>
                    </div>
                    <StatusBadge tone={client.stageTone}>{client.stage}</StatusBadge>
                  </div>
                  <p>{client.areasLabel}</p>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{client.sourceLabel}</span>
                    <span>{client.lastTouchLabel}</span>
                    <span>{client.nextTouchLabel}</span>
                  </div>
                  <FrontOfficeLink className="office-inline-link front-office-inline-link" href={client.href}>
                    Open client workspace
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
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="A compact read on how much active client pressure exists in this route."
            title="Workflow signals"
          >
            <ListPageStatsGrid>
              <StatCard hint="records visible in this scope" label="Live contacts" value={snapshot.summary.liveContacts} />
              <StatCard hint="stages represented in the current list" label="Active stages" value={snapshot.summary.activeStages} />
              <StatCard hint="overdue or same-day follow-up markers in scope" label="Follow-up due" value={snapshot.summary.followUpDueCount} />
              <StatCard hint="scheduled follow-up tasks already overdue" label="Overdue tasks" value={snapshot.summary.overdueTaskCount} />
              <StatCard hint="current role template in Front Office" label="Access" tone="accent" value={access.label} />
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
          <SummaryChip label="Access" value={access.label} />
          <SummaryChip label="Live contacts" value={snapshot.summary.liveContacts} />
          <SummaryChip label="Follow-up due" tone="accent" value={snapshot.summary.followUpDueCount} />
          <SummaryChip label="Stages in view" value={snapshot.summary.activeStages} />
          <SummaryChip label="Overdue tasks" value={snapshot.summary.overdueTaskCount} />
        </>
      }
      title="Client pipeline"
    />
  );
}
