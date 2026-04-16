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

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

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

function parseCsv(value: FormDataEntryValue | null) {
  return `${value ?? ""}`
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function parseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as JsonResponse | null;
  return payload?.error || fallback;
}

export function OfficeResourcesClient({
  snapshot,
}: OfficeResourcesClientProps) {
  const router = useRouter();
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  async function refreshWithFeedback(nextFeedback: FeedbackState) {
    setFeedback(nextFeedback);
    router.refresh();
  }

  async function handleCreateResource(
    event: FormEvent<HTMLFormElement>,
  ) {
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
      const response = await fetch(`/api/office/resources/vendors/${vendorId}`, {
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
      });

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
            isResource ? "Failed to delete resource." : "Failed to delete vendor.",
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
        subtitle="Create and maintain the published materials that agents can search from Front Office."
        title="Resources"
      >
        <ListPageStatsGrid>
          <StatCard
            hint="visible records in this office scope"
            label="Total resources"
            tone="accent"
            value={snapshot.summary.resourceCount}
          />
          <StatCard
            hint="currently visible to agents"
            label="Published"
            value={snapshot.summary.publishedResourceCount}
          />
          <StatCard
            hint="training materials in this directory"
            label="Training"
            value={snapshot.summary.trainingResourceCount}
          />
          <StatCard
            hint="older records worth reviewing"
            label="Stale"
            value={snapshot.summary.staleResourceCount}
          />
        </ListPageStatsGrid>

        <form
          className="office-form-grid"
          onSubmit={handleCreateResource}
          style={{ marginTop: "1rem" }}
        >
          <FormField className="office-form-grid-span-2" label="Title">
            <TextInput name="title" placeholder="New buyer consultation checklist" />
          </FormField>
          <FormField className="office-form-grid-span-2" label="Summary">
            <TextareaInput
              name="summary"
              placeholder="What this material helps the agent do."
              rows={3}
            />
          </FormField>
          <FormField className="office-form-grid-span-2" label="URL">
            <TextInput
              name="url"
              placeholder="https://..."
              type="url"
            />
          </FormField>
          <FormField label="Type">
            <SelectInput defaultValue="playbook" name="type">
              {snapshot.resourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Visibility">
            <SelectInput defaultValue="office_only" name="visibilityScope">
              <option value="office_only">Office only</option>
              <option value="organization_wide">Organization-wide</option>
            </SelectInput>
          </FormField>
          <FormField className="office-form-grid-span-2" label="Tags">
            <TextInput
              name="tags"
              placeholder="buyers, consultation, checklist"
            />
          </FormField>
          <CheckboxField className="office-form-grid-span-2" label="Published">
            <input defaultChecked name="isPublished" type="checkbox" />
          </CheckboxField>
          <div className="office-filter-actions">
            <Button
              disabled={pendingAction === "create-resource"}
              type="submit"
            >
              Add resource
            </Button>
          </div>
        </form>

        <div style={{ ...cardGridStyle, marginTop: "1rem" }}>
          {snapshot.resources.length ? (
            snapshot.resources.map((resource) => {
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
                      <FormField className="office-form-grid-span-2" label="Title">
                        <TextInput defaultValue={resource.title} name="title" />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Summary">
                        <TextareaInput
                          defaultValue={resource.summary}
                          name="summary"
                          rows={3}
                        />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="URL">
                        <TextInput defaultValue={resource.url} name="url" type="url" />
                      </FormField>
                      <FormField label="Type">
                        <SelectInput defaultValue={resource.type} name="type">
                          {snapshot.resourceTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectInput>
                      </FormField>
                      <FormField label="Visibility">
                        <SelectInput
                          defaultValue={resource.scopeKey}
                          name="visibilityScope"
                        >
                          <option value="office_only">Office only</option>
                          <option value="organization_wide">
                            Organization-wide
                          </option>
                        </SelectInput>
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Tags">
                        <TextInput defaultValue={resource.tagsText} name="tags" />
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
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <strong>{resource.title}</strong>
                            <Badge tone="neutral">{resource.typeLabel}</Badge>
                            <StatusBadge
                              tone={resource.isPublished ? "accent" : "warning"}
                            >
                              {resource.isPublished ? "Published" : "Draft"}
                            </StatusBadge>
                          </div>
                          <p style={{ margin: 0, color: "#556a83", lineHeight: 1.5 }}>
                            {resource.summary}
                          </p>
                        </div>
                        <Button
                          onClick={() => setEditingResourceId(resource.id)}
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
                        {resource.tagsText ? <span>{resource.tagsText}</span> : null}
                      </div>
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState
              description="Add the first published material for agents from the form above."
              title="No resources yet"
            />
          )}
        </div>
      </SectionCard>

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
            <TextInput name="email" placeholder="team@example.com" type="email" />
          </FormField>
          <FormField className="office-form-grid-span-2" label="Website">
            <TextInput name="website" placeholder="https://..." type="url" />
          </FormField>
          <FormField className="office-form-grid-span-2" label="Coverage areas">
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
            <Button disabled={pendingAction === "create-vendor"} type="submit">
              Add vendor
            </Button>
          </div>
        </form>

        <div style={{ ...cardGridStyle, marginTop: "1rem" }}>
          {snapshot.vendors.length ? (
            snapshot.vendors.map((vendor) => {
              const isEditing = editingVendorId === vendor.id;
              const isBusy =
                pendingAction === `update-vendor:${vendor.id}` ||
                pendingAction === `delete:vendor:${vendor.id}`;

              return (
                <article key={vendor.id} style={recordCardStyle}>
                  {isEditing ? (
                    <form
                      className="office-form-grid"
                      onSubmit={(event) => handleUpdateVendor(event, vendor.id)}
                    >
                      <FormField label="Category">
                        <TextInput defaultValue={vendor.category} name="category" />
                      </FormField>
                      <FormField label="Name">
                        <TextInput defaultValue={vendor.name} name="name" />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Headline">
                        <TextInput defaultValue={vendor.headline} name="headline" />
                      </FormField>
                      <FormField label="Phone">
                        <TextInput defaultValue={vendor.phone} name="phone" />
                      </FormField>
                      <FormField label="Email">
                        <TextInput defaultValue={vendor.email} name="email" type="email" />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Website">
                        <TextInput defaultValue={vendor.website} name="website" type="url" />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Coverage areas">
                        <TextInput
                          defaultValue={vendor.neighborhoodsText}
                          name="neighborhoods"
                        />
                      </FormField>
                      <FormField className="office-form-grid-span-2" label="Notes">
                        <TextareaInput defaultValue={vendor.notes} name="notes" rows={3} />
                      </FormField>
                      <FormField label="Visibility">
                        <SelectInput
                          defaultValue={vendor.scopeKey}
                          name="visibilityScope"
                        >
                          <option value="office_only">Office only</option>
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
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <strong>{vendor.name}</strong>
                            <Badge tone={vendor.isFeatured ? "accent" : "neutral"}>
                              {vendor.categoryLabel}
                            </Badge>
                            {vendor.isFeatured ? (
                              <StatusBadge tone="accent">Featured</StatusBadge>
                            ) : null}
                          </div>
                          <p style={{ margin: 0, color: "#556a83", lineHeight: 1.5 }}>
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
                        {vendor.phone ? <span>{vendor.phone}</span> : null}
                        {vendor.email ? <span>{vendor.email}</span> : null}
                        {vendor.website ? <span>{vendor.website}</span> : null}
                      </div>
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState
              description="Add the first vendor record for agents from the form above."
              title="No vendors yet"
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Keep signals lightweight: what people open the most and what may be ready to clean up."
        title="Usage signals"
      >
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <div style={signalListStyle}>
            <strong>Top opened resources</strong>
            {snapshot.topOpenedResources.length ? (
              snapshot.topOpenedResources.map((resource) => (
                <article key={resource.id} style={signalItemStyle}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
            <strong>Stale resources</strong>
            {snapshot.staleResources.length ? (
              snapshot.staleResources.map((resource) => (
                <article key={resource.id} style={signalItemStyle}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <strong>{resource.title}</strong>
                    <Badge tone="neutral">{resource.typeLabel}</Badge>
                    <StatusBadge tone={resource.isPublished ? "warning" : "neutral"}>
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
        confirmLabel={confirmState?.kind === "resource" ? "Delete resource" : "Delete vendor"}
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
