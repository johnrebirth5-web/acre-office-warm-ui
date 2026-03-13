import { summarizeAccess } from "@acre/auth";
import { listClients } from "@acre/backoffice";
import { ListPageSplit, PageHeader, PageHeaderSummary, PageShell, SectionCard, StatCard, SummaryChip } from "@acre/ui";

export default function AgentClientsPage() {
  const access = summarizeAccess("agent");
  const clientFeed = listClients();

  return (
    <PageShell className="office-agent-page">
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Role access" value={access.label} />
            <SummaryChip label="Live contacts" value={clientFeed.length} />
          </PageHeaderSummary>
        }
        description="Lean CRM capture, useful reminders, and clear next actions instead of heavy enterprise overhead."
        eyebrow="Clients CRM"
        title="Lightweight funnel, not a bloated sales system."
      />

      <ListPageSplit className="office-agent-workspace">
        <SectionCard title="CRM design constraints" subtitle="Every feature here should reduce agent typing, not increase it.">
          <div className="list-column">
            {clientFeed.map((client) => (
              <article className="list-row" key={client.id}>
                <div className="list-row-top">
                  <strong>{client.fullName}</strong>
                  <span className="office-status-badge office-status-badge-neutral">{client.stage}</span>
                </div>
                <p>{client.intent} · {client.budget}</p>
                <p>{client.areas.join(", ")}</p>
                <div className="list-row-meta">
                  <span>{client.source}</span>
                  <span>Last contact {client.lastContactLabel}</span>
                  <span>Next {client.nextFollowUpLabel}</span>
                </div>
              </article>
              ))}
            </div>
        </SectionCard>

        <SectionCard title="Planned outputs" subtitle="These blocks correspond to the core CRM workflow.">
          <div className="stats-grid office-agent-stats-grid">
            <StatCard label="Role access" value={`${access.permissionCount} perms`} hint="CRM stays lean for field speed." />
            <StatCard label="OCR extraction" value="Phase 1" hint="Capture name, budget, area, and intent." />
            <StatCard label="Reminder engine" value="Phase 1" hint="Date-based prompts for client touchpoints." />
            <StatCard label="Reply generation" value="Phase 2" hint="Context-aware follow-up text generation." />
          </div>
        </SectionCard>
      </ListPageSplit>
    </PageShell>
  );
}
