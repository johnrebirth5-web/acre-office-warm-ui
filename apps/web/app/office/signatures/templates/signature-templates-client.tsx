"use client";

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
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeSignatureTemplateLibrarySnapshot } from "@acre/db";

type SignatureTemplatesClientProps = {
  snapshot: OfficeSignatureTemplateLibrarySnapshot;
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

function getTemplateTone(isActive: boolean) {
  return isActive ? ("success" as const) : ("neutral" as const);
}

export function SignatureTemplatesClient({ snapshot }: SignatureTemplatesClientProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [editorState, setEditorState] = useState<EditorState>(() => buildEditorState(snapshot));
  const [pendingAction, setPendingAction] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedTemplate = useMemo(
    () => currentSnapshot.templates.find((template) => template.id === editorState.templateId) ?? null,
    [currentSnapshot.templates, editorState.templateId]
  );

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
      const payload = (await response.json().catch(() => null)) as { template?: OfficeSignatureTemplateLibrarySnapshot["templates"][number]; error?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error || "Failed to save template.");
      }

      const nextTemplates = currentSnapshot.templates.map((template) =>
        template.id === payload.template!.id ? payload.template! : template
      );

      setCurrentSnapshot({
        summary: {
          totalCount: nextTemplates.length,
          activeCount: nextTemplates.filter((template) => template.isActive).length
        },
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
      <ListPageSection
        subtitle="Templates are created from configured signature requests, then maintained here for category, status, and delivery copy."
        title="Template library"
      >
        <DataTable className="office-list-table office-list-table-reports">
          <DataTableHeader className="office-list-table-header office-list-table-header-reports">
            <span>Template</span>
            <span>Category</span>
            <span>Recipients</span>
            <span>Fields</span>
            <span>Status</span>
            <span>Updated</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {currentSnapshot.templates.map((template) => (
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
                  </div>
                </div>
                <span>{template.categoryLabel}</span>
                <span>{template.recipients.length}</span>
                <span>{template.fields.length}</span>
                <StatusBadge tone={getTemplateTone(template.isActive)}>{template.isActive ? "Active" : "Inactive"}</StatusBadge>
                <span>{template.updatedAt || "—"}</span>
              </DataTableRow>
            ))}

            {currentSnapshot.templates.length === 0 ? (
              <EmptyState
                description="Open a transaction signature request and use Save as template after the recipient list and field map are ready."
                title="No templates yet"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageSection>

      {selectedTemplate ? (
        <ListPageSection
          subtitle="Edit the reusable metadata and delivery defaults for the selected signature template."
          title="Template details"
        >
          <form className="office-form-grid" onSubmit={handleSave}>
            {error ? <p className="office-inline-error">{error}</p> : null}
            {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}

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
              <SelectInput onChange={(event) => setEditorState((current) => ({ ...current, category: event.target.value as EditorState["category"] }))} value={editorState.category}>
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
