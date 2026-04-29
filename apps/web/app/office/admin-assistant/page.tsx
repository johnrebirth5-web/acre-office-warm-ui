import { canAccessAdminGpt } from "../../../lib/admin-gpt/access";
import { requireOfficeSession } from "../../../lib/auth-session";
import {
  ListPageStack,
  PageHeader,
  PageHeaderSummary,
  PageShell,
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
  const connectionStatus = gptUrl ? "Connected" : "Setup needed";

  return (
    <PageShell>
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Access" value="Admin only" />
            <SummaryChip label="Mode" value="External GPT" />
            <SummaryChip label="Status" value={connectionStatus} />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title="Admin Assistant"
      />

      <ListPageStack>
        <SectionCard
          subtitle="Ask Acre usage, feature availability, and testing questions in the connected ChatGPT workspace."
          title="Acre Admin GPT Chat"
        >
          <div className="office-admin-gpt-chatbox">
            <div className="office-admin-gpt-thread">
              <div className="office-admin-gpt-message office-admin-gpt-message-assistant">
                <span>Acre Admin GPT</span>
                <p>
                  I can help administrators learn where to work in Acre, what each
                  Back Office page does, whether a feature already exists, and how
                  to triage visible errors during testing.
                </p>
              </div>
              <div className="office-admin-gpt-message office-admin-gpt-message-user">
                <span>Example</span>
                <p>Where do I enter a new deal, and what information is required?</p>
              </div>
              <div className="office-admin-gpt-message office-admin-gpt-message-assistant">
                <span>Acre Admin GPT</span>
                <p>
                  Open the connected GPT to chat and drag screenshots directly
                  into ChatGPT. Acre exposes only read-only help actions.
                </p>
              </div>
            </div>
            <div className="office-admin-gpt-composer" aria-label="Acre Admin GPT launch area">
              <span>
                {gptUrl
                  ? "Open the assistant to start a protected admin-help chat."
                  : "GPT URL is not configured yet. Create the custom GPT, then set NEXT_PUBLIC_ACRE_ADMIN_GPT_URL."}
              </span>
              {gptUrl ? (
                <a
                  className="office-button office-button-primary"
                  href={gptUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Chat
                </a>
              ) : (
                <button className="office-button" disabled type="button">
                  Waiting for GPT URL
                </button>
              )}
            </div>
          </div>
        </SectionCard>
      </ListPageStack>
    </PageShell>
  );
}
