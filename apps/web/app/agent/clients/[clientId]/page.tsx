import { can } from "@acre/auth";
import { getContactById } from "@acre/db";
import { QueueItem, SectionCard, StatusBadge, SummaryChip } from "@acre/ui";
import { notFound } from "next/navigation";
import { FrontOfficeAccessNotice } from "../../_components/front-office-access-notice";
import { FrontOfficePageTemplate } from "../../_components/front-office-page-template";
import { FrontOfficeClientExecutionClient } from "./front-office-client-execution-client";
import { requireSessionContext } from "../../../../lib/auth-session";

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
    return (
      <FrontOfficeAccessNotice
        currentMembership={context.currentMembership}
        featureKey="clients"
        userLocale={context.currentUser.locale}
      />
    );
  }

  const { clientId } = await props.params;
  const contact = await getContactById({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    contactId: clientId,
  });

  if (!contact) {
    notFound();
  }

  const legacyOpenTaskCount = contact.followUpTasks.filter(
    (task) => task.status !== "completed" && task.status !== "canceled",
  ).length;
  const linkedBackOfficeHref = contact.linkedTransactions[0]
    ? `/office/transactions/${contact.linkedTransactions[0].id}`
    : null;

  return (
    <FrontOfficePageTemplate
      description="This page keeps the client record focused on the next follow-up move, the current reminder clock, and one editable note."
      eyebrow="Front Office"
      main={
        <FrontOfficeClientExecutionClient
          contact={contact}
          legacyOpenTaskCount={legacyOpenTaskCount}
          linkedBackOfficeHref={linkedBackOfficeHref}
        />
      }
      rail={
        <SectionCard
          className="office-list-card"
          subtitle="Core execution context only."
          title="Current snapshot"
        >
          <div className="office-queue-list">
            <QueueItem
              badge={
                <StatusBadge tone="accent">
                  {contact.followUpStatusLabel}
                </StatusBadge>
              }
              context={contact.followUpReminderModeLabel}
              description={`${contact.budgetMax || "Budget not set"} · ${contact.areas.join(", ") || "Target area not set"}`}
              meta={
                <>
                  <span>
                    Last follow-up:{" "}
                    {contact.lastContactAt || "Not followed up yet"}
                  </span>
                  <span>
                    Next reminder: {contact.nextFollowUpAt || "Not set"}
                  </span>
                  {legacyOpenTaskCount > 0 ? (
                    <span>Legacy follow-up tasks: {legacyOpenTaskCount}</span>
                  ) : null}
                </>
              }
              title={contact.displayName}
            />
          </div>
        </SectionCard>
      }
      summary={
        <>
          <SummaryChip
            label="Follow-up status"
            tone="accent"
            value={contact.followUpStatusLabel}
          />
          <SummaryChip
            label="Next reminder"
            tone="accent"
            value={contact.nextFollowUpAt || "Not set"}
          />
          <SummaryChip
            label="Legacy tasks"
            tone={legacyOpenTaskCount > 0 ? "accent" : "default"}
            value={legacyOpenTaskCount}
          />
        </>
      }
      title={contact.displayName}
    />
  );
}
