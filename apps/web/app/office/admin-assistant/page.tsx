import { canAccessAdminGpt } from "../../../lib/admin-gpt/access";
import { requireOfficeSession } from "../../../lib/auth-session";
import { AdminAssistantChatClient } from "./admin-assistant-chat-client";
import {
  ListPageStack,
  PageHeader,
  PageHeaderSummary,
  PageShell,
  SectionCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";

export default async function OfficeAdminAssistantPage() {
  const context = await requireOfficeSession();

  if (!canAccessAdminGpt(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <PageHeaderSummary>
            <SummaryChip label="Access" value="Admin only" />
            <SummaryChip label="Mode" value="Internal assistant" />
            <SummaryChip label="Storage" value="No Acre chat log" />
          </PageHeaderSummary>
        }
        eyebrow="Office admin"
        title="Admin Assistant"
      />

      <ListPageStack>
        <SectionCard
          subtitle="Ask Acre usage, feature availability, screenshot, and testing questions through the internal assistant."
          title="Acre Admin Assistant Chat"
        >
          <AdminAssistantChatClient />
        </SectionCard>
      </ListPageStack>
    </PageShell>
  );
}
