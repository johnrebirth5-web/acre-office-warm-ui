import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeListingsSnapshot } from "@acre/db";
import {
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
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
  const targetAppointmentId = readSearchParamValue(
    searchParams.appointmentId,
  )?.trim();
  const draftChannelValue = readSearchParamValue(
    searchParams.draftChannel,
  )?.trim();
  const draftBodyValue = readSearchParamValue(searchParams.draftBody)?.trim();
  const draftSubjectValue =
    readSearchParamValue(searchParams.draftSubject)?.trim() || "";
  const draftTitleValue =
    readSearchParamValue(searchParams.draftTitle)?.trim() || "";
  const draftChannel: "sms" | "email" | null =
    draftChannelValue === "sms" || draftChannelValue === "email"
      ? draftChannelValue
      : null;
  const draftAssist =
    draftChannel && draftBodyValue
      ? {
          channel: draftChannel,
          title: draftTitleValue || "AI outbound draft",
          subjectLine: draftSubjectValue,
          body: draftBodyValue,
          suggestionKind:
            readSearchParamValue(searchParams.draftSuggestionKind)?.trim() ||
            null,
          suggestionLabel:
            readSearchParamValue(searchParams.draftSuggestionLabel)?.trim() ||
            null,
          sourceLabel:
            readSearchParamValue(searchParams.draftSource) === "ai"
              ? "AI draft assist loaded below. Copying the matching channel now uses this draft and still appends a tracked listing link."
              : null,
        }
      : null;
  const snapshot = await getFrontOfficeListingsSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
    targetClientId,
    targetAppointmentId,
  });

  return (
    <FrontOfficePageTemplate
      description="Listings in Front Office are about tracked recommendation, outreach context, and follow-up visibility, not back-office inventory administration."
      eyebrow="Listings"
      main={
        <SectionCard
          className="office-list-card"
          subtitle="Use this list as the tracked listing output surface for live client outreach, appointment prep, and send-trail rescue."
          title="Tracked listing output"
        >
          <FrontOfficeListingsOutputClient
            draftAssist={draftAssist}
            snapshot={snapshot}
          />
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
            subtitle="Client-linked sends are the current Front Office priority because they close the execution loop and keep appointment pressure visible."
            title="Send context"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel={
                  snapshot.targetClient ? snapshot.targetClient.stage : "Mode"
                }
                description={
                  snapshot.targetClient
                    ? `${snapshot.targetClient.nextTouchLabel}. Sends from this page will now be attributed back to this dossier${snapshot.targetAppointment ? " and to the selected appointment context." : "."}`
                    : "Open listing output from a client dossier or appointment context to record who the send was for, which channel was used, and whether they opened it."
                }
                title={
                  snapshot.targetClient
                    ? snapshot.targetClient.fullName
                    : "Generic tracked-link mode"
                }
              />
              {snapshot.targetAppointment ? (
                <FrontOfficeRailItem
                  action={
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={snapshot.targetAppointment.href}
                    >
                      Open appointment
                    </FrontOfficeLink>
                  }
                  badgeLabel={snapshot.targetAppointment.statusLabel}
                  badgeTone={snapshot.targetAppointment.statusTone}
                  description={`${snapshot.targetAppointment.typeLabel} · ${snapshot.targetAppointment.locationLabel}. Sends from this page now stay tied to the appointment loop instead of becoming detached outreach.`}
                  title={`${snapshot.targetAppointment.title} · ${snapshot.targetAppointment.startsAtLabel}`}
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Business card, profile assets, intro copy, and proof package should stay beside listing output so the agent can build a send bundle instead of hunting for assets."
            title="Agent material window"
          >
            <FrontOfficeAgentMaterialWindow
              material={snapshot.agentMaterial}
              targetAppointment={snapshot.targetAppointment}
              targetClient={snapshot.targetClient}
            />
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This route should feel like an output terminal with writeback signals, not an admin inventory console."
            title="Writeback behavior"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Trail"
                description="Tracked share links stay private, feed click behavior back into Front Office, and become send records when launched from a dossier or appointment."
                title="Tracked send trail"
              />
              <FrontOfficeRailItem
                badgeLabel="Cue"
                description="Unopened sends and quiet-after-open behavior should rise back into the same cleanup loop instead of living as invisible clipboard history."
                title="Follow-up rescue cues"
              />
              <FrontOfficeRailItem
                badgeLabel="Bundle"
                description="Agent materials stay beside the listing so each send can carry identity, intro copy, and proof without becoming a portal or auto-send system."
                title="Material package pairing"
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
          <SummaryChip
            label="Mode"
            tone={snapshot.targetClient ? "success" : "warning"}
            value={snapshot.targetClient ? "Client-linked" : "Tracked link"}
          />
          {snapshot.targetClient ? (
            <SummaryChip
              label="Recipient"
              tone="accent"
              value={snapshot.targetClient.fullName}
            />
          ) : null}
          {snapshot.targetAppointment ? (
            <SummaryChip
              label="Appointment"
              value={snapshot.targetAppointment.typeLabel}
            />
          ) : null}
          <SummaryChip label="Surface" value="Outreach" />
        </>
      }
      title="Listing output"
    />
  );
}
