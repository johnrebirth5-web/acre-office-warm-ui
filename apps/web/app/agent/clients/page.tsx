import { can } from "@acre/auth";
import { getFrontOfficeClientsSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { FrontOfficeAccessNotice } from "../_components/front-office-access-notice";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import { FrontOfficeLink } from "../_components/front-office-link";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeClientsWorkbenchClient } from "./front-office-clients-workbench-client";
import { requireSessionContext } from "../../../lib/auth-session";

export default async function AgentClientsPage() {
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

  const snapshot = await getFrontOfficeClientsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  const duplicatePreviewCandidates: FrontOfficeLeadDuplicatePreviewCandidate[] =
    snapshot.clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      stage: client.stage,
      sourceLabel: client.sourceLabel,
      nextTouchLabel: client.nextTouchLabel,
      href: client.href,
      areasLabel: client.areasLabel,
    }));

  return (
    <FrontOfficePageTemplate
      description="Keep the Front Office client page focused on the current follow-up clock, a lightweight note, and the few fields that actually drive execution."
      eyebrow="Front Office"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="A lightweight queue built around the current follow-up clock."
            title="Client follow-up queue"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="Clients assigned to you"
                label="Live clients"
                tone="accent"
                value={snapshot.summary.liveContacts}
              />
              <StatCard
                hint="Due today or already overdue"
                label="Due now"
                tone="accent"
                value={snapshot.summary.followUpDueCount}
              />
              <StatCard
                hint="Clients missing a dated next reminder"
                label="Missing reminder"
                tone="default"
                value={snapshot.summary.missingNextTouchCount}
              />
              <StatCard
                hint="Potential duplicate pairs still visible"
                label="Duplicate review"
                tone="accent"
                value={snapshot.summary.potentialDuplicateCount}
              />
            </ListPageStatsGrid>

            {snapshot.clients.length ? (
              <FrontOfficeClientsWorkbenchClient clients={snapshot.clients} />
            ) : (
              <EmptyState
                description="The queue stays intentionally light. Add one new lead in the intake section below and Acre will place it into this follow-up list."
                title="No clients in your follow-up queue"
              />
            )}
          </SectionCard>

          <FrontOfficeLeadIntakeCard
            initialDuplicatePreviewCandidates={duplicatePreviewCandidates}
            sourceSurface="clients"
            subtitle="AI only fills Name, Budget, Target Area, and Follow-up Status. Everything else is folded into a Note that you can still edit."
            title="Quick intake"
          />

          {snapshot.duplicatePairs.length ? (
            <SectionCard
              className="office-list-card"
              subtitle="Duplicate review stays available, but it no longer dominates the main queue."
              title="Duplicate review"
            >
              <div className="office-queue-list">
                {snapshot.duplicatePairs.slice(0, 4).map((pair) => (
                  <QueueItem
                    badgeLabel={pair.matchReasons.join(" · ")}
                    badgeTone="warning"
                    description={pair.rationaleLabel}
                    key={pair.id}
                    meta={
                      <>
                        <span>Keep: {pair.recommendedClient.fullName}</span>
                        <span>Review: {pair.duplicateClient.fullName}</span>
                      </>
                    }
                    action={
                      <>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={pair.recommendedClient.href}
                        >
                          Open keep record
                        </FrontOfficeLink>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={pair.duplicateClient.href}
                        >
                          Open duplicate
                        </FrontOfficeLink>
                      </>
                    }
                    title={pair.matchReasons.join(" / ")}
                  />
                ))}
              </div>
            </SectionCard>
          ) : null}
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Live clients"
            tone="accent"
            value={snapshot.summary.liveContacts}
          />
          <SummaryChip
            label="Due now"
            tone="accent"
            value={snapshot.summary.followUpDueCount}
          />
          <SummaryChip
            label="Duplicate review"
            tone="accent"
            value={snapshot.summary.potentialDuplicateCount}
          />
        </>
      }
      title="Clients"
    />
  );
}
