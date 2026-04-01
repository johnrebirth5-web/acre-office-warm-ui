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
import { FrontOfficeListingsOutputClient } from "./front-office-listings-output-client";
import { requireSessionContext } from "../../../lib/auth-session";

export default async function AgentListingsPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "listings:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const snapshot = await getFrontOfficeListingsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
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
          <SummaryChip label="Surface" value="Outreach" />
        </>
      }
      title="Listing output"
    />
  );
}
