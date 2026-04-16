"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import {
  Badge,
  Button,
  CheckboxField,
  ConfirmActionDialog,
  EmptyState,
  FormField,
  ListPageStatsGrid,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import type { OfficeResourcesAdminSnapshot } from "@acre/db";

type OfficeResourcesClientProps = {
  snapshot: OfficeResourcesAdminSnapshot;
  resourceMode?: "resources" | "training";
};

type ConfirmState =
  | {
      kind: "resource";
      id: string;
      title: string;
    }
  | {
      kind: "vendor";
      id: string;
      title: string;
    }
  | null;

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type JsonResponse = {
  error?: string;
};

const gridStyle = {
  display: "grid",
  gap: "1rem",
};

const cardGridStyle = {
  display: "grid",
  gap: "1rem",
};

const recordCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.9rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "#ffffff",
};

const recordHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.8rem",
  flexWrap: "wrap" as const,
};

const recordMetaStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};

const actionRowStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
};

const signalListStyle = {
  display: "grid",
  gap: "0.85rem",
};

const signalItemStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.3rem",
  padding: "0.9rem 1rem",
  borderRadius: "16px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "rgba(248, 250, 253, 0.92)",
};

const coverageGridStyle = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const coverageCardStyle = {
  display: "grid",
  gap: "0.9rem",
  padding: "1rem",
  borderRadius: "18px",
  border: "1px solid rgba(18, 53, 104, 0.08)",
  background: "rgba(248, 250, 253, 0.92)",
};

const coverageRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const coverageMetaStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px 12px",
  color: "#667c93",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};

const starterGridStyle = {
  display: "grid",
  gap: "0.85rem",
};

const starterListStyle = {
  margin: 0,
  paddingLeft: "1rem",
  color: "#556a83",
  lineHeight: 1.6,
};

const groupedListStyle = {
  display: "grid",
  gap: "1.15rem",
};

const groupedSectionStyle = {
  display: "grid",
  gap: "0.85rem",
  paddingTop: "0.2rem",
};

const groupedSectionHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
  flexWrap: "wrap" as const,
};

const anchorActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
};

const fieldHintStyle = {
  margin: "-0.35rem 0 0",
  color: "#667c93",
  fontSize: "0.82rem",
  lineHeight: 1.45,
};

const segmentedTabsShellStyle = {
  display: "grid",
  width: "100%",
  gap: "0.55rem",
  padding: "0.6rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  borderRadius: "24px",
  border: "1px solid rgba(18, 53, 104, 0.1)",
  background: "linear-gradient(180deg, #f7f9fc 0%, #f2f6fb 100%)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
};

const segmentedTabStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  minHeight: "68px",
  padding: "0.95rem 1.25rem",
  borderRadius: "18px",
  color: "#4d6480",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  letterSpacing: "-0.02em",
};

const activeSegmentedTabStyle = {
  ...segmentedTabStyle,
  color: "#173153",
  background: "#ffffff",
  boxShadow:
    "0 14px 28px rgba(18, 53, 104, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.96)",
};

const resourceStarterShelf = [
  "Playbook: buyer consultation checklist, showing prep, offer process notes",
  "Template: intro email, follow-up text, open-house recap, vendor handoff email",
  "Document: fee sheet, offer checklist PDF, neighborhood explainer, one-page FAQ",
];

const vendorStarterShelf = [
  "Keep category names consistent, for example lender, attorney, inspector, insurance, moving.",
  "Use the headline for the one-line reason an agent would choose this contact.",
  "Only mark Featured go-to when the office really wants agents to notice that vendor first.",
];

