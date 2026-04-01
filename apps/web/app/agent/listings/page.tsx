import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeListingsSnapshot } from "@acre/db";
import {
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeAgentMaterialWindow } from "./front-office-agent-material-window";
import { FrontOfficeListingsOutputClient } from "./front-office-listings-output-client";
import { requireSessionContext } from "../../../lib/auth-session";

type AgentListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function AgentListingsPage(props: AgentListingsPageProps) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "listings:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const searchParams = (await props.searchParams) ?? {};
  const targetClientId = readSearchParamValue(searchParams.clientId)?.trim();
  const snapshot = await getFrontOfficeListingsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    targetClientId,
  });

  return (
    <FrontOfficePageTemplate
      description="Listings in Front Office are about recommendation, outreach, and content output, not back-office inventory administration."
      eyebrow="Listings"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Use this list as the send-ready inventory surface for active client outreach."
          title="Send-ready inventory"
        >
          <FrontOfficeListingsOutputClient snapshot={snapshot} />
        </SectionCard>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Quick read on the current listing output surface."
            title="Output signals"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="inventory visible to agents"
                label="Listings"
                value={snapshot.summary.listingCount}
              />
              <StatCard
                hint="currently marked public-ready"
                label="Public-ready"
                value={snapshot.summary.publicReadyCount}
              />
              <StatCard
                hint="sum of tracked links already created by you"
                label="Tracked links"
                value={snapshot.summary.trackedLinks}
              />
              <StatCard
                hint="sum of tracked clicks in your feed"
                label="Tracked clicks"
                value={snapshot.summary.trackedClicks}
              />
              <StatCard
                hint="current view target"
                label="Surface"
                tone="accent"
                value="Send-ready"
              />
            </ListPageStatsGrid>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Client-linked sends are the current Front Office priority because they close the execution loop."
            title="Send context"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel={
                  snapshot.targetClient ? snapshot.targetClient.stage : "Mode"
                }
                description={
                  snapshot.targetClient
                    ? `${snapshot.targetClient.nextTouchLabel}. Sends from this page will now be attributed back to this dossier.`
                    : "Open listing output from a client dossier to record who the send was for, which channel was used, and whether they opened it."
                }
                title={
                  snapshot.targetClient
                    ? snapshot.targetClient.fullName
                    : "Generic tracked-link mode"
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Business card, profile assets, recent closings, and send-ready intro copy should stay beside listing output."
            title="Agent material window"
          >
            <FrontOfficeAgentMaterialWindow material={snapshot.agentMaterial} />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This route should feel like an output terminal, not an admin inventory console."
            title="Output modes"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Links"
                description="Use listing-level links to connect outreach back to click behavior without leaving Front Office."
                title="Tracked share link"
              />
              <FrontOfficeRailItem
                badgeLabel="Media"
                description="Generate presentation-ready listing output with agent identity and compliant property framing."
                title="Poster export"
              />
              <FrontOfficeRailItem
                badgeLabel="Notes"
                description="Add client-specific framing or local insight without turning this route into a full listing-admin workflow."
                title="Custom notes"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip label="Listings" value={snapshot.summary.listingCount} />
          <SummaryChip
            label="Public-ready"
            value={snapshot.summary.publicReadyCount}
          />
          <SummaryChip
            label="Tracked links"
            value={snapshot.summary.trackedLinks}
          />
          <SummaryChip
            label="Tracked clicks"
            tone="accent"
            value={snapshot.summary.trackedClicks}
          />
          {snapshot.targetClient ? (
            <SummaryChip
              label="Recipient"
              tone="accent"
              value={snapshot.targetClient.fullName}
            />
          ) : null}
          <SummaryChip label="Surface" value="Outreach" />
        </>
      }
      title="Listing output"
    />
  );
}
