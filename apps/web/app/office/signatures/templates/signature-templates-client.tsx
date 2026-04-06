"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  ListPageSection,
  ListPageStatsGrid,
  ListPageTableSection,
  SecondaryMetaList,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeSignatureTemplate, OfficeSignatureTemplateLibrarySnapshot } from "@acre/db";

type SignatureTemplatesClientProps = {
  snapshot: OfficeSignatureTemplateLibrarySnapshot;
  canManageSignatures: boolean;
};

type EditorState = {
  templateId: string;
  name: string;
  description: string;
  category: "transaction" | "hr" | "finance" | "admin";
  isActive: boolean;
  emailSubject: string;
  emailBody: string;
  senderDisplayName: string;
  senderReplyTo: string;
};

type LibraryFilterState = {
  query: string;
  category: "all" | "transaction" | "hr" | "finance" | "admin";
  status: "all" | "active" | "inactive" | "live_drafts" | "unused";
};

function buildEditorState(snapshot: OfficeSignatureTemplateLibrarySnapshot): EditorState {
  const template = snapshot.templates[0];

  return {
    templateId: template?.id ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    category: template?.category ?? "transaction",
    isActive: template?.isActive ?? true,
    emailSubject: template?.emailSubject ?? "",
    emailBody: template?.emailBody ?? "",
    senderDisplayName: template?.senderDisplayName ?? "",
    senderReplyTo: template?.senderReplyTo ?? ""
  };
}

function buildSnapshotSummary(templates: OfficeSignatureTemplate[]) {
  return {
    totalCount: templates.length,
    activeCount: templates.filter((template) => template.isActive).length,
    inactiveCount: templates.filter((template) => !template.isActive).length,
    nonTransactionCount: templates.filter((template) => template.category !== "transaction").length,
    usedCount: templates.filter((template) => template.usage.totalCount > 0).length,
    templatesWithLiveDraftsCount: templates.filter((template) => template.usage.draftCount > 0).length
  };
}

function getTemplateTone(isActive: boolean) {
  return isActive ? ("success" as const) : ("neutral" as const);
}