function parseCsv(value: FormDataEntryValue | null) {
  return `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

async function parseError(response: Response, fallback: string) {
  const payload = (await response
    .json()
    .catch(() => null)) as JsonResponse | null;
  return payload?.error || fallback;
}

export function OfficeResourcesClient({
  snapshot,
  resourceMode = "resources",
}: OfficeResourcesClientProps) {
  const isTrainingMode = resourceMode === "training";
  const router = useRouter();
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const scopedResourceTypeOptions = snapshot.resourceTypeOptions.filter(
    (option) =>
      isTrainingMode
        ? option.value === "training_video"
        : option.value !== "training_video",
  );
  const scopedResources = snapshot.resources.filter((resource) =>
    isTrainingMode
      ? resource.type === "training_video"
      : resource.type !== "training_video",
  );
  const scopedTopOpenedResources = snapshot.topOpenedResources.filter(
    (resource) =>
      isTrainingMode
        ? resource.type === "training_video"
        : resource.type !== "training_video",
  );
  const scopedStaleResources = snapshot.staleResources.filter((resource) =>
    isTrainingMode
      ? resource.type === "training_video"
      : resource.type !== "training_video",
  );
  const resourceCoverage = scopedResourceTypeOptions.map((option) => {
    const records = scopedResources.filter(
      (resource) => resource.type === option.value,
    );
    const published = records.filter((resource) => resource.isPublished).length;

    return {
      ...option,
      records,
      total: records.length,
      published,
      drafts: records.length - published,
    };
  });
  const publishedResourceCount = scopedResources.filter(
    (resource) => resource.isPublished,
  ).length;
  const draftResourceCount = scopedResources.length - publishedResourceCount;
  const resourceTabCount = snapshot.resources.filter(
    (resource) => resource.type !== "training_video",
  ).length;
  const trainingTabCount = snapshot.resources.filter(
    (resource) => resource.type === "training_video",
  ).length;
  const vendorCoverage = Array.from(
    (isTrainingMode ? [] : snapshot.vendors)
      .reduce(
        (map, vendor) => {
          const current = map.get(vendor.categoryLabel) ?? {
            label: vendor.categoryLabel,
            total: 0,
            featured: 0,
            records: [] as typeof snapshot.vendors,
          };

          current.total += 1;
          current.featured += vendor.isFeatured ? 1 : 0;
          current.records.push(vendor);
          map.set(vendor.categoryLabel, current);
          return map;
        },
        new Map<
          string,
          {
            label: string;
            total: number;
            featured: number;
            records: typeof snapshot.vendors;
          }
        >(),
      )
      .values(),
  ).sort(
    (left, right) =>
      right.total - left.total || left.label.localeCompare(right.label),
  );
  const directoryCoverageTitle = isTrainingMode
    ? "Training coverage"
    : "Directory coverage";
  const directoryCoverageSubtitle = isTrainingMode
    ? "Keep YouTube refreshers in this Training tab so video learning stays separate from the document directory."
    : "Keep the agent directory simple: cover the basic material types, keep vendor categories consistent, and avoid turning this into a second document system.";
  const resourceSectionTitle = isTrainingMode ? "Training videos" : "Resources";
  const resourceSectionSubtitle = isTrainingMode
    ? "Manage the YouTube videos that agents find under the Training tab inside Resources."
    : "Create and maintain the published materials and partner directory that agents search from Front Office.";
  const resourceEmptyTitle = isTrainingMode
    ? "No training videos yet"
    : "No resources yet";
  const resourceEmptyDescription = isTrainingMode
    ? "Add the first YouTube training video for agents from the form above."
    : "Add the first published material for agents from the form above.";
  const resourceActionAnchorLabel = isTrainingMode
    ? "Add a training video"
    : "Add a resource";
  const resourceCreateButtonLabel = isTrainingMode
    ? "Add training video"
    : "Add resource";
  const resourceHelperText = isTrainingMode
    ? "Keep video titles literal, summaries short, and tags practical. Agents should be able to search a topic and immediately find the right YouTube refresher."
    : "Keep titles literal, summaries short, and tags practical. Agents usually search the title first, then tags or type if they do not remember the exact file name.";
  const resourceTitlePlaceholder = isTrainingMode
    ? "New buyer objection refresher"
    : "New buyer consultation checklist";
  const resourceSummaryPlaceholder = isTrainingMode
    ? "What this video refreshes for the agent."
    : "What this material helps the agent do.";
  const resourceTagsPlaceholder = isTrainingMode
    ? "buyers, objections, script"
    : "buyers, consultation, checklist";

  async function refreshWithFeedback(nextFeedback: FeedbackState) {
    setFeedback(nextFeedback);
    router.refresh();
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-resource");
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/office/resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          url: String(formData.get("url") ?? ""),
          tags: parseCsv(formData.get("tags")),
          type: String(formData.get("type") ?? ""),
          isPublished: formData.get("isPublished") === "on",
          visibilityScope:
            formData.get("visibilityScope") === "organization_wide"
              ? "organization_wide"
              : "office_only",
        }),
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to create resource."),
        );
      }

      form.reset();
      await refreshWithFeedback({
        tone: "success",
        message: "Resource created.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to create resource.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateResource(
    event: FormEvent<HTMLFormElement>,
    resourceId: string,
  ) {
    event.preventDefault();
    setPendingAction(`update-resource:${resourceId}`);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/office/resources/${resourceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          url: String(formData.get("url") ?? ""),
          tags: parseCsv(formData.get("tags")),
          type: String(formData.get("type") ?? ""),
          isPublished: formData.get("isPublished") === "on",
          visibilityScope:
            formData.get("visibilityScope") === "organization_wide"
              ? "organization_wide"
              : "office_only",
        }),
      });

      if (!response.ok) {
        throw new Error(
          await parseError(response, "Failed to update resource."),
        );
      }

      setEditingResourceId(null);
      await refreshWithFeedback({
        tone: "success",
        message: "Resource updated.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update resource.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-vendor");
    setFeedback(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/office/resources/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: String(formData.get("category") ?? ""),
          name: String(formData.get("name") ?? ""),
          headline: String(formData.get("headline") ?? ""),
          phone: String(formData.get("phone") ?? "").trim() || null,
          email: String(formData.get("email") ?? "").trim() || null,
          website: String(formData.get("website") ?? "").trim() || null,
          neighborhoods: parseCsv(formData.get("neighborhoods")),
          notes: String(formData.get("notes") ?? "").trim() || null,
          isFeatured: formData.get("isFeatured") === "on",
          visibilityScope:
            formData.get("visibilityScope") === "organization_wide"
              ? "organization_wide"
              : "office_only",
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, "Failed to create vendor."));
      }

      form.reset();
      await refreshWithFeedback({
        tone: "success",
        message: "Vendor created.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to create vendor.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateVendor(
    event: FormEvent<HTMLFormElement>,
    vendorId: string,
  ) {
    event.preventDefault();
    setPendingAction(`update-vendor:${vendorId}`);
    setFeedback(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/office/resources/vendors/${vendorId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category: String(formData.get("category") ?? ""),
            name: String(formData.get("name") ?? ""),
            headline: String(formData.get("headline") ?? ""),
            phone: String(formData.get("phone") ?? "").trim() || null,
            email: String(formData.get("email") ?? "").trim() || null,
            website: String(formData.get("website") ?? "").trim() || null,
            neighborhoods: parseCsv(formData.get("neighborhoods")),
            notes: String(formData.get("notes") ?? "").trim() || null,
            isFeatured: formData.get("isFeatured") === "on",
            visibilityScope:
              formData.get("visibilityScope") === "organization_wide"
                ? "organization_wide"
                : "office_only",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await parseError(response, "Failed to update vendor."));
      }

      setEditingVendorId(null);
      await refreshWithFeedback({
        tone: "success",
        message: "Vendor updated.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to update vendor.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmState) {
      return;
    }

    const isResource = confirmState.kind === "resource";
    const deleteUrl = isResource
      ? `/api/office/resources/${confirmState.id}`
      : `/api/office/resources/vendors/${confirmState.id}`;

    setPendingAction(`delete:${confirmState.kind}:${confirmState.id}`);
    setFeedback(null);

    try {
      const response = await fetch(deleteUrl, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await parseError(
            response,
            isResource
              ? "Failed to delete resource."
              : "Failed to delete vendor.",
          ),
        );
      }

      setEditingResourceId((current) =>
        current === confirmState.id ? null : current,
      );
      setEditingVendorId((current) =>
        current === confirmState.id ? null : current,
      );
      setConfirmState(null);
      await refreshWithFeedback({
        tone: "success",
        message: isResource ? "Resource deleted." : "Vendor deleted.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : isResource
              ? "Failed to delete resource."
              : "Failed to delete vendor.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="office-list-page-stack" style={gridStyle}>
      {feedback ? (
        <SectionCard className="office-list-card" title="Latest update">
          <p
            className="office-form-helper"
            style={{
              margin: 0,
              color: feedback.tone === "error" ? "#b42318" : "#0f766e",
            }}
          >
            {feedback.message}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card"
        subtitle="Keep one workspace in the sidebar, then use the tabs here to switch between the document directory and YouTube training."
        title="Workspace tabs"
      >
        <div style={segmentedTabsShellStyle}>
          <a
            aria-current={!isTrainingMode ? "page" : undefined}
            href="/office/resources?tab=resources"
            style={
              !isTrainingMode ? activeSegmentedTabStyle : segmentedTabStyle
            }
          >
            Resources ({resourceTabCount})
          </a>
          <a
            aria-current={isTrainingMode ? "page" : undefined}
            href="/office/resources?tab=training"
            style={isTrainingMode ? activeSegmentedTabStyle : segmentedTabStyle}
          >
            Training ({trainingTabCount})
          </a>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={directoryCoverageSubtitle}
        title={directoryCoverageTitle}
      >
        <div style={coverageGridStyle}>
          <article style={coverageCardStyle}>
            <div style={{ display: "grid", gap: "0.3rem" }}>
              <strong>
                {isTrainingMode
                  ? "Training video coverage"
                  : "Resource type coverage"}
              </strong>
              <p className="office-form-helper" style={{ margin: 0 }}>
                {isTrainingMode
                  ? "Training works best when each YouTube entry is clearly titled, current, and easy to search by topic."
                  : "Search is the main use case, so the directory works best when each major type has at least a few clean, current records."}
              </p>
            </div>
            <div style={starterGridStyle}>
              {resourceCoverage.map((group) => (
                <div key={group.value} style={coverageRowStyle}>
                  <div style={{ display: "grid", gap: "0.18rem" }}>
                    <strong>{group.label}</strong>
                    <div style={coverageMetaStyle}>
                      <span>{group.total} total</span>
                      <span>{group.published} published</span>
                      <span>{group.drafts} draft</span>
                    </div>
                  </div>
                  <Badge tone={group.total > 0 ? "accent" : "neutral"}>
                    {group.total}
                  </Badge>
                </div>
              ))}
            </div>
          </article>

          {!isTrainingMode ? (
            <article style={coverageCardStyle}>
              <div style={{ display: "grid", gap: "0.3rem" }}>
                <strong>Vendor category coverage</strong>
                <p className="office-form-helper" style={{ margin: 0 }}>
                  Categories become part of the searchable directory, so stable
                  naming matters more than heavy workflow logic.
                </p>
              </div>
              {vendorCoverage.length ? (
                <div style={starterGridStyle}>
                  {vendorCoverage.map((group) => (
                    <div key={group.label} style={coverageRowStyle}>
                      <div style={{ display: "grid", gap: "0.18rem" }}>
                        <strong>{group.label}</strong>
                        <div style={coverageMetaStyle}>
                          <span>{group.total} total</span>
                          <span>{group.featured} featured</span>
                        </div>
                      </div>
                      <Badge tone={group.featured > 0 ? "accent" : "neutral"}>
                        {group.total}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Add the first vendor category once the office is ready to publish partner contacts."
                  title="No vendor categories yet"
                />
              )}
            </article>
          ) : null}
        </div>

        <div style={{ ...coverageGridStyle, marginTop: "1rem" }}>
          <article style={coverageCardStyle}>
            <div style={{ display: "grid", gap: "0.3rem" }}>
              <strong>
                {isTrainingMode
                  ? "Starter training shelf"
                  : "Starter resource shelf"}
              </strong>
              <p className="office-form-helper" style={{ margin: 0 }}>
                {isTrainingMode
                  ? "Good first uploads are the short YouTube videos agents re-watch when they need a fast refresher."
                  : "Good first uploads are the materials agents repeatedly search for, not every internal file the office owns."}
              </p>
            </div>
            <ul style={starterListStyle}>
              {(isTrainingMode
                ? [
                    "Training video: buyer scripts, objection handling, showing prep, CRM walkthroughs, and office process refreshers",
                  ]
                : resourceStarterShelf
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div style={anchorActionStyle}>
              <a className="office-inline-link" href="#resource-create-form">
                {resourceActionAnchorLabel}
              </a>
            </div>
          </article>

          {!isTrainingMode ? (
            <article style={coverageCardStyle}>
              <div style={{ display: "grid", gap: "0.3rem" }}>
                <strong>Starter vendor shelf</strong>
                <p className="office-form-helper" style={{ margin: 0 }}>
                  Vendor pool entries should stay brief and useful so agents can
                  search, scan, and contact someone quickly.
                </p>
              </div>
              <ul style={starterListStyle}>
                {vendorStarterShelf.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div style={anchorActionStyle}>
                <a className="office-inline-link" href="#vendor-create-form">
                  Add a vendor
                </a>
              </div>
            </article>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={resourceSectionSubtitle}
        title={resourceSectionTitle}
      >
        <ListPageStatsGrid>
          <StatCard
            hint="visible records in this office scope"
            label={isTrainingMode ? "Training videos" : "Total resources"}
            tone="accent"
            value={scopedResources.length}
          />
          <StatCard
            hint="currently visible to agents"
            label="Published"
            value={publishedResourceCount}
          />
          <StatCard
            hint={
              isTrainingMode
                ? "records still hidden from agents"
                : "visible partner records in this office scope"
            }
            label={isTrainingMode ? "Drafts" : "Vendors"}
            value={
              isTrainingMode ? draftResourceCount : snapshot.summary.vendorCount
            }
          />
          <StatCard
            hint="older records worth reviewing"
            label="Stale"
            value={scopedStaleResources.length}
          />
        </ListPageStatsGrid>

        <form
          className="office-form-grid"
          id="resource-create-form"
          onSubmit={handleCreateResource}
          style={{ marginTop: "1rem" }}
        >
          <FormField className="office-form-grid-span-2" label="Title">
            <TextInput name="title" placeholder={resourceTitlePlaceholder} />
          </FormField>
          <FormField className="office-form-grid-span-2" label="Summary">
            <TextareaInput
              name="summary"
              placeholder={resourceSummaryPlaceholder}
              rows={3}
            />
          </FormField>
          <FormField
            className="office-form-grid-span-2"
            label={isTrainingMode ? "YouTube URL" : "URL"}
          >
            <TextInput
              name="url"
              placeholder={
                isTrainingMode
                  ? "https://www.youtube.com/watch?v=..."
                  : "https://... or /resources/..."
              }
              type="url"
            />
          </FormField>
          <p
            className="office-form-helper office-form-grid-span-2"
            style={fieldHintStyle}
          >
            {isTrainingMode ? (
              <>
                Paste a full <strong>YouTube</strong> link here. Training videos
                live in the <strong>Training</strong> tab inside Resources and
                stay separate from the PDF and document directory.
              </>
            ) : (
              <>
                Use this module for documents, templates, and playbooks.
                Training videos belong in the <strong>Training</strong> tab
                above. PDFs can use internal paths like
                <code> /resources/...</code> or any direct file URL.
              </>
            )}
          </p>
          {isTrainingMode ? (
            <input name="type" type="hidden" value="training_video" />
          ) : (
            <FormField label="Type">
              <SelectInput defaultValue="playbook" name="type">
                {scopedResourceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          )}
          <FormField label="Visibility">
            <SelectInput defaultValue="office_only" name="visibilityScope">
              <option value="office_only">Office only</option>
              <option value="organization_wide">Organization-wide</option>
            </SelectInput>
          </FormField>
          <FormField className="office-form-grid-span-2" label="Tags">
            <TextInput name="tags" placeholder={resourceTagsPlaceholder} />
          </FormField>
          <CheckboxField className="office-form-grid-span-2" label="Published">
            <input defaultChecked name="isPublished" type="checkbox" />
          </CheckboxField>
          <div className="office-filter-actions">
            <Button
              disabled={pendingAction === "create-resource"}
              type="submit"
            >
              {resourceCreateButtonLabel}
            </Button>
          </div>
        </form>

        <p className="office-form-helper" style={{ margin: "1rem 0 0" }}>
          {resourceHelperText}
        </p>

        <div style={{ ...groupedListStyle, marginTop: "1rem" }}>
          {scopedResources.length ? (
            resourceCoverage
              .filter((group) => group.records.length > 0)
              .map((group) => (
                <section key={group.value} style={groupedSectionStyle}>
                  <div style={groupedSectionHeaderStyle}>
                    <div style={{ display: "grid", gap: "0.24rem" }}>
                      <strong>{group.label}</strong>
                      <div style={coverageMetaStyle}>
                        <span>{group.total} total</span>
                        <span>{group.published} published</span>
                        <span>{group.drafts} draft</span>
                      </div>
                    </div>
                    <Badge tone="neutral">{group.total}</Badge>
                  </div>

                  <div style={cardGridStyle}>
                    {group.records.map((resource) => {
                      const isEditing = editingResourceId === resource.id;
                      const isBusy =
                        pendingAction === `update-resource:${resource.id}` ||
                        pendingAction === `delete:resource:${resource.id}`;

                      return (
                        <article key={resource.id} style={recordCardStyle}>
                          {isEditing ? (
                            <form
                              className="office-form-grid"
                              onSubmit={(event) =>
                                handleUpdateResource(event, resource.id)
                              }
                            >
                              <FormField
                                className="office-form-grid-span-2"
                                label="Title"
                              >
                                <TextInput
                                  defaultValue={resource.title}
                                  name="title"
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Summary"
                              >
                                <TextareaInput
                                  defaultValue={resource.summary}
                                  name="summary"
                                  rows={3}
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label={isTrainingMode ? "YouTube URL" : "URL"}
                              >
                                <TextInput
                                  defaultValue={resource.url}
                                  name="url"
                                  placeholder={
                                    isTrainingMode
                                      ? "https://www.youtube.com/watch?v=..."
                                      : "https://... or /resources/..."
                                  }
                                  type="url"
                                />
                              </FormField>
                              <p
                                className="office-form-helper office-form-grid-span-2"
                                style={fieldHintStyle}
                              >
                                {isTrainingMode ? (
                                  <>
                                    Paste a full <strong>YouTube</strong> link.
                                    Training videos live in the Training tab
                                    inside Resources, separate from the PDF and
                                    document directory.
                                  </>
                                ) : (
                                  <>
                                    Use this module for documents, templates,
                                    and playbooks. Training videos belong in the{" "}
                                    <strong>Training</strong> tab above.
                                  </>
                                )}
                              </p>
                              {isTrainingMode ? (
                                <input
                                  name="type"
                                  type="hidden"
                                  value="training_video"
                                />
                              ) : (
                                <FormField label="Type">
                                  <SelectInput
                                    defaultValue={resource.type}
                                    name="type"
                                  >
                                    {scopedResourceTypeOptions.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </SelectInput>
                                </FormField>
                              )}
                              <FormField label="Visibility">
                                <SelectInput
                                  defaultValue={resource.scopeKey}
                                  name="visibilityScope"
                                >
                                  <option value="office_only">
                                    Office only
                                  </option>
                                  <option value="organization_wide">
                                    Organization-wide
                                  </option>
                                </SelectInput>
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Tags"
                              >
                                <TextInput
                                  defaultValue={resource.tagsText}
                                  name="tags"
                                />
                              </FormField>
                              <CheckboxField
                                className="office-form-grid-span-2"
                                label="Published"
                              >
                                <input
                                  defaultChecked={resource.isPublished}
                                  name="isPublished"
                                  type="checkbox"
                                />
                              </CheckboxField>

                              <div style={actionRowStyle}>
                                <Button disabled={isBusy} type="submit">
                                  Save
                                </Button>
                                <Button
                                  disabled={isBusy}
                                  onClick={() => setEditingResourceId(null)}
                                  type="button"
                                  variant="secondary"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  disabled={isBusy}
                                  onClick={() =>
                                    setConfirmState({
                                      kind: "resource",
                                      id: resource.id,
                                      title: resource.title,
                                    })
                                  }
                                  type="button"
                                  variant="danger"
                                >
                                  Delete
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div style={recordHeaderStyle}>
                                <div style={{ display: "grid", gap: "0.4rem" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <strong>{resource.title}</strong>
                                    <Badge tone="neutral">
                                      {resource.typeLabel}
                                    </Badge>
                                    {isTrainingMode &&
                                    isYouTubeUrl(resource.url) ? (
                                      <Badge tone="accent">YouTube</Badge>
                                    ) : null}
                                    <StatusBadge
                                      tone={
                                        resource.isPublished
                                          ? "accent"
                                          : "warning"
                                      }
                                    >
                                      {resource.isPublished
                                        ? "Published"
                                        : "Draft"}
                                    </StatusBadge>
                                  </div>
                                  <p
                                    style={{
                                      margin: 0,
                                      color: "#556a83",
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {resource.summary}
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    setEditingResourceId(resource.id)
                                  }
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  Edit
                                </Button>
                              </div>

                              <div style={recordMetaStyle}>
                                <span>{resource.scopeLabel}</span>
                                <span>Updated {resource.updatedAtLabel}</span>
                                <span>{resource.lastOpenedLabel}</span>
                                <span>{resource.openCount} opens</span>
                              </div>

                              <div style={recordMetaStyle}>
                                <span>{resource.url}</span>
                                {resource.tagsText ? (
                                  <span>{resource.tagsText}</span>
                                ) : null}
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
          ) : (
            <EmptyState
              action={
                <a
                  className="office-button-secondary"
                  href="#resource-create-form"
                >
                  {resourceActionAnchorLabel}
                </a>
              }
              description={resourceEmptyDescription}
              title={resourceEmptyTitle}
            />
          )}
        </div>
      </SectionCard>

      {!isTrainingMode ? (
        <SectionCard
          className="office-list-card"
          subtitle="Keep partner records simple so agents can search and contact them when needed."
          title="Vendor pool"
        >
          <ListPageStatsGrid>
            <StatCard
              hint="visible partner records in this office scope"
              label="Vendors"
              tone="accent"
              value={snapshot.summary.vendorCount}
            />
            <StatCard
              hint="flagged as go-to contacts"
              label="Featured"
              value={snapshot.summary.featuredVendorCount}
            />
          </ListPageStatsGrid>

          <form
            className="office-form-grid"
            id="vendor-create-form"
            onSubmit={handleCreateVendor}
            style={{ marginTop: "1rem" }}
          >
            <FormField label="Category">
              <TextInput name="category" placeholder="lender" />
            </FormField>
            <FormField label="Name">
              <TextInput name="name" placeholder="North Star Lending" />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Headline">
              <TextInput
                name="headline"
                placeholder="Fast pre-approval support for NYC buyers."
              />
            </FormField>
            <FormField label="Phone">
              <TextInput name="phone" placeholder="2125550199" />
            </FormField>
            <FormField label="Email">
              <TextInput
                name="email"
                placeholder="team@example.com"
                type="email"
              />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Website">
              <TextInput name="website" placeholder="https://..." type="url" />
            </FormField>
            <FormField
              className="office-form-grid-span-2"
              label="Coverage areas"
            >
              <TextInput
                name="neighborhoods"
                placeholder="Brooklyn, Queens, Jersey City"
              />
            </FormField>
            <FormField className="office-form-grid-span-2" label="Notes">
              <TextareaInput
                name="notes"
                placeholder="Anything the agent should know before reaching out."
                rows={3}
              />
            </FormField>
            <FormField label="Visibility">
              <SelectInput defaultValue="office_only" name="visibilityScope">
                <option value="office_only">Office only</option>
                <option value="organization_wide">Organization-wide</option>
              </SelectInput>
            </FormField>
            <CheckboxField label="Featured go-to">
              <input name="isFeatured" type="checkbox" />
            </CheckboxField>
            <div className="office-filter-actions">
              <Button
                disabled={pendingAction === "create-vendor"}
                type="submit"
              >
                Add vendor
              </Button>
            </div>
          </form>

          <p className="office-form-helper" style={{ margin: "1rem 0 0" }}>
            Keep vendor records short and searchable. Use the same category
            names each time so agents can browse the pool without guessing
            synonyms.
          </p>

          <div style={{ ...groupedListStyle, marginTop: "1rem" }}>
            {snapshot.vendors.length ? (
              vendorCoverage.map((group) => (
                <section key={group.label} style={groupedSectionStyle}>
                  <div style={groupedSectionHeaderStyle}>
                    <div style={{ display: "grid", gap: "0.24rem" }}>
                      <strong>{group.label}</strong>
                      <div style={coverageMetaStyle}>
                        <span>{group.total} total</span>
                        <span>{group.featured} featured</span>
                      </div>
                    </div>
                    <Badge tone={group.featured > 0 ? "accent" : "neutral"}>
                      {group.total}
                    </Badge>
                  </div>

                  <div style={cardGridStyle}>
                    {group.records.map((vendor) => {
                      const isEditing = editingVendorId === vendor.id;
                      const isBusy =
                        pendingAction === `update-vendor:${vendor.id}` ||
                        pendingAction === `delete:vendor:${vendor.id}`;

                      return (
                        <article key={vendor.id} style={recordCardStyle}>
                          {isEditing ? (
                            <form
                              className="office-form-grid"
                              onSubmit={(event) =>
                                handleUpdateVendor(event, vendor.id)
                              }
                            >
                              <FormField label="Category">
                                <TextInput
                                  defaultValue={vendor.category}
                                  name="category"
                                />
                              </FormField>
                              <FormField label="Name">
                                <TextInput
                                  defaultValue={vendor.name}
                                  name="name"
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Headline"
                              >
                                <TextInput
                                  defaultValue={vendor.headline}
                                  name="headline"
                                />
                              </FormField>
                              <FormField label="Phone">
                                <TextInput
                                  defaultValue={vendor.phone}
                                  name="phone"
                                />
                              </FormField>
                              <FormField label="Email">
                                <TextInput
                                  defaultValue={vendor.email}
                                  name="email"
                                  type="email"
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Website"
                              >
                                <TextInput
                                  defaultValue={vendor.website}
                                  name="website"
                                  type="url"
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Coverage areas"
                              >
                                <TextInput
                                  defaultValue={vendor.neighborhoodsText}
                                  name="neighborhoods"
                                />
                              </FormField>
                              <FormField
                                className="office-form-grid-span-2"
                                label="Notes"
                              >
                                <TextareaInput
                                  defaultValue={vendor.notes}
                                  name="notes"
                                  rows={3}
                                />
                              </FormField>
                              <FormField label="Visibility">
                                <SelectInput
                                  defaultValue={vendor.scopeKey}
                                  name="visibilityScope"
                                >
                                  <option value="office_only">
                                    Office only
                                  </option>
                                  <option value="organization_wide">
                                    Organization-wide
                                  </option>
                                </SelectInput>
                              </FormField>
                              <CheckboxField label="Featured go-to">
                                <input
                                  defaultChecked={vendor.isFeatured}
                                  name="isFeatured"
                                  type="checkbox"
                                />
                              </CheckboxField>

                              <div style={actionRowStyle}>
                                <Button disabled={isBusy} type="submit">
                                  Save
                                </Button>
                                <Button
                                  disabled={isBusy}
                                  onClick={() => setEditingVendorId(null)}
                                  type="button"
                                  variant="secondary"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  disabled={isBusy}
                                  onClick={() =>
                                    setConfirmState({
                                      kind: "vendor",
                                      id: vendor.id,
                                      title: vendor.name,
                                    })
                                  }
                                  type="button"
                                  variant="danger"
                                >
                                  Delete
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div style={recordHeaderStyle}>
                                <div style={{ display: "grid", gap: "0.4rem" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <strong>{vendor.name}</strong>
                                    <Badge
                                      tone={
                                        vendor.isFeatured ? "accent" : "neutral"
                                      }
                                    >
                                      {vendor.categoryLabel}
                                    </Badge>
                                    {vendor.isFeatured ? (
                                      <StatusBadge tone="accent">
                                        Featured
                                      </StatusBadge>
                                    ) : null}
                                  </div>
                                  <p
                                    style={{
                                      margin: 0,
                                      color: "#556a83",
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {vendor.headline}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => setEditingVendorId(vendor.id)}
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                >
                                  Edit
                                </Button>
                              </div>

                              <div style={recordMetaStyle}>
                                <span>{vendor.scopeLabel}</span>
                                <span>Updated {vendor.updatedAtLabel}</span>
                                <span>{vendor.coverageLabel}</span>
                              </div>

                              <div style={recordMetaStyle}>
                                {vendor.phone ? (
                                  <span>{vendor.phone}</span>
                                ) : null}
                                {vendor.email ? (
                                  <span>{vendor.email}</span>
                                ) : null}
                                {vendor.website ? (
                                  <span>{vendor.website}</span>
                                ) : null}
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState
                action={
                  <a
                    className="office-button-secondary"
                    href="#vendor-create-form"
                  >
                    Add the first vendor
                  </a>
                }
                description="Add the first vendor record for agents from the form above."
                title="No vendors yet"
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card"
        subtitle="Keep signals lightweight: what people open the most and what may be ready to clean up."
        title={isTrainingMode ? "Training usage signals" : "Usage signals"}
      >
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <div style={signalListStyle}>
            <strong>
              {isTrainingMode
                ? "Top opened training videos"
                : "Top opened resources"}
            </strong>
            {scopedTopOpenedResources.length ? (
              scopedTopOpenedResources.map((resource) => (
                <article key={resource.id} style={signalItemStyle}>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <strong>{resource.title}</strong>
                    <Badge tone="neutral">{resource.typeLabel}</Badge>
                  </div>
                  <span style={{ color: "#556a83", fontSize: "0.84rem" }}>
                    {resource.openCount} opens
                  </span>
                  <span style={{ color: "#667c93", fontSize: "0.82rem" }}>
                    {resource.lastOpenedLabel}
                  </span>
                </article>
              ))
            ) : (
              <EmptyState
                description="Open tracking will start filling in once agents use published materials."
                title="No open history yet"
              />
            )}
          </div>

          <div style={signalListStyle}>
            <strong>
              {isTrainingMode ? "Stale training videos" : "Stale resources"}
            </strong>
            {scopedStaleResources.length ? (
              scopedStaleResources.map((resource) => (
                <article key={resource.id} style={signalItemStyle}>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <strong>{resource.title}</strong>
                    <Badge tone="neutral">{resource.typeLabel}</Badge>
                    <StatusBadge
                      tone={resource.isPublished ? "warning" : "neutral"}
                    >
                      {resource.isPublished ? "Published" : "Draft"}
                    </StatusBadge>
                  </div>
                  <span style={{ color: "#556a83", fontSize: "0.84rem" }}>
                    {resource.lastOpenedLabel}
                  </span>
                  <span style={{ color: "#667c93", fontSize: "0.82rem" }}>
                    Updated {resource.updatedAtLabel}
                  </span>
                </article>
              ))
            ) : (
              <EmptyState
                description="Nothing is currently old enough to flag for cleanup."
                title="No stale resources"
              />
            )}
          </div>
        </div>
      </SectionCard>

      <ConfirmActionDialog
        confirmLabel={
          confirmState?.kind === "resource"
            ? "Delete resource"
            : "Delete vendor"
        }
        description={
          confirmState
            ? `This will permanently remove ${confirmState.title} from the directory.`
            : ""
        }
        isOpen={Boolean(confirmState)}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmDelete}
        title={confirmState ? `Delete ${confirmState.title}?` : ""}
      />
    </div>
  );
}
