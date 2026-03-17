"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  CheckboxField,
  ConfirmActionDialog,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  ListPageFooter,
  ListPageSection,
  ListPageStack,
  ListPageTableSection,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeChecklistTemplateRecord, OfficeChecklistTemplatesSnapshot } from "@acre/db";

type OfficeSettingsChecklistsClientProps = {
  snapshot: OfficeChecklistTemplatesSnapshot;
  canManageChecklists: boolean;
};

type TemplateItemDraft = {
  id?: string;
  checklistGroup: string;
  title: string;
  description: string;
  dueDaysOffset: string;
  requiresDocument: boolean;
  requiresDocumentApproval: boolean;
  requiresSecondaryApproval: boolean;
};

type TemplateDraft = {
  name: string;
  description: string;
  transactionType: string;
  isActive: boolean;
  items: TemplateItemDraft[];
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function buildTemplateDraft(template: OfficeChecklistTemplateRecord): TemplateDraft {
  return {
    name: template.name,
    description: template.description,
    transactionType: template.transactionTypeValue,
    isActive: template.isActive,
    items: template.items.map((item) => ({
      id: item.id,
      checklistGroup: item.checklistGroup,
      title: item.title,
      description: item.description,
      dueDaysOffset: item.dueDaysOffset,
      requiresDocument: item.requiresDocument,
      requiresDocumentApproval: item.requiresDocumentApproval,
      requiresSecondaryApproval: item.requiresSecondaryApproval
    }))
  };
}

function buildEmptyTemplateDraft(): TemplateDraft {
  return {
    name: "",
    description: "",
    transactionType: "",
    isActive: true,
    items: [
      {
        checklistGroup: "General",
        title: "",
        description: "",
        dueDaysOffset: "",
        requiresDocument: false,
        requiresDocumentApproval: false,
        requiresSecondaryApproval: false
      }
    ]
  };
}

export function OfficeSettingsChecklistsClient({ snapshot, canManageChecklists }: OfficeSettingsChecklistsClientProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [newTemplate, setNewTemplate] = useState<TemplateDraft>(buildEmptyTemplateDraft);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, TemplateDraft>>(
    Object.fromEntries(snapshot.templates.map((template) => [template.id, buildTemplateDraft(template)]))
  );
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    setTemplateDrafts(Object.fromEntries(snapshot.templates.map((template) => [template.id, buildTemplateDraft(template)])));
  }, [snapshot]);

  function setTemplateField(templateId: string, field: keyof TemplateDraft, value: string | boolean) {
    setTemplateDrafts((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] ?? buildEmptyTemplateDraft()),
        [field]: value
      }
    }));
  }

  function setTemplateItemField(
    templateId: string | "new",
    index: number,
    field: keyof TemplateItemDraft,
    value: string | boolean
  ) {
    const update = (draft: TemplateDraft) => ({
      ...draft,
      items: draft.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    });

    if (templateId === "new") {
      setNewTemplate((current) => update(current));
      return;
    }

    setTemplateDrafts((current) => ({
      ...current,
      [templateId]: update(current[templateId] ?? buildEmptyTemplateDraft())
    }));
  }

  function addTemplateItem(templateId: string | "new") {
    const nextItem: TemplateItemDraft = {
      checklistGroup: "General",
      title: "",
      description: "",
      dueDaysOffset: "",
      requiresDocument: false,
      requiresDocumentApproval: false,
      requiresSecondaryApproval: false
    };

    if (templateId === "new") {
      setNewTemplate((current) => ({ ...current, items: [...current.items, nextItem] }));
      return;
    }

    setTemplateDrafts((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] ?? buildEmptyTemplateDraft()),
        items: [...(current[templateId]?.items ?? []), nextItem]
      }
    }));
  }

  function removeTemplateItem(templateId: string | "new", index: number) {
    const update = (draft: TemplateDraft) => ({
      ...draft,
      items: draft.items.filter((_, itemIndex) => itemIndex !== index)
    });

    if (templateId === "new") {
      setNewTemplate((current) => update(current));
      return;
    }

    setTemplateDrafts((current) => ({
      ...current,
      [templateId]: update(current[templateId] ?? buildEmptyTemplateDraft())
    }));
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create-template");
    setSubmitError("");

    try {
      const response = await fetch("/api/office/settings/checklists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newTemplate)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to create checklist template.");
      }

      setNewTemplate(buildEmptyTemplateDraft());
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create checklist template.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTemplate(templateId: string) {
    const draft = templateDrafts[templateId];
    if (!draft) {
      return;
    }

    setPendingAction(`save-template:${templateId}`);
    setSubmitError("");

    try {
      const response = await fetch(`/api/office/settings/checklists/${templateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update checklist template.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update checklist template.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <ListPageStack>
      {submitError ? <p className="office-inline-error">{submitError}</p> : null}

      <ListPageTableSection
        footer={<ListPageFooter summary={`${snapshot.templates.length} checklist templates`} />}
        subtitle="Canonical list view for template inventory before opening detailed editors."
        title="Checklist templates"
      >
        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-checklists">
            <span>Template</span>
            <span>Context</span>
            <span>Items</span>
            <span>Status</span>
            <span>Updated</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.templates.length ? (
              snapshot.templates.map((template) => (
                <DataTableRow className="office-table-row office-table-row-settings-checklists" key={`summary-${template.id}`}>
                  <div className="office-table-primary">
                    <strong>{template.name}</strong>
                    <p>{template.description || "No description"}</p>
                  </div>
                  <span>{template.transactionTypeLabel}</span>
                  <span>{template.items.length}</span>
                  <span>
                    <StatusBadge tone={template.isActive ? "success" : "neutral"}>{template.isActive ? "Active" : "Inactive"}</StatusBadge>
                  </span>
                  <span>{template.updatedByName}</span>
                </DataTableRow>
              ))
            ) : (
              <EmptyState description="Create the first checklist template to start enforcing office workflow requirements." title="No templates yet" />
            )}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      {canManageChecklists ? (
        <ListPageSection subtitle="Create reusable grouped task templates for office workflows." title="New checklist template">
          <form className="office-settings-template-form" onSubmit={handleCreateTemplate}>
            <div className="office-settings-template-meta">
              <FormField label="Template name">
                <TextInput onChange={(event) => setNewTemplate((current) => ({ ...current, name: event.target.value }))} value={newTemplate.name} />
              </FormField>

              <FormField label="Transaction context">
                <SelectInput onChange={(event) => setNewTemplate((current) => ({ ...current, transactionType: event.target.value }))} value={newTemplate.transactionType}>
                  {snapshot.transactionTypeOptions.map((option) => (
                    <option key={option.value || "default"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
            </div>

            <FormField label="Description">
              <TextareaInput onChange={(event) => setNewTemplate((current) => ({ ...current, description: event.target.value }))} rows={3} value={newTemplate.description} />
            </FormField>

            <div className="office-settings-template-items">
              {newTemplate.items.map((item, index) => (
                <div className="office-settings-template-item" key={`new-item-${index}`}>
                  <div className="office-settings-template-item-grid">
                    <FormField label="Group">
                      <TextInput onChange={(event) => setTemplateItemField("new", index, "checklistGroup", event.target.value)} value={item.checklistGroup} />
                    </FormField>

                    <FormField label="Task title">
                      <TextInput onChange={(event) => setTemplateItemField("new", index, "title", event.target.value)} value={item.title} />
                    </FormField>

                    <FormField label="Due offset (days)">
                      <TextInput onChange={(event) => setTemplateItemField("new", index, "dueDaysOffset", event.target.value)} value={item.dueDaysOffset} />
                    </FormField>
                  </div>

                  <FormField label="Description">
                    <TextareaInput onChange={(event) => setTemplateItemField("new", index, "description", event.target.value)} rows={2} value={item.description} />
                  </FormField>

                  <div className="office-settings-checkbox-grid">
                    <CheckboxField label="Requires document">
                      <input
                        checked={item.requiresDocument}
                        onChange={(event) => setTemplateItemField("new", index, "requiresDocument", event.target.checked)}
                        type="checkbox"
                      />
                    </CheckboxField>
                    <CheckboxField label="Requires document approval">
                      <input
                        checked={item.requiresDocumentApproval}
                        onChange={(event) => setTemplateItemField("new", index, "requiresDocumentApproval", event.target.checked)}
                        type="checkbox"
                      />
                    </CheckboxField>
                    <CheckboxField label="Requires secondary approval">
                      <input
                        checked={item.requiresSecondaryApproval}
                        onChange={(event) => setTemplateItemField("new", index, "requiresSecondaryApproval", event.target.checked)}
                        type="checkbox"
                      />
                    </CheckboxField>
                  </div>

                  {newTemplate.items.length > 1 ? (
                    <button
                      className="office-settings-item-delete"
                      onClick={() =>
                        setConfirmDialog({
                          title: `Remove row ${index + 1}?`,
                          description: "This removes the checklist row from the draft before you save the template.",
                          confirmLabel: "Remove row",
                          onConfirm: () => {
                            removeTemplateItem("new", index);
                          }
                        })
                      }
                      type="button"
                    >
                      Remove row
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="office-settings-actions">
              <Button onClick={() => addTemplateItem("new")} type="button" variant="secondary">
                Add row
              </Button>
              <Button disabled={pendingAction === "create-template"} type="submit">
                {pendingAction === "create-template" ? "Creating..." : "Create template"}
              </Button>
            </div>
          </form>
        </ListPageSection>
      ) : null}

      <ListPageSection subtitle="Open any template below for full row-level editing." title="Template editor">
        <div className="office-settings-card-grid">
          {snapshot.templates.map((template) => {
            const draft = templateDrafts[template.id] ?? buildTemplateDraft(template);

            return (
              <ListPageSection
                actions={<Button disabled={!canManageChecklists || pendingAction === `save-template:${template.id}`} onClick={() => handleSaveTemplate(template.id)} size="sm" variant="secondary">{pendingAction === `save-template:${template.id}` ? "Saving..." : "Save"}</Button>}
                className="office-settings-template-card"
                key={template.id}
                subtitle={`${template.createdByName} created · ${template.updatedByName} updated`}
                title={template.name}
              >
                <div className="office-settings-template-meta">
                  <FormField label="Template name">
                    <TextInput
                      disabled={!canManageChecklists}
                      onChange={(event) => setTemplateField(template.id, "name", event.target.value)}
                      value={draft.name}
                    />
                  </FormField>

                  <FormField label="Context">
                    <SelectInput
                      disabled={!canManageChecklists}
                      onChange={(event) => setTemplateField(template.id, "transactionType", event.target.value)}
                      value={draft.transactionType}
                    >
                      {snapshot.transactionTypeOptions.map((option) => (
                        <option key={option.value || "default"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                </div>

                <FormField label="Description">
                  <TextareaInput
                    disabled={!canManageChecklists}
                    onChange={(event) => setTemplateField(template.id, "description", event.target.value)}
                    rows={3}
                    value={draft.description}
                  />
                </FormField>

                <CheckboxField label="Active template">
                  <input
                    checked={draft.isActive}
                    disabled={!canManageChecklists}
                    onChange={(event) => setTemplateField(template.id, "isActive", event.target.checked)}
                    type="checkbox"
                  />
                </CheckboxField>

                <div className="office-settings-template-items">
                  {draft.items.map((item, index) => (
                    <div className="office-settings-template-item" key={item.id ?? `${template.id}-${index}`}>
                      <div className="office-settings-template-item-grid">
                        <FormField label="Group">
                          <TextInput
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "checklistGroup", event.target.value)}
                            value={item.checklistGroup}
                          />
                        </FormField>

                        <FormField label="Task title">
                          <TextInput
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "title", event.target.value)}
                            value={item.title}
                          />
                        </FormField>

                        <FormField label="Due offset (days)">
                          <TextInput
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "dueDaysOffset", event.target.value)}
                            value={item.dueDaysOffset}
                          />
                        </FormField>
                      </div>

                      <FormField label="Description">
                        <TextareaInput
                          disabled={!canManageChecklists}
                          onChange={(event) => setTemplateItemField(template.id, index, "description", event.target.value)}
                          rows={2}
                          value={item.description}
                        />
                      </FormField>

                      <div className="office-settings-checkbox-grid">
                        <CheckboxField label="Requires document">
                          <input
                            checked={item.requiresDocument}
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "requiresDocument", event.target.checked)}
                            type="checkbox"
                          />
                        </CheckboxField>
                        <CheckboxField label="Requires document approval">
                          <input
                            checked={item.requiresDocumentApproval}
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "requiresDocumentApproval", event.target.checked)}
                            type="checkbox"
                          />
                        </CheckboxField>
                        <CheckboxField label="Requires secondary approval">
                          <input
                            checked={item.requiresSecondaryApproval}
                            disabled={!canManageChecklists}
                            onChange={(event) => setTemplateItemField(template.id, index, "requiresSecondaryApproval", event.target.checked)}
                            type="checkbox"
                          />
                        </CheckboxField>
                      </div>

                      {canManageChecklists && draft.items.length > 1 ? (
                        <button
                          className="office-settings-item-delete"
                          onClick={() =>
                            setConfirmDialog({
                              title: `Remove row ${index + 1}?`,
                              description: "This removes the checklist row from the current template draft until you save again.",
                              confirmLabel: "Remove row",
                              onConfirm: () => {
                                removeTemplateItem(template.id, index);
                              }
                            })
                          }
                          type="button"
                        >
                          Remove row
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {canManageChecklists ? (
                  <div className="office-settings-actions">
                    <Button onClick={() => addTemplateItem(template.id)} size="sm" type="button" variant="secondary">
                      Add row
                    </Button>
                  </div>
                ) : null}
              </ListPageSection>
            );
          })}
          {snapshot.templates.length === 0 ? (
            <EmptyState description="Create your first checklist template to configure workflow rows." title="No templates to edit" />
          ) : null}
        </div>

        <ConfirmActionDialog
          cancelLabel="Keep row"
          confirmLabel={confirmDialog?.confirmLabel}
          description={confirmDialog?.description ?? ""}
          isOpen={Boolean(confirmDialog)}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            if (!confirmDialog) {
              return;
            }

            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            action();
          }}
          title={confirmDialog?.title ?? ""}
        />
      </ListPageSection>
    </ListPageStack>
  );
}