function getRequestTone(statusKey: string) {
  if (statusKey === "completed") {
    return "success" as const;
  }

  if (statusKey === "declined" || statusKey === "canceled" || statusKey === "voided" || statusKey === "expired") {
    return "danger" as const;
  }

  if (statusKey === "pending_send" || statusKey === "sent" || statusKey === "viewed" || statusKey === "signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getLatestRequestActionLabel(template: OfficeSignatureTemplate) {
  if (!template.latestRequest) {
    return "";
  }

  if (template.latestRequest.statusKey === "draft" || template.latestRequest.statusKey === "pending_send") {
    return "Continue latest draft";
  }

  return "Open latest request";
}

function getReuseActionLabel(template: OfficeSignatureTemplate) {
  if (!template.latestRequest?.reuseHref) {
    return "";
  }

  if (template.usage.totalCount > 0) {
    return "Reuse on latest source PDF";
  }

  return "Use template";
}

export function SignatureTemplatesClient({
  snapshot,
  canManageSignatures
}: SignatureTemplatesClientProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [editorState, setEditorState] = useState<EditorState>(() => buildEditorState(snapshot));
  const [filterState, setFilterState] = useState<LibraryFilterState>({
    query: "",
    category: "all",
    status: "all"
  });
  const [pendingAction, setPendingAction] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedTemplate = useMemo(
    () => currentSnapshot.templates.find((template) => template.id === editorState.templateId) ?? null,
    [currentSnapshot.templates, editorState.templateId]
  );

  const filteredTemplates = useMemo(() => {
    const query = filterState.query.trim().toLowerCase();

    return currentSnapshot.templates.filter((template) => {
      if (filterState.category !== "all" && template.category !== filterState.category) {
        return false;
      }

      if (filterState.status === "active" && !template.isActive) {
        return false;
      }

      if (filterState.status === "inactive" && template.isActive) {
        return false;
      }

      if (filterState.status === "live_drafts" && template.usage.draftCount === 0) {
        return false;
      }

      if (filterState.status === "unused" && template.usage.totalCount > 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        template.name,
        template.description,
        template.categoryLabel,
        template.emailSubject,
        template.senderDisplayName,
        template.latestRequest?.title ?? "",
        template.latestRequest?.transactionLabel ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [currentSnapshot.templates, filterState]);

  function selectTemplate(templateId: string) {
    const template = currentSnapshot.templates.find((entry) => entry.id === templateId) ?? null;

    if (!template) {
      return;
    }

    setEditorState({
      templateId: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      isActive: template.isActive,
      emailSubject: template.emailSubject,
      emailBody: template.emailBody,
      senderDisplayName: template.senderDisplayName,
      senderReplyTo: template.senderReplyTo
    });
    setError("");
    setSuccessMessage("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate) {
      setError("Select a template first.");
      return;
    }

    setPendingAction(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/office/signatures/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          name: editorState.name,
          description: editorState.description,
          category: editorState.category,
          isActive: editorState.isActive,
          emailSubject: editorState.emailSubject,
          emailBody: editorState.emailBody,
          senderDisplayName: editorState.senderDisplayName,
          senderReplyTo: editorState.senderReplyTo,
          recipients: selectedTemplate.recipients.map((recipient) => ({
            id: recipient.id,
            role: recipient.roleKey,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.routingStep,
            sortOrder: recipient.sortOrder
          })),
          fields: selectedTemplate.fields.map((field) => ({
            assignedTemplateRecipientId: field.assignedTemplateRecipientId,
            fieldType: field.fieldType,
            label: field.label,
            page: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required,
            defaultValue: field.defaultValue,
            fontStyle: field.fontStyle,
            fieldKey: field.fieldKey,
            isReadOnly: field.isReadOnly,
            isSystemPrefilled: field.isSystemPrefilled,
            visibilityRule: field.visibilityRule,
            mirrorGroup: field.mirrorGroup,
            fieldOptions: field.fieldOptions,
            sortOrder: field.sortOrder
          }))
        })
      });
      const payload = (await response.json().catch(() => null)) as { template?: OfficeSignatureTemplate; error?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error || "Failed to save template.");
      }

      const nextTemplates = currentSnapshot.templates.map((template) =>
        template.id === payload.template!.id ? payload.template! : template
      );

      setCurrentSnapshot({
        summary: buildSnapshotSummary(nextTemplates),
        templates: nextTemplates
      });
      setEditorState({
        templateId: payload.template.id,
        name: payload.template.name,
        description: payload.template.description,
        category: payload.template.category,
        isActive: payload.template.isActive,
        emailSubject: payload.template.emailSubject,
        emailBody: payload.template.emailBody,
        senderDisplayName: payload.template.senderDisplayName,
        senderReplyTo: payload.template.senderReplyTo
      });
      setSuccessMessage("Template updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save template.");
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <>
      <ListPageStatsGrid>
        <StatCard hint="Active templates available for the next authoring session." label="Active" tone="accent" value={currentSnapshot.summary.activeCount} />
        <StatCard hint="Templates intentionally parked but still retained in the library." label="Inactive" value={currentSnapshot.summary.inactiveCount} />
        <StatCard hint="HR, finance, and admin templates that read less transaction-specific." label="Non-transaction" value={currentSnapshot.summary.nonTransactionCount} />
        <StatCard hint="Templates that already have at least one request in circulation or history." label="Used at least once" value={currentSnapshot.summary.usedCount} />
        <StatCard hint="Templates that currently have a draft or pending-send request you can continue." label="Live drafts" value={currentSnapshot.summary.templatesWithLiveDraftsCount} />
      </ListPageStatsGrid>

      <ListPageSection
        subtitle="Filter the template library by name, category, operational status, or whether a template already has a live draft in motion."
        title="Library controls"
      >
        <div className="office-form-grid">
          <FormField label="Search">
            <TextInput
              onChange={(event) => setFilterState((current) => ({ ...current, query: event.target.value }))}
              placeholder="Template name, description, latest request..."
              value={filterState.query}
            />
          </FormField>

          <FormField label="Category">
            <SelectInput
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  category: event.target.value as LibraryFilterState["category"]
                }))
              }
              value={filterState.category}
            >
              <option value="all">All categories</option>
              <option value="transaction">Transaction</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </SelectInput>
          </FormField>

          <FormField label="Status">
            <SelectInput
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  status: event.target.value as LibraryFilterState["status"]
                }))
              }
              value={filterState.status}
            >
              <option value="all">All templates</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
              <option value="live_drafts">With live drafts</option>
              <option value="unused">Never used</option>
            </SelectInput>
          </FormField>

          <div className="office-filter-actions office-form-grid-span-2 office-signatures-filter-actions">
            <Button
              onClick={() =>
                setFilterState({
                  query: "",
                  category: "all",
                  status: "all"
                })
              }
              type="button"
              variant="secondary"
            >
              Clear filters
            </Button>
            <Link className="office-button-secondary" href="/office/signatures">
              Open signatures center
            </Link>
          </div>
        </div>

        <p className="office-form-helper">
          Showing <strong>{filteredTemplates.length}</strong> of <strong>{currentSnapshot.summary.totalCount}</strong> templates.
        </p>
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        subtitle="Templates remain reusable blueprints, but this library now surfaces whether each one already has a live draft or recent request that operations can continue from the center."
        title="Template library"
      >
        <DataTable className="office-list-table office-list-table-reports">
          <DataTableHeader className="office-list-table-header office-list-table-header-reports">
            <span>Template</span>
            <span>Category</span>
            <span>Structure</span>
            <span>Live queue</span>
            <span>Status</span>
            <span>Updated</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {filteredTemplates.map((template) => (
              <DataTableRow className="office-list-table-row office-list-table-row-reports" key={template.id}>
                <div className="office-list-table-main">
                  <strong>
                    <button className="office-toggle-link" onClick={() => selectTemplate(template.id)} type="button">
                      {template.name}
                    </button>
                  </strong>
                  <p>{template.description || "No description"}</p>
                  <div className="office-list-table-main-meta">
                    <span>{template.createdByLabel}</span>
                    <span>Version {template.version}</span>
                    {canManageSignatures && template.latestRequest?.requestHref ? (
                      <span>
                        <Link className="office-toggle-link" href={template.latestRequest.requestHref}>
                          {getLatestRequestActionLabel(template)}
                        </Link>
                      </span>
                    ) : null}
                    {canManageSignatures && template.latestRequest?.reuseHref ? (
                      <span>
                        <Link className="office-toggle-link" href={template.latestRequest.reuseHref}>
                          {getReuseActionLabel(template)}
                        </Link>
                      </span>
                    ) : null}
                  </div>
                </div>
                <span>{template.categoryLabel}</span>
                <div className="office-list-table-cell-stack">
                  <strong>{`${template.recipients.length} roles`}</strong>
                  <p>{`${template.fields.length} fields`}</p>
                </div>
                <div className="office-list-table-cell-stack">
                  <strong>{template.usage.totalCount ? `${template.usage.totalCount} total uses` : "No live usage"}</strong>
                  <p>{`${template.usage.draftCount} live drafts · ${template.usage.inFlightCount} in flight · ${template.usage.completedCount} completed`}</p>
                </div>
                <StatusBadge tone={getTemplateTone(template.isActive)}>{template.isActive ? "Active" : "Inactive"}</StatusBadge>
                <span>{template.updatedAt || "—"}</span>
              </DataTableRow>
            ))}

            {filteredTemplates.length === 0 ? (
              <EmptyState
                description="Try clearing a filter, or save a prepared request as a template from the signature editor so it becomes reusable here."
                title="No templates matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      {selectedTemplate ? (
        <ListPageSection
          subtitle="The template library remains the place to maintain reusable metadata and delivery defaults, while the latest live request link brings you back into real authoring when that template is already in motion."
          title="Selected template"
        >
          {error ? <p className="office-inline-error">{error}</p> : null}
          {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}

          <ListPageStatsGrid>
            <StatCard hint="Recipient roles defined on this template." label="Recipient roles" tone="accent" value={selectedTemplate.recipients.length} />
            <StatCard hint="Field placements carried into the editor when the template is applied." label="Fields" value={selectedTemplate.fields.length} />
            <StatCard hint="Draft or pending-send requests already tied to this template." label="Live drafts" value={selectedTemplate.usage.draftCount} />
            <StatCard hint="Total request count using this template." label="Total uses" value={selectedTemplate.usage.totalCount} />
          </ListPageStatsGrid>

          <p className="office-form-helper">
            Templates still apply on top of a source PDF in the real request editor. This page centralizes upkeep and gives you a direct way back
            to the latest live request when one already exists.
          </p>

          <SecondaryMetaList
            items={[
              {
                label: "Category",
                value: selectedTemplate.categoryLabel
              },
              {
                label: "Created by",
                value: selectedTemplate.createdByLabel
              },
              {
                label: "Latest live request",
                value: selectedTemplate.latestRequest ? (
                  canManageSignatures && selectedTemplate.latestRequest.requestHref ? (
                    <Link href={selectedTemplate.latestRequest.requestHref}>{selectedTemplate.latestRequest.title}</Link>
                  ) : (
                    selectedTemplate.latestRequest.title
                  )
                ) : (
                  "No request has used this template yet."
                )
              },
              {
                label: "Latest request status",
                value: selectedTemplate.latestRequest ? (
                  <StatusBadge tone={getRequestTone(selectedTemplate.latestRequest.statusKey)}>
                    {selectedTemplate.latestRequest.statusLabel}
                  </StatusBadge>
                ) : (
                  "—"
                )
              },
              {
                label: "Latest transaction",
                value: selectedTemplate.latestRequest?.transactionHref ? (
                  <Link href={selectedTemplate.latestRequest.transactionHref}>{selectedTemplate.latestRequest.transactionLabel}</Link>
                ) : (
                  "—"
                )
              },
              {
                label: "Latest activity",
                value: selectedTemplate.latestRequest?.updatedAt || selectedTemplate.updatedAt || "—"
              }
            ]}
          />

          <div className="office-settings-actions">
            {canManageSignatures && selectedTemplate.latestRequest?.requestHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.requestHref}>
                {getLatestRequestActionLabel(selectedTemplate)}
              </Link>
            ) : null}
            {canManageSignatures && selectedTemplate.latestRequest?.reuseHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.reuseHref}>
                {getReuseActionLabel(selectedTemplate)}
              </Link>
            ) : null}
            {selectedTemplate.latestRequest?.transactionHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.transactionHref}>
                Open transaction
              </Link>
            ) : null}
            <Link className="office-button-secondary" href={`/office/signatures?category=${selectedTemplate.category}`}>
              Open {selectedTemplate.categoryLabel} queue
            </Link>
          </div>

          <form className="office-form-grid" onSubmit={handleSave}>
            <FormField label="Selected template">
              <SelectInput onChange={(event) => selectTemplate(event.target.value)} value={editorState.templateId}>
                {currentSnapshot.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Category">
              <SelectInput
                onChange={(event) =>
                  setEditorState((current) => ({
                    ...current,
                    category: event.target.value as EditorState["category"]
                  }))
                }
                value={editorState.category}
              >
                <option value="transaction">Transaction</option>
                <option value="hr">HR</option>
                <option value="finance">Finance</option>
                <option value="admin">Admin</option>
              </SelectInput>
            </FormField>

            <FormField label="Template name">
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, name: event.target.value }))} value={editorState.name} />
            </FormField>

            <div className="office-detail-field">
              <label className="office-detail-label">Active template</label>
              <input
                checked={editorState.isActive}
                onChange={(event) => setEditorState((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
            </div>

            <FormField className="office-detail-field-wide" label="Description">
              <TextareaInput onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))} rows={3} value={editorState.description} />
            </FormField>

            <FormField className="office-detail-field-wide" label="Email subject">
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, emailSubject: event.target.value }))} value={editorState.emailSubject} />
            </FormField>

            <FormField className="office-detail-field-wide" label="Email body">
              <TextareaInput onChange={(event) => setEditorState((current) => ({ ...current, emailBody: event.target.value }))} rows={4} value={editorState.emailBody} />
            </FormField>

            <FormField label="Sender display name">
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, senderDisplayName: event.target.value }))} value={editorState.senderDisplayName} />
            </FormField>

            <FormField label="Reply-to email">
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, senderReplyTo: event.target.value }))} type="email" value={editorState.senderReplyTo} />
            </FormField>

            <div className="office-settings-actions">
              <Button disabled={pendingAction} type="submit">
                {pendingAction ? "Saving..." : "Save template"}
              </Button>
            </div>
          </form>
        </ListPageSection>
      ) : null}
    </>
  );
}
