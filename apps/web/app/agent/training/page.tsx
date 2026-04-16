import type { CSSProperties } from "react";
import { can, getDefaultAppPath } from "@acre/auth";
import { getFrontOfficeResourcesSnapshot } from "@acre/db";
import {
  EmptyState,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  SummaryChip,
  StatusBadge,
} from "@acre/ui";
import { redirect } from "next/navigation";
import { requireSessionContext } from "../../../lib/auth-session";
import { FrontOfficePageTemplate } from "../_components/front-office-page-template";
import { FrontOfficeTrackedLink } from "../_components/front-office-tracked-link";
import { FrontOfficeResourceProgressActions } from "../resources/front-office-resource-progress-actions";
import { FrontOfficeResourceSearchForm } from "../resources/front-office-resource-search-form";

type TrainingSnapshot = Awaited<
  ReturnType<typeof getFrontOfficeResourcesSnapshot>
>;
type TrainingRecord = TrainingSnapshot["resources"][number];

const stackStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const cardGridStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
};

const trainingCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: "#556a83",
  lineHeight: 1.5,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.83rem",
  lineHeight: 1.4,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const tagStyle: CSSProperties = {
  padding: "0.18rem 0.56rem",
  borderRadius: "999px",
  background: "rgba(18, 53, 104, 0.07)",
  color: "#58708a",
  fontSize: "0.78rem",
  fontWeight: 600,
  lineHeight: 1.3,
};

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase();
}

function trainingMatchesSearch(resource: TrainingRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    resource.title,
    resource.summary,
    resource.detailLabel,
    resource.typeLabel,
    ...resource.tags,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function isYouTubeUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return (
      parsedUrl.protocol === "https:" &&
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
      ].includes(parsedUrl.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function buildTrainingUrl(query: string | null) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  const serialized = params.toString();
  return serialized ? `/agent/training?${serialized}` : "/agent/training";
}

function TrainingRecordCard(props: { resource: TrainingRecord }) {
  const { resource } = props;

  return (
    <article style={trainingCardStyle}>
      <div style={headerStyle}>
        <div style={{ display: "grid", gap: "0.45rem" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <strong>{resource.title}</strong>
            <StatusBadge tone="warning">{resource.typeLabel}</StatusBadge>
            {isYouTubeUrl(resource.href) ? (
              <StatusBadge tone="accent">YouTube</StatusBadge>
            ) : null}
          </div>
          <p style={helperTextStyle}>{resource.summary}</p>
        </div>
      </div>

      <div style={metaRowStyle}>
        <span>YouTube video</span>
        <span>{resource.detailLabel}</span>
        <span>{resource.freshnessLabel}</span>
      </div>

      {resource.tags.length ? (
        <div style={tagRowStyle}>
          {resource.tags.map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <FrontOfficeTrackedLink
          className="office-inline-link front-office-inline-link"
          href={resource.href}
          tracking={{
            type: "resource_open",
            resourceId: resource.id,
          }}
        >
          Watch on YouTube
        </FrontOfficeTrackedLink>
        <FrontOfficeResourceProgressActions resourceId={resource.id} />
      </div>
    </article>
  );
}

export default async function AgentTrainingPage(props: {
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

  const trainingResources = snapshot.resources
    .filter((resource) => resource.typeKey === "training_video")
    .filter((resource) =>
      trainingMatchesSearch(resource, normalizedSearchQuery),
    );
  const allTrainingResources = snapshot.resources.filter(
    (resource) => resource.typeKey === "training_video",
  );
  const visibleTrainingResources = normalizedSearchQuery
    ? trainingResources
    : allTrainingResources;
  const trainingSearchExamples = [
    "buyer script",
    "objection handling",
    "open house prep",
    "crm walkthrough",
  ];

  return (
    <FrontOfficePageTemplate
      description="Search and watch office-approved YouTube training videos in a separate module, without mixing them into the PDF and document directory."
      eyebrow="Training"
      main={
        <div style={stackStyle}>
          <SectionCard
            className="office-list-card"
            subtitle="Use this module for YouTube refreshers only. Search by topic, script, process, or tool."
            title="Search training"
          >
            <FrontOfficeResourceSearchForm
              hideTypeFilter
              initialQuery={searchQuery}
              placeholder="Search training topics, scripts, tools, or workflow refreshers"
              searchContext="training"
              typeOptions={[]}
            />

            {normalizedSearchQuery ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                <ListPageStatsGrid>
                  <StatCard
                    hint="matching training videos"
                    label="Video matches"
                    tone="accent"
                    value={trainingResources.length}
                  />
                </ListPageStatsGrid>

                {trainingResources.length ? (
                  <div style={cardGridStyle}>
                    {trainingResources.map((resource) => (
                      <TrainingRecordCard
                        key={resource.id}
                        resource={resource}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    action={
                      <a
                        className="office-button-secondary"
                        href="/agent/training"
                      >
                        Clear search
                      </a>
                    }
                    description="Try a different keyword such as a script, tool name, or workflow topic."
                    title="No matching training videos"
                  />
                )}
              </div>
            ) : (
              <div
                style={{ marginTop: "0.9rem", display: "grid", gap: "0.7rem" }}
              >
                <p className="office-form-helper" style={{ margin: 0 }}>
                  Keep this page focused on video refreshers. Start with one of
                  these common training searches.
                </p>
                <div style={tagRowStyle}>
                  {trainingSearchExamples.map((example) => (
                    <a
                      href={buildTrainingUrl(example)}
                      key={example}
                      style={{
                        padding: "0.45rem 0.78rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(18, 53, 104, 0.12)",
                        background: "#ffffff",
                        color: "#39516b",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        lineHeight: 1,
                        textDecoration: "none",
                      }}
                    >
                      {example}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="This is the full published training library. Keep it separate from documents so agents know they are looking at YouTube-only material."
            title="Training library"
          >
            {allTrainingResources.length ? (
              visibleTrainingResources.length ? (
                <div id="training-library" style={cardGridStyle}>
                  {visibleTrainingResources.map((resource) => (
                    <TrainingRecordCard key={resource.id} resource={resource} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  action={
                    <a
                      className="office-button-secondary"
                      href="/agent/training"
                    >
                      Clear search
                    </a>
                  }
                  description="No training video matches the current search."
                  title="No training videos in this view"
                />
              )
            ) : (
              <EmptyState
                description="This office has not published any YouTube training videos yet."
                title="No training videos yet"
              />
            )}
          </SectionCard>
        </div>
      }
      summary={
        <>
          <SummaryChip label="Videos" value={allTrainingResources.length} />
          <SummaryChip
            label="Published"
            tone="accent"
            value={allTrainingResources.length}
          />
        </>
      }
      title="Training"
    />
  );
}
