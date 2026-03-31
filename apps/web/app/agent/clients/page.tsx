import { summarizeAccess } from "@acre/auth";
import { listClients } from "@acre/backoffice";
import { EmptyState, ListPageStatsGrid, SectionCard, StatCard, StatusBadge, SummaryChip } from "@acre/ui";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";

export default function AgentClientsPage() {
  const access = summarizeAccess("agent");
  const clientFeed = listClients();
  const followUpDueCount = clientFeed.filter((client) => client.nextFollowUpLabel.toLowerCase().includes("today")).length;
  const activeStageCount = new Set(clientFeed.map((client) => client.stage)).size;

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
          <div className="list-column front-office-record-list">
            {clientFeed.length ? (
              clientFeed.map((client) => (
                <article className="list-row front-office-record" key={client.id}>
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{client.fullName}</strong>
                      <p>{client.intent} · {client.budget}</p>
                    </div>
                    <StatusBadge tone="accent">{client.stage}</StatusBadge>
                  </div>
                  <p>{client.areas.join(", ")}</p>
                  <div className="list-row-meta front-office-record-meta">
                    <span>{client.source}</span>
                    <span>Last contact {client.lastContactLabel}</span>
                    <span>Next {client.nextFollowUpLabel}</span>
                  </div>
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
              <StatCard hint="records visible in this scope" label="Live contacts" value={clientFeed.length} />
              <StatCard hint="stages represented in the current list" label="Active stages" value={activeStageCount} />
              <StatCard hint="same-day follow-up markers in the feed" label="Follow-up due" value={followUpDueCount} />
              <StatCard hint="current role template in Front Office" label="Access" tone="accent" value={access.label} />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="These are the operating rules for the page until real FO CRM write flows replace the mock feed."
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
          <SummaryChip label="Live contacts" value={clientFeed.length} />
          <SummaryChip label="Follow-up due" tone="accent" value={followUpDueCount} />
          <SummaryChip label="Stages in view" value={activeStageCount} />
        </>
      }
      title="Client pipeline"
    />
  );
}
