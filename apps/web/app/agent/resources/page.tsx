import type { CSSProperties } from "react";
import { can, getDefaultAppPath } from "@acre/auth";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
  StatusBadge,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { FrontOfficeLink } from "../_components/front-office-link";
import { FrontOfficeRailItem } from "../_components/front-office-rail-item";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { requireSessionContext } from "../../../lib/auth-session";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";

const resourceTagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "0.7rem",
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
  margin: "0.55rem 0 0",
  color: "#556a83",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const resourceActionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  marginTop: "0.85rem",
};

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default async function AgentResourcesPage() {
  const context = await requireSessionContext();

  if (!can(context.currentMembership, "resources:view")) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  const snapshot = await getFrontOfficeResourcesSnapshot({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  return (
    <FrontOfficePageTemplate
      description="Keep playbooks, templates, shared documents, and vendor quick actions inside one Front Office hub so agents can finish the next step without bouncing into a second workspace."
      eyebrow="Resources"
      main={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="High-value material should surface by the job the agent is trying to finish right now, not by raw storage order alone."
            title="Open by execution lane"
          >
            <div className="office-queue-list">
              {snapshot.resourceTypes.length ? (
                snapshot.resourceTypes.map((resourceType) => (
                  <FrontOfficeRailItem
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={
                          resourceType.key === "vendor_card"
                            ? "#vendor-hub"
                            : "#published-tool-library"
                        }
                      >
                        {resourceType.key === "vendor_card"
                          ? "Open vendor hub"
                          : "Open library"}
                      </FrontOfficeLink>
                    }
                    badgeLabel={resourceType.label}
                    badgeTone={resourceType.tone}
                    context={`${pluralize(resourceType.count, "item")} published`}
                    description={resourceType.description}
                    key={resourceType.key}
                    meta={
                      <span>
                        {resourceType.key === "vendor_card"
                          ? "Use this lane when the job needs a partner, not a new module."
                          : "Open the matching material, finish the task, then stay in the FO workflow."}
                      </span>
                    }
                    title={`${resourceType.label} lane`}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Once shared material is published, Acre will group it here by the execution job it helps an agent finish."
                  title="No execution lanes published yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="published-tool-library"
            actions={
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href="#vendor-hub"
              >
                Jump to vendor hub
              </FrontOfficeLink>
            }
            className="office-list-card"
            subtitle="This stays a practical FO library: find the right playbook, form, template, or training item fast, then return to live client execution."
            title="Published tool library"
          >
            <div className="list-column front-office-record-list">
              {snapshot.resources.length ? (
                snapshot.resources.map((resource) => (
                  <article
                    className="list-row front-office-record"
                    key={resource.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{resource.title}</strong>
                        <p>{resource.summary}</p>
                      </div>
                      <StatusBadge tone={resource.typeTone}>
                        {resource.typeLabel}
                      </StatusBadge>
                    </div>

                    <p style={resourceHintStyle}>{resource.detailLabel}</p>

                    <div className="list-row-meta front-office-record-meta">
                      <span>{resource.freshnessLabel}</span>
                      <span>{resource.actionLabel}</span>
                      <span>
                        {resource.tags.length
                          ? `${pluralize(resource.tags.length, "tag")}`
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
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={resource.href}
                      >
                        {resource.actionLabel}
                      </FrontOfficeLink>
                      {resource.typeKey === "vendor_card" ? (
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href="#vendor-hub"
                        >
                          Open vendor hub lane
                        </FrontOfficeLink>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  description="Shared playbooks, templates, forms, and training items will appear here once the Front Office library is populated."
                  title="No published tools yet"
                />
              )}
            </div>
          </SectionCard>
        </>
      }
      rail={
        <>
          <SectionCard
            className="office-list-card"
            subtitle="The vendor hub should tell the agent whether the shared support network is actually ready to use right now."
            title="Vendor hub pulse"
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
                hint="vendors with phone, email, or site quick actions"
                label="Quick contact"
                tone="accent"
                value={snapshot.summary.quickContactVendorCount}
              />
              <StatCard
                hint="distinct service categories in the hub"
                label="Categories"
                value={snapshot.summary.vendorCategoryCount}
              />
            </ListPageStatsGrid>

            <div className="office-queue-list" style={{ marginTop: "1rem" }}>
              {snapshot.vendorCategories.length ? (
                snapshot.vendorCategories.slice(0, 4).map((category) => (
                  <FrontOfficeRailItem
                    badgeLabel={category.label}
                    badgeTone="neutral"
                    description={`${pluralize(
                      category.count,
                      "vendor",
                    )} published in this lane.`}
                    key={category.category}
                    title={`${category.label} coverage`}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Category coverage will appear here when the shared vendor pool is populated."
                  title="No vendor categories yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="vendor-hub"
            className="office-list-card"
            subtitle="Phone, email, and site actions stay close to the rest of the FO workflow, so vendor lookup feels like part of the same execution surface."
            title="Vendor hub"
          >
            <div className="office-queue-list">
              {snapshot.vendors.length ? (
                snapshot.vendors.map((vendor) => (
                  <FrontOfficeRailItem
                    action={
                      <>
                        {vendor.phoneHref ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={vendor.phoneHref}
                          >
                            Call
                          </FrontOfficeLink>
                        ) : null}
                        {vendor.emailHref ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={vendor.emailHref}
                          >
                            Email
                          </FrontOfficeLink>
                        ) : null}
                        {vendor.websiteHref ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={vendor.websiteHref}
                          >
                            Open site
                          </FrontOfficeLink>
                        ) : null}
                        {!vendor.phoneHref &&
                        !vendor.emailHref &&
                        !vendor.websiteHref &&
                        vendor.href ? (
                          <FrontOfficeLink
                            className="office-inline-link front-office-inline-link"
                            href={vendor.href}
                          >
                            {vendor.actionLabel}
                          </FrontOfficeLink>
                        ) : null}
                      </>
                    }
                    badgeLabel={vendor.categoryLabel}
                    badgeTone={vendor.isFeatured ? "accent" : vendor.categoryTone}
                    context={
                      vendor.isFeatured ? "Featured vendor" : vendor.coverageLabel
                    }
                    description={vendor.headline}
                    key={vendor.id}
                    meta={
                      <>
                        <span>{vendor.coverageLabel}</span>
                        <span>{vendor.contactLabel}</span>
                        <span>
                          {vendor.isFeatured
                            ? "Shared go-to option"
                            : "Published vendor card"}
                        </span>
                      </>
                    }
                    title={vendor.name}
                  />
                ))
              ) : (
                <EmptyState
                  className="front-office-inline-empty"
                  description="Shared vendor cards will appear here once the office publishes a real support bench for live agent work."
                  title="No vendor shortcuts yet"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This hub should speed up Front Office execution without pretending the formal system of record moved."
            title="Boundary reminder"
          >
            <div className="office-queue-list">
              <FrontOfficeRailItem
                badgeLabel="FO"
                badgeTone="accent"
                description="Use this hub to retrieve playbooks, templates, and vendor contacts while the work is still client-facing and execution-led."
                title="Stay lightweight in Front Office"
              />
              <FrontOfficeRailItem
                badgeLabel="BO"
                description="Formal transaction creation, signatures, accounting, and archival workflow still belong in Back Office even if the supporting material starts here."
                title="Keep the BO record boundary explicit"
              />
              <FrontOfficeRailItem
                badgeLabel="Honest"
                badgeTone="warning"
                description="This page does not imply auto-send, two-way sync, hidden vendor ingestion, or provider-backed automation. Agents still choose and perform the next action."
                title="No pretend automation layer"
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
          <SummaryChip
            label="Execution lanes"
            tone="accent"
            value={snapshot.summary.resourceTypeCount}
          />
          <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
          <SummaryChip
            label="Quick contacts"
            tone="accent"
            value={snapshot.summary.quickContactVendorCount}
          />
          <SummaryChip
            label="Featured vendors"
            value={snapshot.summary.featuredVendorCount}
          />
        </>
      }
      title="Tool library & vendor hub"
    />
  );
}
