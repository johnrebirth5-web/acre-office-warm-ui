import { canAccessAdminGpt } from "../../../lib/admin-gpt/access";
import {
  ADMIN_GPT_FEATURE_CATALOG,
  getAdminGptFeatureCatalogSummary,
} from "../../../lib/admin-gpt/catalog";
import { requireOfficeSession } from "../../../lib/auth-session";
import {
  ListPageStack,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  QueueItem,
  SecondaryMetaList,
  SectionCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";

function getConfiguredGptUrl() {
  return process.env.NEXT_PUBLIC_ACRE_ADMIN_GPT_URL?.trim() || null;
}

export default async function OfficeAdminAssistantPage() {
  const context = await requireOfficeSession();

  if (!canAccessAdminGpt(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const gptUrl = getConfiguredGptUrl();
  const catalogSummary = getAdminGptFeatureCatalogSummary();
  const highlightedFeatures = ADMIN_GPT_FEATURE_CATALOG.filter(
    (entry) => entry.status !== "not_available",
  ).slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Access" value="Admin only" />
            <SummaryChip label="Mode" value="External GPT" />
            <SummaryChip label="Catalog" value={`${catalogSummary.total} topics`} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title="Admin Assistant"
      />

      <ListPageStack>
        <SectionCard
          actions={
            gptUrl ? (
              <a
                className="office-button office-button-primary"
                href={gptUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Acre Admin GPT
              </a>
            ) : (
              <span className="office-badge office-badge-warning">
                GPT URL not configured
              </span>
            )
          }
          subtitle="Chat, screenshot review, and image drag/drop happen in ChatGPT. Acre only exposes read-only admin-help actions."
          title="Acre Admin GPT"
        >
          <SecondaryMetaList
            items={[
              {
                label: "OAuth authorize URL",
                value: "/api/admin-gpt/oauth/authorize",
              },
              {
                label: "OAuth token URL",
                value: "/api/admin-gpt/oauth/token",
              },
              {
                label: "Action schema",
                value: "/api/admin-gpt/openapi.json",
              },
              {
                label: "Scope",
                value: "admin_help:read",
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          subtitle="The assistant can answer usage, feature availability, and testing questions. It cannot change Acre."
          title="Boundaries"
        >
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="Read only"
              badgeTone="success"
              description="No code edits, database changes, production deploys, destructive actions, or credential handling are exposed through these actions."
              title="Strict action boundary"
            />
            <QueueItem
              badgeLabel="No persistence"
              badgeTone="accent"
              description="Acre does not save the full GPT conversation, uploaded screenshots, or assistant answers. Infrastructure access logs may still exist outside the app."
              title="Conversation storage"
            />
            <QueueItem
              badgeLabel="Screenshots"
              description="Upload screenshots directly into ChatGPT. The Acre action endpoints receive only the model's text summary and visible error text."
              title="Image review path"
            />
          </div>
        </SectionCard>

        <SectionCard
          subtitle="These are the first curated topics exposed to ChatGPT for administrator help."
          title="Knowledge coverage"
        >
          <div className="office-queue-list">
            {highlightedFeatures.map((feature) => (
              <QueueItem
                badgeLabel={feature.status}
                badgeTone={feature.status === "available" ? "success" : "warning"}
                context={feature.route ?? "No route"}
                description={feature.summary}
                key={feature.id}
                title={feature.title}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Programmer handoff template">
          <pre className="office-code-block">
{`Page:
Action attempted:
Expected result:
Actual result:
Visible error text:
Screenshot summary:
Reproduction steps:
Business impact:`}
          </pre>
        </SectionCard>
      </ListPageStack>
    </PageShell>
  );
}
