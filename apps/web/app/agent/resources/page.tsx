import type { CSSProperties } from "react";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  QueueItem,
  SectionCard,
  StatCard,
  SummaryChip,
  StatusBadge,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeResourceProgressActions } from "./front-office-resource-progress-actions";
import { FrontOfficeResourceSearchForm } from "./front-office-resource-search-form";
import { requireSessionContext } from "../../../lib/auth-session";

type ResourcesSnapshot = Awaited<
  ReturnType<typeof getFrontOfficeResourcesSnapshot>
>;
type ResourceLane = ResourcesSnapshot["resourceTypes"][number];
type ResourceRecord = ResourcesSnapshot["resources"][number];
type VendorRecord = ResourcesSnapshot["vendors"][number];
type VendorCategory = ResourcesSnapshot["vendorCategories"][number];
type ResourceInteractionTracking = ResourcesSnapshot["interactionTracking"] & {
  signalLabel: string;
  signalDetailLabel: string;
  sharedTracking: ResourcesSnapshot["interactionTracking"]["sharedTracking"] & {
    signalLabel: string;
    signalDetailLabel: string;
  };
};

const laneGridStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const laneCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 248, 252, 0.92) 100%)",
  boxShadow: "0 18px 36px rgba(18, 53, 104, 0.06)",
};

const laneHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const lanePreviewStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  color: "#58708a",
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const laneActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const libraryLaneStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const libraryLaneStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  padding: "1rem",
  borderRadius: "20px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "rgba(250, 252, 255, 0.92)",
};

const subsectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const subsectionIntroStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#5a7089",
  fontSize: "0.92rem",
  lineHeight: 1.45,
};

const resourceCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const resourceCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const resourceMetaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.82rem",
  lineHeight: 1.35,
};

const resourceTagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const resourceTagStyle: CSSProperties = {
  padding: "0.18rem 0.56rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.07)",
  color: "#58708a",
  fontSize: "0.78rem",
  fontWeight: 600,
  lineHeight: 1.3,
};

const resourceHintStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const resourceActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
};

const vendorDeskGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  alignItems: "start",
  marginTop: "1rem",
};

const vendorColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const vendorCategoryGridStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const vendorCategoryCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  padding: "0.95rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 249, 253, 0.96) 100%)",
};

const categoryMetaStyle: CSSProperties = {
  color: "#5a7089",
  fontSize: "0.84rem",
  lineHeight: 1.4,
};

const compactQueueStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function buildResourceLaneMap(resources: ResourceRecord[]) {
  const lanes = new Map<ResourceRecord["typeKey"], ResourceRecord[]>();

  for (const resource of resources) {
    const existing = lanes.get(resource.typeKey) ?? [];
    existing.push(resource);
    lanes.set(resource.typeKey, existing);
  }

  return lanes;
}

function getSearchParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function resourceMatchesSearch(resource: ResourceRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    resource.title,
    resource.summary,
    resource.detailLabel,
    resource.laneLabel,
    resource.typeLabel,
    ...resource.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function vendorMatchesSearch(vendor: VendorRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    vendor.name,
    vendor.categoryLabel,
    vendor.headline,
    vendor.coverageLabel,
    vendor.contactLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function renderVendorActions(vendor: VendorRecord) {
  return (
    <>
      {vendor.phoneHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.phoneHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "phone",
          }}
        >
          Call
        </FrontOfficeTrackedLink>
      ) : null}
      {vendor.emailHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.emailHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "email",
          }}
        >
          Email
        </FrontOfficeTrackedLink>
      ) : null}
      {vendor.websiteHref ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.websiteHref}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "website",
          }}
        >
          Open site
        </FrontOfficeTrackedLink>
      ) : null}
      {!vendor.phoneHref &&
      !vendor.emailHref &&
      !vendor.websiteHref &&
      vendor.href ? (
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={vendor.href}
          tracking={{
            type: "vendor_click",
            vendorId: vendor.id,
            action: "primary",
          }}
        >
          {vendor.actionLabel}
        </FrontOfficeTrackedLink>
      ) : null}
    </>
  );
}

function ResourceRecordCard(props: {
  resource: ResourceRecord;
  supportingLinkHref?: string;
  supportingLinkLabel?: string;
}) {
  const { resource, supportingLinkHref, supportingLinkLabel } = props;

  return (
    <article style={resourceCardStyle}>
      <div style={resourceCardHeaderStyle}>
        <div>
          <strong>{resource.title}</strong>
          <p style={resourceHintStyle}>{resource.summary}</p>
        </div>
        <StatusBadge tone={resource.typeTone}>{resource.typeLabel}</StatusBadge>
      </div>

      <p style={resourceHintStyle}>{resource.detailLabel}</p>

      <div style={resourceMetaRowStyle}>
        <span>{resource.laneLabel}</span>
        <span>{resource.freshnessLabel}</span>
        <span>
          {resource.tagCount > 0
            ? `${pluralize(resource.tagCount, "tag")} published`
            : "No tags published"}
        </span>
      </div>

      {resource.tags.length ? (
        <div style={resourceTagRowStyle}>
          {resource.tags.map((tag) => (
            <span key={tag} style={resourceTagStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={resourceActionRowStyle}>
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={resource.href}
          tracking={{
            type: "resource_open",
            resourceId: resource.id,
          }}
        >
          {resource.actionLabel}
        </FrontOfficeTrackedLink>
        {supportingLinkHref && supportingLinkLabel ? (
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={supportingLinkHref}
          >
            {supportingLinkLabel}
          </FrontOfficeLink>
        ) : null}
      </div>

      {resource.typeKey === "training_video" ? (
        <FrontOfficeResourceProgressActions resourceId={resource.id} />
      ) : null}
    </article>
  );
}

function VendorShortcutCard(props: { vendor: VendorRecord }) {
  const { vendor } = props;

  return (
    <FrontOfficeRailItem
      action={renderVendorActions(vendor)}
      badgeLabel={vendor.categoryLabel}
      badgeTone={vendor.isFeatured ? "accent" : vendor.categoryTone}
      context={vendor.isFeatured ? "Shared go-to" : vendor.quickActionLabel}
      description={vendor.headline}
      meta={
        <>
          <span>{vendor.coverageLabel}</span>
          <span>{vendor.contactLabel}</span>
          <span>
            {vendor.isFeatured ? "Featured partner" : "Published vendor card"}
          </span>
        </>
      }
      title={vendor.name}
    />
  );
}

function VendorCategoryCard(props: { category: VendorCategory }) {
  const { category } = props;

  return (
    <article style={vendorCategoryCardStyle}>
      <div style={laneHeaderStyle}>
        <StatusBadge tone={category.tone}>{category.label}</StatusBadge>
        <span style={categoryMetaStyle}>
          {pluralize(category.count, "vendor")} published
        </span>
      </div>
      <strong>{category.label} coverage</strong>
      <p style={resourceHintStyle}>{category.description}</p>
    </article>
  );
}

export default async function AgentResourcesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "resources:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const resolvedSearchParams = props.searchParams
    ? await props.searchParams
    : {};
  const searchQuery = getSearchParamValue(resolvedSearchParams.q);
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  const resourceLanes = buildResourceLaneMap(snapshot.resources);
  const searchedResources = normalizedSearchQuery
    ? snapshot.resources.filter((resource) =>
        resourceMatchesSearch(resource, normalizedSearchQuery),
      )
    : [];
  const searchedVendors = normalizedSearchQuery
    ? snapshot.vendors.filter((vendor) =>
        vendorMatchesSearch(vendor, normalizedSearchQuery),
      )
    : [];
  const libraryLanes = snapshot.resourceTypes.filter(
    (lane) => lane.key !== "vendor_card",
  );
  const populatedLibraryLanes = libraryLanes.filter(
    (lane) => (resourceLanes.get(lane.key)?.length ?? 0) > 0,
  );
  const vendorSupportResources = resourceLanes.get("vendor_card") ?? [];
  const readyNowVendors = snapshot.vendors.filter(
    (vendor) => vendor.quickActionCount > 0,
  );
  const referenceOnlyVendors = snapshot.vendors.filter(
    (vendor) => vendor.quickActionCount === 0,
  );
  const playbookCount =
    snapshot.executionPulse.libraryLanes.find((lane) => lane.key === "playbook")
      ?.count ?? 0;
  const templateCount =
    snapshot.executionPulse.libraryLanes.find((lane) => lane.key === "template")
      ?.count ?? 0;
  const documentCount =
    snapshot.executionPulse.libraryLanes.find((lane) => lane.key === "document")
      ?.count ?? 0;
  const trainingCount =
    snapshot.executionPulse.libraryLanes.find(
      (lane) => lane.key === "training_video",
    )?.count ?? 0;
  const interactionTracking =
    snapshot.interactionTracking as ResourceInteractionTracking;
  const sharedTracking = interactionTracking.sharedTracking;
  const strongestResourceLane = snapshot.executionPulse.strongestLane;
  const thinnestResourceLane = snapshot.executionPulse.thinnestLane;
  const vendorPosture = snapshot.executionPulse.vendorPosture;

  return (
    <FrontOfficePageTemplate
      description="Open the right playbook, template, form, or vendor partner by the job you are trying to finish now, so Front Office execution stays fast without pretending the Back Office record moved."
      eyebrow="Resources"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Search across playbooks, templates, documents, and vendor cards from one Front Office hub, then jump straight into the right material without scanning every section manually."
            title="Search this hub"
          >
            <FrontOfficeResourceSearchForm initialQuery={searchQuery} />

            {normalizedSearchQuery ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                <ListPageStatsGrid>
                  <StatCard
                    hint="matching shared materials"
                    label="Resource matches"
                    tone="accent"
                    value={searchedResources.length}
                  />
                  <StatCard
                    hint="matching vendor partners"
                    label="Vendor matches"
                    value={searchedVendors.length}
                  />
                  <StatCard
                    hint="tracked searches in this window"
                    label="Tracked searches"
                    value={interactionTracking.searchCount}
                  />
                  <StatCard
                    hint={interactionTracking.windowLabel.toLowerCase()}
                    label="Last tracked use"
                    value={interactionTracking.lastInteractionLabel}
                  />
                  <StatCard
                    hint="dominant operator motion in this window"
                    label="Signal"
                    tone="accent"
                    value={interactionTracking.signalLabel}
                  />
                </ListPageStatsGrid>

                <div style={vendorDeskGridStyle}>
                  <div style={vendorColumnStyle}>
                    <div style={subsectionHeaderStyle}>
                      <div>
                        <strong>Matching resources</strong>
                        <p style={subsectionIntroStyle}>
                          Search results stay execution-first, so the right
                          script, template, or training clip is one click away.
                        </p>
                      </div>
                    </div>

                    <div style={compactQueueStyle}>
                      {searchedResources.length ? (
                        searchedResources
                          .slice(0, 6)
                          .map((resource) => (
                            <ResourceRecordCard
                              key={resource.id}
                              resource={resource}
                            />
                          ))
                      ) : (
                        <EmptyState
                          className="front-office-inline-empty"
                          description="No published resource matched this search. Try a different section, tag, or vendor phrase."
                          title="No matching resources"
                        />
                      )}
                    </div>
                  </div>

                  <div style={vendorColumnStyle}>
                    <div style={subsectionHeaderStyle}>
                      <div>
                        <strong>Matching vendors</strong>
                        <p style={subsectionIntroStyle}>
                          Vendor hits stay visible beside materials so the next
                          move can stay inside one Front Office page.
                        </p>
                      </div>
                    </div>

                    <div className="office-queue-list">
                      {searchedVendors.length ? (
                        searchedVendors
                          .slice(0, 6)
                          .map((vendor) => (
                            <VendorShortcutCard
                              key={vendor.id}
                              vendor={vendor}
                            />
                          ))
                      ) : (
                        <EmptyState
                          className="front-office-inline-empty"
                          description="No vendor matched this search yet. Try a category, coverage area, or contact phrase."
                          title="No matching vendors"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p
                className="office-form-helper"
                style={{ margin: "0.9rem 0 0" }}
              >
                Searches are now tracked too, so recent query use can surface
                back into this hub alongside resource opens and vendor clicks.
              </p>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Agents should be able to start from the task at hand: get the right script, send kit, form, refresher, or vendor partner without scanning a raw storage list."
            title="Start from the job at hand"
          >
            {snapshot.resourceTypes.length ? (
              <div style={laneGridStyle}>
                {snapshot.resourceTypes.map((lane) => {
                  const laneResources = resourceLanes.get(lane.key) ?? [];
                  const previewLabels =
                    lane.key === "vendor_card"
                      ? snapshot.vendorCategories
                          .slice(0, 2)
                          .map((category) => category.label)
                      : laneResources
                          .slice(0, 2)
                          .map((resource) => resource.title);

                  return (
                    <article key={lane.key} style={laneCardStyle}>
                      <div style={laneHeaderStyle}>
                        <StatusBadge tone={lane.tone}>{lane.label}</StatusBadge>
                        <span style={categoryMetaStyle}>
                          {pluralize(lane.count, "item")} published
                        </span>
                      </div>

                      <div>
                        <strong>
                          {lane.key === "vendor_card"
                            ? "Partner lookup & handoff"
                            : lane.label}
                        </strong>
                        <p style={subsectionIntroStyle}>{lane.description}</p>
                        <p style={subsectionIntroStyle}>
                          <strong>Start here:</strong> {lane.startLabel}
                        </p>
                      </div>

                      <div style={lanePreviewStyle}>
                        {previewLabels.length ? (
                          previewLabels.map((label) => (
                            <span key={label}>- {label}</span>
                          ))
                        ) : (
                          <span>
                            {lane.key === "vendor_card"
                              ? "Vendor categories will surface here once cards are published."
                              : "This section will list the first practical materials once published."}
                          </span>
                        )}
                      </div>

                      <div style={laneActionRowStyle}>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={
                            lane.key === "vendor_card"
                              ? "#vendor-hub"
                              : `#lane-${lane.key}`
                          }
                        >
                          {lane.actionLabel}
                        </FrontOfficeLink>
                        {lane.key !== "vendor_card" ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href="#published-tool-library"
                          >
                            Open section library
                          </FrontOfficeLink>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="front-office-inline-empty"
                description="Once shared material is published, Acre will organize it here by the execution job it helps an agent finish."
                title="No library sections published yet"
              />
            )}
          </SectionCard>

          <SectionCard
            id="published-tool-library"
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href="#vendor-hub"
              >
                Jump to vendor desk
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="The library stays execution-first: open the right material, finish the next move, and return to live client work without drifting into a second admin surface."
            title="Library by section"
          >
            {populatedLibraryLanes.length ? (
              <div style={libraryLaneStackStyle}>
                {populatedLibraryLanes.map((lane) => {
                  const laneResources = resourceLanes.get(lane.key) ?? [];

                  return (
                    <article
                      id={`lane-${lane.key}`}
                      key={lane.key}
                      style={libraryLaneStyle}
                    >
                      <div style={subsectionHeaderStyle}>
                        <div>
                          <strong>{lane.label}</strong>
                          <p style={subsectionIntroStyle}>{lane.description}</p>
                        </div>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href="#vendor-hub"
                        >
                          Keep vendor desk close
                        </FrontOfficeLink>
                      </div>

                      <div style={compactQueueStyle}>
                        {laneResources.map((resource) => (
                          <ResourceRecordCard
                            key={resource.id}
                            resource={resource}
                          />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                action={
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href="#vendor-hub"
                  >
                    Open vendor desk
                  </FrontOfficeLink>
                }
                description="Shared playbooks, templates, forms, and refreshers will appear here once the Front Office library is populated."
                title="No published tools in the library yet"
              />
            )}
          </SectionCard>

          <SectionCard
            id="vendor-hub"
            className="office-list-card"
            subtitle="The vendor desk should answer two questions fast: which partner is ready to contact now, and which service area is already covered well enough to support today’s execution."
            title="Vendor desk"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="published vendors visible in this scope"
                label="Vendors"
                value={snapshot.summary.vendorCount}
              />
              <StatCard
                hint="vendors flagged as shared go-to options"
                label="Featured"
                value={snapshot.summary.featuredVendorCount}
              />
              <StatCard
                hint="vendors with phone, email, or site actions ready now"
                label="Ready now"
                tone="accent"
                value={snapshot.summary.quickContactVendorCount}
              />
              <StatCard
                hint="published vendors that still act more like reference cards"
                label="Reference only"
                value={Math.max(
                  snapshot.summary.vendorCount -
                    snapshot.summary.quickContactVendorCount,
                  0,
                )}
              />
            </ListPageStatsGrid>

            <div style={vendorDeskGridStyle}>
              <div style={vendorColumnStyle}>
                <div style={subsectionHeaderStyle}>
                  <div>
                    <strong>Ready-now partners</strong>
                    <p style={subsectionIntroStyle}>
                      Featured and quick-contact vendors stay at the front so an
                      agent can call, email, or open a site without breaking the
                      FO flow.
                    </p>
                  </div>
                  {snapshot.vendors.length ? (
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href="#full-vendor-directory"
                    >
                      Open full directory
                    </FrontOfficeLink>
                  ) : null}
                </div>

                <div className="office-queue-list">
                  {readyNowVendors.length ? (
                    readyNowVendors
                      .slice(0, 8)
                      .map((vendor) => (
                        <VendorShortcutCard key={vendor.id} vendor={vendor} />
                      ))
                  ) : (
                    <EmptyState
                      className="front-office-inline-empty"
                      description="Published vendor cards are visible, but none of them currently expose a phone, email, or site shortcut."
                      title="No quick-contact partners yet"
                    />
                  )}
                </div>
              </div>

              <div style={vendorColumnStyle}>
                <div style={subsectionHeaderStyle}>
                  <div>
                    <strong>Coverage sections & support cards</strong>
                    <p style={subsectionIntroStyle}>
                      Category coverage and support cards keep vendor lookup
                      grounded in the same section instead of feeling like a
                      detached marketplace.
                    </p>
                  </div>
                </div>

                {snapshot.vendorCategories.length ? (
                  <div style={vendorCategoryGridStyle}>
                    {snapshot.vendorCategories.map((category) => (
                      <VendorCategoryCard
                        category={category}
                        key={category.category}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="Service coverage will appear here as soon as the office publishes category-backed vendor cards."
                    title="No vendor categories yet"
                  />
                )}

                {vendorSupportResources.length ? (
                  <div style={compactQueueStyle}>
                    {vendorSupportResources.slice(0, 4).map((resource) => (
                      <QueueItem
                        action={
                          <FrontOfficeTrackedLink
                            className="office-inline-link front-office-inline-link"
                            href={resource.href}
                            tracking={{
                              type: "resource_open",
                              resourceId: resource.id,
                            }}
                          >
                            {resource.actionLabel}
                          </FrontOfficeTrackedLink>
                        }
                        badgeLabel={resource.typeLabel}
                        badgeTone={resource.typeTone}
                        context={resource.freshnessLabel}
                        description={resource.detailLabel}
                        key={resource.id}
                        meta={
                          <>
                            <span>{resource.laneLabel}</span>
                            <span>
                              {resource.tagCount > 0
                                ? `${pluralize(resource.tagCount, "tag")} published`
                                : "No tags published"}
                            </span>
                          </>
                        }
                        title={resource.title}
                      />
                    ))}
                  </div>
                ) : null}

                {referenceOnlyVendors.length ? (
                  <div className="office-queue-list">
                    {referenceOnlyVendors.slice(0, 4).map((vendor) => (
                      <VendorShortcutCard key={vendor.id} vendor={vendor} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {snapshot.vendors.length > 8 ? (
              <div
                id="full-vendor-directory"
                style={{ ...vendorColumnStyle, marginTop: "1.25rem" }}
              >
                <div style={subsectionHeaderStyle}>
                  <div>
                    <strong>Full published directory</strong>
                    <p style={subsectionIntroStyle}>
                      The full directory stays below the ready-now stack so
                      agents can still browse every published partner when the
                      situation needs a wider partner list.
                    </p>
                  </div>
                </div>

                <div className="office-queue-list">
                  {snapshot.vendors.map((vendor) => (
                    <VendorShortcutCard key={vendor.id} vendor={vendor} />
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="Use this quick-start panel when you want the shortest path into the strongest published section instead of scanning the whole library first."
            title="Quick start"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel={
                  strongestResourceLane && strongestResourceLane.count > 0
                    ? strongestResourceLane.label
                    : "Library thin"
                }
                badgeTone="accent"
                context={
                  strongestResourceLane
                    ? `${pluralize(strongestResourceLane.count, "item")} published`
                    : "No section published"
                }
                description={
                  strongestResourceLane && strongestResourceLane.count > 0
                    ? `${strongestResourceLane.description} Start here: ${strongestResourceLane.startLabel}.`
                    : "No one section is populated yet, so the library still needs more published support before it can guide live work cleanly."
                }
                title="Best-covered section"
              />
              <FrontOfficeRailItem
                badgeLabel={
                  thinnestResourceLane ? thinnestResourceLane.label : "Coverage"
                }
                badgeTone={
                  thinnestResourceLane && thinnestResourceLane.count === 0
                    ? "warning"
                    : "neutral"
                }
                context={
                  thinnestResourceLane
                    ? `${pluralize(thinnestResourceLane.count, "item")} published`
                    : "No section data"
                }
                description={
                  thinnestResourceLane
                    ? `${thinnestResourceLane.description} This is the thinnest section right now, so agents may need to lean on adjacent materials or the vendor desk sooner.`
                    : "Section coverage will surface here once shared resources are published."
                }
                title="Thinnest section"
              />
              <FrontOfficeRailItem
                badgeLabel={vendorPosture.label}
                badgeTone={vendorPosture.tone}
                context={vendorPosture.contextLabel}
                description={vendorPosture.description}
                title="Vendor posture"
              />
              <FrontOfficeRailItem
                badgeLabel="FO / BO"
                badgeTone="warning"
                description="Use this hub to open the material, but keep signing, accounting, and archival work in Back Office so the record stays clean."
                title="Back Office work stays in Back Office"
              />
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This is the quick read: which parts of the library are healthy, and how much vendor support is actually contact-ready right now."
            title="Recent updates"
          >
            <ListPageStatsGrid>
              <StatCard
                hint="script and workflow guidance"
                label="Playbooks"
                value={playbookCount}
              />
              <StatCard
                hint="copy-ready send structures"
                label="Templates"
                tone="accent"
                value={templateCount}
              />
              <StatCard
                hint="forms and reference docs"
                label="Documents"
                value={documentCount}
              />
              <StatCard
                hint="refreshers and onboarding clips"
                label="Training"
                value={trainingCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list" style={{ marginTop: "1rem" }}>
              {snapshot.resources.length ? (
                snapshot.resources.slice(0, 3).map((resource) => (
                  <QueueItem
                    action={
                      <FrontOfficeTrackedLink
                        className="office-inline-link front-office-inline-link"
                        href={resource.href}
                        tracking={{
                          type: "resource_open",
                          resourceId: resource.id,
                        }}
                      >
                        {resource.actionLabel}
                      </FrontOfficeTrackedLink>
                    }
                    badgeLabel={resource.typeLabel}
                    badgeTone={resource.typeTone}
                    context={resource.freshnessLabel}
                    description={resource.summary}
                    key={resource.id}
                    meta={
                      <>
                        <span>{resource.laneLabel}</span>
                        <span>{resource.detailLabel}</span>
                      </>
                    }
                    title={resource.title}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="The newest library updates will surface here once resources are published."
                  title="No recent library updates"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Tracked searches, watch progress, opens, and vendor clicks now stay visible here, so the hub can show what this agent is actually touching instead of acting like a static library."
            title="Recent activity"
          >
            <ListPageStatsGrid>
              <StatCard
                hint={interactionTracking.windowLabel.toLowerCase()}
                label="Tracked actions"
                value={interactionTracking.totalCount}
              />
              <StatCard
                hint="searches recorded from this hub"
                label="Searches"
                value={interactionTracking.searchCount}
              />
              <StatCard
                hint="training milestones logged from this hub"
                label="Watch progress"
                tone="accent"
                value={interactionTracking.progressCount}
              />
              <StatCard
                hint="100% training completions logged"
                label="Completed"
                value={interactionTracking.completionCount}
              />
              <StatCard
                hint="resource opens recorded"
                label="Resource opens"
                tone="accent"
                value={interactionTracking.resourceOpenCount}
              />
              <StatCard
                hint="vendor call, email, or site clicks"
                label="Vendor clicks"
                value={interactionTracking.vendorClickCount}
              />
              <StatCard
                hint="latest tracked interaction"
                label="Last touch"
                value={interactionTracking.lastInteractionLabel}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list" style={{ marginTop: "1rem" }}>
              {interactionTracking.recentInteractions.length ? (
                interactionTracking.recentInteractions.map((interaction) => (
                  <QueueItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={interaction.href}
                      >
                        Open section
                      </FrontOfficeLink>
                    }
                    badgeLabel={interaction.kindLabel}
                    badgeTone={
                      interaction.kindLabel === "Vendor click"
                        ? "warning"
                        : interaction.kindLabel === "Watch progress"
                          ? "success"
                          : interaction.kindLabel === "Resource search"
                            ? "neutral"
                            : "accent"
                    }
                    context={interaction.timestampLabel}
                    description={interaction.detailLabel}
                    key={interaction.id}
                    meta={
                      <>
                        <span>{interactionTracking.windowLabel}</span>
                        <span>Tracked from this hub</span>
                      </>
                    }
                    title={interaction.title}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Tracked searches, training progress, resource opens, and vendor clicks will start appearing here as soon as this hub is used live."
                  title="No tracked use yet"
                />
              )}
            </div>
          </SectionCard>

          {sharedTracking.visible ? (
            <SectionCard
              className="office-list-card"
              id="shared-adoption-pulse"
              subtitle="Leads and office operators should be able to see whether this hub is actually getting used across the visible Front Office team, not only inside one person's activity."
              title={sharedTracking.scopeLabel}
            >
              <div
                className="office-summary-chip-row"
                style={{ marginBottom: "1rem" }}
              >
                <SummaryChip
                  label={`Tracked actions vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.totalCountDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(sharedTracking.totalCountDelta)}
                />
                <SummaryChip
                  label={`Active operators vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.activeMembershipDelta > 0
                      ? "accent"
                      : undefined
                  }
                  value={formatSignedDelta(
                    sharedTracking.activeMembershipDelta,
                  )}
                />
                <SummaryChip
                  label={`Resource opens vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.resourceOpenDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(sharedTracking.resourceOpenDelta)}
                />
                <SummaryChip
                  label={`Vendor clicks vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.vendorClickDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(sharedTracking.vendorClickDelta)}
                />
                <SummaryChip
                  label={`Tracked searches vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.searchCountDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(sharedTracking.searchCountDelta)}
                />
                <SummaryChip
                  label={`Watch progress vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.progressCountDelta > 0 ? "accent" : undefined
                  }
                  value={formatSignedDelta(sharedTracking.progressCountDelta)}
                />
                <SummaryChip
                  label={`Training complete vs ${sharedTracking.comparisonWindowLabel.toLowerCase()}`}
                  tone={
                    sharedTracking.completionCountDelta > 0
                      ? "accent"
                      : undefined
                  }
                  value={formatSignedDelta(sharedTracking.completionCountDelta)}
                />
                <SummaryChip
                  label="Signal"
                  tone="accent"
                  value={sharedTracking.signalLabel}
                />
              </div>

              <ListPageStatsGrid>
                <StatCard
                  hint="members in the visible FO scope"
                  label="Visible members"
                  value={sharedTracking.visibleMembershipCount}
                />
                <StatCard
                  hint={sharedTracking.windowLabel.toLowerCase()}
                  label="Active members"
                  tone="accent"
                  value={sharedTracking.activeMembershipCount}
                />
                <StatCard
                  hint="tracked actions across the visible scope"
                  label="Tracked actions"
                  value={sharedTracking.totalCount}
                />
                <StatCard
                  hint="resource opens across the visible scope"
                  label="Resource opens"
                  value={sharedTracking.resourceOpenCount}
                />
                <StatCard
                  hint="resource searches across the visible scope"
                  label="Tracked searches"
                  value={sharedTracking.searchCount}
                />
                <StatCard
                  hint="training progress checks across the visible scope"
                  label="Watch progress"
                  value={sharedTracking.progressCount}
                />
                <StatCard
                  hint="completed training milestones across the visible scope"
                  label="Training complete"
                  value={sharedTracking.completionCount}
                />
                <StatCard
                  hint="vendor call, email, or site clicks"
                  label="Vendor clicks"
                  value={sharedTracking.vendorClickCount}
                />
                <StatCard
                  hint="latest shared tracked activity"
                  label="Last shared touch"
                  value={sharedTracking.lastInteractionLabel}
                />
                <StatCard
                  hint={sharedTracking.signalDetailLabel}
                  label="Signal"
                  tone="accent"
                  value={sharedTracking.signalLabel}
                />
              </ListPageStatsGrid>

              <div className="office-queue-list" style={{ marginTop: "1rem" }}>
                {sharedTracking.topActors.length ? (
                  sharedTracking.topActors.map((actor) => (
                    <QueueItem
                      badgeLabel="Operator"
                      badgeTone="accent"
                      context={actor.lastInteractionLabel}
                      description={`${actor.label} logged ${actor.interactionCount} tracked action(s) across searches, progress, opens, and vendor clicks in ${sharedTracking.windowLabel.toLowerCase()}.`}
                      key={actor.membershipId}
                      meta={
                        <>
                          <span>{sharedTracking.scopeLabel}</span>
                          <span>
                            {pluralize(
                              actor.interactionCount,
                              "tracked action",
                            )}
                          </span>
                        </>
                      }
                      title={actor.label}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="No one else in this visible scope has logged resource activity in the current window yet."
                    title="No shared operator activity yet"
                  />
                )}
              </div>

              <div className="office-queue-list" style={{ marginTop: "1rem" }}>
                {sharedTracking.hottestTargets.length ? (
                  sharedTracking.hottestTargets.map((target) => (
                    <QueueItem
                      action={
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={target.href}
                        >
                          Open section
                        </FrontOfficeLink>
                      }
                      badgeLabel={target.kindLabel}
                      badgeTone={
                        target.kindLabel === "Vendor click"
                          ? "warning"
                          : target.kindLabel === "Watch progress"
                            ? "success"
                            : target.kindLabel === "Resource search"
                              ? "neutral"
                              : "accent"
                      }
                      context={`${target.interactionCount} shared hit(s)`}
                      description={target.detailLabel}
                      key={target.key}
                      meta={
                        <>
                          <span>{sharedTracking.scopeLabel}</span>
                          <span>{sharedTracking.windowLabel}</span>
                          <span>{target.lastInteractionLabel}</span>
                        </>
                      }
                      title={target.title}
                    />
                  ))
                ) : (
                  <EmptyState
                    className="front-office-inline-empty"
                    description="Hot spots will appear here once the visible team or office starts reusing the same resource section."
                    title="No shared hot spots yet"
                  />
                )}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card"
            subtitle="Resources should reduce execution friction, not become a second system to manage."
            title="Use it during live work"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="Call prep"
                badgeTone="accent"
                description="Open a playbook when the next move is a live call, objection response, showing prep, or Front Office to Back Office handoff checklist. Resource opens now stay visible in the activity log instead of disappearing into raw outbound clicks, and the current resource signal will tell you whether the team is search-led, follow-through-led, or balanced."
                meta={
                  <>
                    <span>
                      {pluralize(playbookCount, "playbook")} published
                    </span>
                    <span>Keep the next step explicit</span>
                  </>
                }
                title="Guide the next conversation"
              />
              <FrontOfficeRailItem
                badgeLabel="Send kit"
                badgeTone="success"
                description="Use templates and documents when the structure already exists and the agent only needs to personalize the final send or reference."
                meta={
                  <>
                    <span>
                      {pluralize(templateCount + documentCount, "resource")} in
                      the send + reference sections
                    </span>
                    <span>Stay manual and reviewable</span>
                  </>
                }
                title="Package the next outbound move"
              />
              <FrontOfficeRailItem
                badgeLabel="Training"
                badgeTone="accent"
                description="Use the training section when the job is a refresher instead of a new document hunt. This hub now lets you log 25%, 50%, or complete after you actually watch the clip, and those checkpoints roll back into the same operator signal you see in the side panel."
                meta={
                  <>
                    <span>
                      {pluralize(trainingCount, "training clip")} published
                    </span>
                    <span>
                      {interactionTracking.completionCount} completion
                      milestone(s) logged
                    </span>
                  </>
                }
                title="Keep training visible"
              />
              <FrontOfficeRailItem
                badgeLabel="Vendor"
                badgeTone="warning"
                description="Use the vendor desk when the job needs a real outside partner and a direct next action, not a brand-new internal module. Vendor call, email, and site clicks now stay traceable from the same FO hub, so partner touch shows up in the same signal mix as search, open, and progress work."
                meta={
                  <>
                    <span>
                      {pluralize(
                        snapshot.summary.quickContactVendorCount,
                        "quick-contact vendor",
                      )}{" "}
                      ready now
                    </span>
                    <span>Keep the partner list visible</span>
                  </>
                }
                title="Bring in the right outside support"
              />
            </div>
          </SectionCard>
        </>
      }
      summary={
        <>
          <SummaryChip
            label="Resources"
            value={snapshot.summary.resourceCount}
          />
          <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
          <SummaryChip
            label="Ready-now vendors"
            tone="accent"
            value={snapshot.summary.quickContactVendorCount}
          />
          <SummaryChip
            label="Featured vendors"
            value={snapshot.summary.featuredVendorCount}
          />
        </>
      }
      title="Resources"
    />
  );
}
