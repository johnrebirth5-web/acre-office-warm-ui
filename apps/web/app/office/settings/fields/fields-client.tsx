"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type DragEvent } from "react";
import {
  Button,
  CheckboxField,
  ConfirmActionDialog,
  SelectInput,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type {
  OfficeFieldBuiltInRecord,
  OfficeFieldCustomDefinitionRecord,
  OfficeFieldModule,
  OfficeFieldModuleSettingsSnapshot,
  OfficeFieldSettingsSnapshot,
  OfficeRequiredContactRoleRecord
} from "@acre/db";

type OfficeSettingsFieldsClientProps = {
  snapshot: OfficeFieldSettingsSnapshot;
  canManageFields: boolean;
  hideModuleRail?: boolean;
  panelDescription?: string;
  panelTitle?: string;
  onModuleSnapshotChange?: (nextModule: OfficeFieldModuleSettingsSnapshot) => void;
};

type FieldEntry =
  | { kind: "builtIn"; field: OfficeFieldBuiltInRecord }
  | { kind: "custom"; field: OfficeFieldCustomDefinitionRecord };

type FieldEditorState = {
  mode: "create" | "edit";
  kind: "builtIn" | "custom";
  fieldKey: string;
  label: string;
  type: "text" | "select" | "date" | "textarea";
  isRequired: boolean;
  isVisible: boolean;
  isDeletionLocked: boolean;
  isLockedRequired: boolean;
  isLockedVisible: boolean;
  isLockedDeletion: boolean;
  sortOrder: number;
  optionsText: string;
  selectOptions: Array<{
    value: string;
    label: string;
    isEnabled: boolean;
  }>;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type DragOverState = {
  fieldKey: string;
  position: "before" | "after";
};

const customFieldTypeOptions = [
  { value: "text", label: "Text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" }
] as const;

function sortFieldEntries(entries: FieldEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.field.sortOrder !== right.field.sortOrder) {
      return left.field.sortOrder - right.field.sortOrder;
    }

    if (left.kind !== right.kind) {
      return left.kind === "builtIn" ? -1 : 1;
    }

    return left.field.label.localeCompare(right.field.label);
  });
}

function buildFieldEntries(snapshot: OfficeFieldModuleSettingsSnapshot, isVisible: boolean) {
  return sortFieldEntries([
    ...snapshot.builtInFields
      .filter((field) => field.isVisible === isVisible)
      .map((field) => ({ kind: "builtIn" as const, field })),
    ...snapshot.customFields
      .filter((field) => field.isVisible === isVisible)
      .map((field) => ({ kind: "custom" as const, field }))
  ]);
}

function getFieldTypeLabel(entry: FieldEntry) {
  const type = entry.kind === "builtIn" ? entry.field.control : entry.field.type;
  const optionCount = entry.field.options.length;

  if (type === "textarea") {
    return "long text";
  }

  if (type === "select") {
    return optionCount > 0 ? `dropdown (${optionCount} options)` : "dropdown";
  }

  return type;
}

function buildModulePayload(snapshot: OfficeFieldModuleSettingsSnapshot) {
  return {
    module: snapshot.module,
    contactRoleSettings:
      snapshot.module === "transaction"
        ? snapshot.requiredContactRoles.map((role) => ({
            role: role.role,
            isRequired: role.isRequired
          }))
        : undefined,
    builtInFieldSettings: snapshot.builtInFields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      isRequired: field.isRequired,
      isVisible: field.isVisible,
      sortOrder: field.sortOrder,
      selectOptions:
        field.control === "select"
          ? field.selectOptions.map((option) => ({
              value: option.value,
              label: option.label,
              isEnabled: option.isEnabled
            }))
          : undefined
    })),
    customFieldDefinitions: snapshot.customFields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      type: field.type,
      isRequired: field.isRequired,
      isVisible: field.isVisible,
      isDeletionLocked: field.isDeletionLocked,
      sortOrder: field.sortOrder,
      options: field.options
    }))
  };
}

function parseOptionsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((option) => option.trim())
        .filter(Boolean)
    )
  );
}

function buildEditorStateFromField(entry: FieldEntry): FieldEditorState {
  const fieldType = entry.kind === "builtIn" ? entry.field.control : entry.field.type;

  return {
    mode: "edit",
    kind: entry.kind,
    fieldKey: entry.field.fieldKey,
    label: entry.field.label,
    type: fieldType,
    isRequired: entry.field.isRequired,
    isVisible: entry.field.isVisible,
    isDeletionLocked: entry.kind === "custom" ? entry.field.isDeletionLocked : false,
    isLockedRequired: entry.kind === "builtIn" ? entry.field.isLockedRequired : false,
    isLockedVisible: entry.kind === "builtIn" ? entry.field.isLockedVisible : false,
    isLockedDeletion: entry.kind === "custom" ? entry.field.isLockedDeletion : true,
    sortOrder: entry.field.sortOrder,
    optionsText:
      entry.kind === "custom" && entry.field.type === "select"
        ? entry.field.options.join("\n")
        : "",
    selectOptions:
      entry.kind === "builtIn" && entry.field.control === "select"
        ? entry.field.selectOptions.map((option) => ({ ...option }))
        : []
  };
}

function buildCreateEditorState(module: OfficeFieldModule, sortOrder: number): FieldEditorState {
  return {
    mode: "create",
    kind: "custom",
    fieldKey: "",
    label: "",
    type: module === "transaction" ? "text" : "text",
    isRequired: false,
    isVisible: true,
    isDeletionLocked: false,
    isLockedRequired: false,
    isLockedVisible: false,
    isLockedDeletion: false,
    sortOrder,
    optionsText: "",
    selectOptions: []
  };
}

function buildSummaryRecord(snapshot: OfficeFieldModuleSettingsSnapshot) {
  return {
    module: snapshot.module,
    label: snapshot.label,
    description: snapshot.description,
    fieldCount: snapshot.summary.fieldCount,
    customFieldCount: snapshot.summary.customFieldCount,
    hiddenFieldCount: snapshot.summary.hiddenFieldCount
  };
}

export function OfficeSettingsFieldsClient({
  snapshot,
  canManageFields,
  hideModuleRail = false,
  panelDescription,
  panelTitle,
  onModuleSnapshotChange
}: OfficeSettingsFieldsClientProps) {
  const pathname = usePathname();
  const [currentModule, setCurrentModule] = useState(snapshot.currentModule);
  const [modules, setModules] = useState(snapshot.modules);
  const [pendingAction, setPendingAction] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [editorState, setEditorState] = useState<FieldEditorState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [draggingFieldKey, setDraggingFieldKey] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<DragOverState | null>(null);

  useEffect(() => {
    setCurrentModule(snapshot.currentModule);
    setModules(snapshot.modules);
    setEditorState(null);
    setSubmitError("");
    setSubmitSuccess("");
  }, [snapshot]);

  const visibleEntries = buildFieldEntries(currentModule, true);
  const hiddenEntries = buildFieldEntries(currentModule, false);

  function applyModuleSnapshot(nextModule: OfficeFieldModuleSettingsSnapshot) {
    setCurrentModule(nextModule);
    setModules((current) =>
      current.map((entry) =>
        entry.module === nextModule.module ? buildSummaryRecord(nextModule) : entry
      )
    );
    setDraggingFieldKey(null);
    setDragOverState(null);
    onModuleSnapshotChange?.(nextModule);
  }

  function resetDragState() {
    setDraggingFieldKey(null);
    setDragOverState(null);
  }

  async function persistModuleSnapshot(
    nextModule: OfficeFieldModuleSettingsSnapshot,
    successMessage: string
  ) {
    setPendingAction(`save:${nextModule.module}`);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/fields", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildModulePayload(nextModule))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save field settings.");
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setSubmitSuccess(successMessage);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save field settings."
      );
    } finally {
      setPendingAction("");
    }
  }

  async function handleRoleToggle(role: string, isRequired: boolean) {
    const nextModule = {
      ...currentModule,
      requiredContactRoles: currentModule.requiredContactRoles.map((entry) =>
        entry.role === role ? { ...entry, isRequired } : entry
      )
    };

    await persistModuleSnapshot(nextModule, "Required contact roles updated.");
  }

  function openCreateModal() {
    const highestSortOrder = Math.max(
      -1,
      ...currentModule.builtInFields.map((field) => field.sortOrder),
      ...currentModule.customFields.map((field) => field.sortOrder)
    );
    setEditorState(buildCreateEditorState(currentModule.module, highestSortOrder + 1));
  }

  function openEditModal(entry: FieldEntry) {
    setEditorState(buildEditorStateFromField(entry));
  }

  function updateEditor(partial: Partial<FieldEditorState>) {
    setEditorState((current) => (current ? { ...current, ...partial } : current));
  }

  function updateEditorSelectOption(
    value: string,
    field: "label" | "isEnabled",
    nextValue: string | boolean
  ) {
    setEditorState((current) =>
      current
        ? {
            ...current,
            selectOptions: current.selectOptions.map((option) =>
              option.value === value ? { ...option, [field]: nextValue } : option
            )
          }
        : current
    );
  }

  async function handleDeleteField(entry: FieldEntry) {
    if (entry.kind === "builtIn") {
      if (entry.field.isLockedVisible) {
        return;
      }

      const nextModule = {
        ...currentModule,
        builtInFields: currentModule.builtInFields.map((field) =>
          field.fieldKey === entry.field.fieldKey
            ? { ...field, isVisible: false }
            : field
        )
      };
      await persistModuleSnapshot(nextModule, `${entry.field.label} hidden.`);
      return;
    }

    if (entry.field.isDeletionLocked) {
      return;
    }

    setPendingAction(`delete:${entry.field.fieldKey}`);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch(
        `/api/office/settings/fields/custom/${entry.field.fieldKey}?module=${currentModule.module}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete custom field.");
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setSubmitSuccess(`${entry.field.label} deleted.`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to delete custom field."
      );
    } finally {
      setPendingAction("");
    }
  }

  async function handleHideField(entry: FieldEntry) {
    if (entry.kind === "builtIn") {
      if (entry.field.isLockedVisible) {
        return;
      }

      const nextModule = {
        ...currentModule,
        builtInFields: currentModule.builtInFields.map((field) =>
          field.fieldKey === entry.field.fieldKey
            ? { ...field, isVisible: false }
            : field
        )
      };
      await persistModuleSnapshot(nextModule, `${entry.field.label} hidden.`);
      return;
    }

    setPendingAction(`hide:${entry.field.fieldKey}`);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch(
        `/api/office/settings/fields/custom/${entry.field.fieldKey}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            module: currentModule.module,
            isVisible: false
          })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to hide field.");
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setSubmitSuccess(`${entry.field.label} hidden.`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to hide field.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleRestoreField(entry: FieldEntry) {
    if (entry.kind === "builtIn") {
      const nextModule = {
        ...currentModule,
        builtInFields: currentModule.builtInFields.map((field) =>
          field.fieldKey === entry.field.fieldKey
            ? { ...field, isVisible: true }
            : field
        )
      };
      await persistModuleSnapshot(nextModule, `${entry.field.label} restored.`);
      return;
    }

    setPendingAction(`restore:${entry.field.fieldKey}`);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch(
        `/api/office/settings/fields/custom/${entry.field.fieldKey}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            module: currentModule.module,
            isVisible: true
          })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to restore field.");
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setSubmitSuccess(`${entry.field.label} restored.`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to restore field.");
    } finally {
      setPendingAction("");
    }
  }

  async function persistVisibleFieldOrder(nextVisibleEntries: FieldEntry[]) {
    setPendingAction("reorder:visible-fields");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/fields/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          module: currentModule.module,
          fieldOrder: [...nextVisibleEntries, ...hiddenEntries].map((entry) => ({
            kind: entry.kind,
            fieldKey: entry.field.fieldKey
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to reorder fields.");
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setSubmitSuccess("Field order updated.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to reorder fields.");
    } finally {
      setPendingAction("");
    }
  }

  function buildNextVisibleEntryOrder(
    draggedFieldKey: string,
    targetFieldKey: string,
    position: "before" | "after"
  ) {
    const nextVisibleEntries = [...visibleEntries];
    const draggedIndex = nextVisibleEntries.findIndex(
      (entry) => entry.field.fieldKey === draggedFieldKey
    );
    const targetIndex = nextVisibleEntries.findIndex(
      (entry) => entry.field.fieldKey === targetFieldKey
    );

    if (draggedIndex < 0 || targetIndex < 0 || draggedFieldKey === targetFieldKey) {
      return null;
    }

    const [draggedEntry] = nextVisibleEntries.splice(draggedIndex, 1);
    const nextTargetIndex = nextVisibleEntries.findIndex(
      (entry) => entry.field.fieldKey === targetFieldKey
    );

    if (nextTargetIndex < 0) {
      return null;
    }

    const insertionIndex = position === "before" ? nextTargetIndex : nextTargetIndex + 1;
    nextVisibleEntries.splice(insertionIndex, 0, draggedEntry);

    const isSameOrder = nextVisibleEntries.every(
      (entry, index) => entry.field.fieldKey === visibleEntries[index]?.field.fieldKey
    );

    return isSameOrder ? null : nextVisibleEntries;
  }

  function getDragPosition(event: DragEvent<HTMLElement>): "before" | "after" {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  function handleFieldDragStart(event: DragEvent<HTMLButtonElement>, fieldKey: string) {
    if (pendingAction.startsWith("reorder:")) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fieldKey);
    setDraggingFieldKey(fieldKey);
    setDragOverState(null);
  }

  function handleFieldDragOver(event: DragEvent<HTMLElement>, targetFieldKey: string) {
    if (!draggingFieldKey || pendingAction.startsWith("reorder:")) {
      return;
    }

    event.preventDefault();

    if (draggingFieldKey === targetFieldKey) {
      if (dragOverState) {
        setDragOverState(null);
      }
      return;
    }

    const position = getDragPosition(event);
    event.dataTransfer.dropEffect = "move";
    setDragOverState((current) =>
      current?.fieldKey === targetFieldKey && current.position === position
        ? current
        : { fieldKey: targetFieldKey, position }
    );
  }

  async function handleFieldDrop(event: DragEvent<HTMLElement>, targetFieldKey: string) {
    if (!draggingFieldKey || pendingAction.startsWith("reorder:")) {
      resetDragState();
      return;
    }

    event.preventDefault();
    const position =
      dragOverState?.fieldKey === targetFieldKey
        ? dragOverState.position
        : getDragPosition(event);
    const nextVisibleEntries = buildNextVisibleEntryOrder(
      draggingFieldKey,
      targetFieldKey,
      position
    );

    resetDragState();

    if (!nextVisibleEntries) {
      return;
    }

    await persistVisibleFieldOrder(nextVisibleEntries);
  }

  async function handleEditorSave() {
    if (!editorState) {
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");

    if (editorState.kind === "builtIn") {
      const nextModule = {
        ...currentModule,
        builtInFields: currentModule.builtInFields.map((field) =>
          field.fieldKey === editorState.fieldKey
            ? {
                ...field,
                label: editorState.label,
                isRequired: editorState.isLockedRequired ? field.isRequired : editorState.isRequired,
                isVisible: editorState.isLockedVisible ? field.isVisible : editorState.isVisible,
                selectOptions:
                  field.control === "select"
                    ? editorState.selectOptions.map((option) => ({ ...option }))
                    : field.selectOptions,
                options:
                  field.control === "select"
                    ? editorState.selectOptions
                        .filter((option) => option.isEnabled)
                        .map((option) => option.value)
                    : field.options
              }
            : field
        )
      };

      await persistModuleSnapshot(nextModule, `${editorState.label} updated.`);
      setEditorState(null);
      return;
    }

    const options =
      editorState.type === "select" ? parseOptionsText(editorState.optionsText) : [];
    const requestBody = {
      module: currentModule.module,
      label: editorState.label,
      type: editorState.type,
      isRequired: editorState.isRequired,
      isVisible: editorState.isVisible,
      isDeletionLocked: editorState.isDeletionLocked,
      sortOrder: editorState.sortOrder,
      options
    };

    setPendingAction(
      editorState.mode === "create"
        ? `create:${currentModule.module}`
        : `update:${editorState.fieldKey}`
    );

    try {
      const response = await fetch(
        editorState.mode === "create"
          ? "/api/office/settings/fields/custom"
          : `/api/office/settings/fields/custom/${editorState.fieldKey}`,
        {
          method: editorState.mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ??
            (editorState.mode === "create"
              ? "Failed to create custom field."
              : "Failed to update custom field.")
        );
      }

      const body = (await response.json()) as {
        snapshot: OfficeFieldModuleSettingsSnapshot;
      };
      applyModuleSnapshot(body.snapshot);
      setEditorState(null);
      setSubmitSuccess(
        editorState.mode === "create"
          ? "Custom field added."
          : `${editorState.label} updated.`
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : editorState.mode === "create"
            ? "Failed to create custom field."
            : "Failed to update custom field."
      );
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div className="office-fields-shell">
      {hideModuleRail ? null : (
        <aside className="office-fields-module-rail">
          <div className="office-fields-module-rail-head">
            <span>Lists & templates</span>
            <strong>Field modules</strong>
          </div>
          <div className="office-fields-module-list">
            {modules.map((module) => {
              const isActive = module.module === currentModule.module;
              return (
                <Link
                  className={`office-fields-module-link${isActive ? " is-active" : ""}`}
                  href={`${pathname}?module=${module.module}`}
                  key={module.module}
                >
                  <div>
                    <strong>{module.label}</strong>
                    <p>{module.fieldCount} fields</p>
                  </div>
                  <span>{module.hiddenFieldCount} hidden</span>
                </Link>
              );
            })}
          </div>
        </aside>
      )}

      <section className="office-fields-panel">
        <div className="office-fields-panel-head">
          <div>
            <h2>{panelTitle ?? currentModule.label}</h2>
            <p>{panelDescription ?? currentModule.description}</p>
          </div>
          {canManageFields ? (
            <Button onClick={openCreateModal} type="button">
              Add field
            </Button>
          ) : null}
        </div>

        {submitError ? <p className="office-inline-error">{submitError}</p> : null}
        {submitSuccess ? <p className="office-inline-success">{submitSuccess}</p> : null}

        <div className="office-fields-list">
          {visibleEntries.map((entry) => (
            <article
              className={`office-fields-row${
                draggingFieldKey === entry.field.fieldKey ? " is-drag-source" : ""
              }${
                dragOverState?.fieldKey === entry.field.fieldKey
                  ? dragOverState.position === "before"
                    ? " is-drag-over-before"
                    : " is-drag-over-after"
                  : ""
              }`}
              key={`${entry.kind}:${entry.field.fieldKey}`}
              onDragOver={(event) => handleFieldDragOver(event, entry.field.fieldKey)}
              onDrop={(event) => {
                void handleFieldDrop(event, entry.field.fieldKey);
              }}
            >
              {canManageFields ? (
                <button
                  aria-label={`Drag ${entry.field.label} to reorder`}
                  className="office-fields-row-handle"
                  disabled={pendingAction.startsWith("reorder:")}
                  draggable={!pendingAction.startsWith("reorder:")}
                  onDragEnd={resetDragState}
                  onDragStart={(event) => handleFieldDragStart(event, entry.field.fieldKey)}
                  type="button"
                >
                  <span aria-hidden="true" className="office-fields-row-grip">
                    ≡
                  </span>
                </button>
              ) : (
                <span aria-hidden="true" className="office-fields-row-handle is-static">
                  <span className="office-fields-row-grip">≡</span>
                </span>
              )}

              <button
                className="office-fields-row-main"
                onClick={() => openEditModal(entry)}
                type="button"
              >
                <div className="office-fields-row-copy">
                  <strong>{entry.field.label}</strong>
                  <p>{entry.kind === "custom" ? "Custom field" : "Built-in field"}</p>
                </div>
                <span className="office-fields-row-type">{getFieldTypeLabel(entry)}</span>
                <span className="office-fields-row-state">
                  {entry.field.isRequired ? "Required" : "Optional"}
                </span>
              </button>

              {canManageFields ? (
                <div className="office-fields-row-actions">
                  <button
                    aria-label={`Edit ${entry.field.label}`}
                    className="office-fields-row-action"
                    onClick={() => openEditModal(entry)}
                    type="button"
                  >
                    Edit
                  </button>
                  {entry.kind === "custom" ? (
                    <button
                      aria-label={`Hide ${entry.field.label}`}
                      className="office-fields-row-action"
                      disabled={pendingAction.length > 0}
                      onClick={() =>
                        setConfirmDialog({
                          title: `Hide ${entry.field.label}?`,
                          description:
                            "This custom field will be hidden from active module forms and can still be restored later from Hidden fields.",
                          confirmLabel: "Hide field",
                          onConfirm: () => {
                            void handleHideField(entry);
                          }
                        })
                      }
                      type="button"
                    >
                      Hide
                    </button>
                  ) : null}
                  <button
                    aria-label={entry.kind === "builtIn" ? `Hide ${entry.field.label}` : `Delete ${entry.field.label}`}
                    className="office-fields-row-action is-danger"
                    disabled={
                      pendingAction.length > 0 ||
                      (entry.kind === "builtIn" && entry.field.isLockedVisible) ||
                      (entry.kind === "custom" && entry.field.isDeletionLocked)
                    }
                    title={
                      entry.kind === "custom" && entry.field.isDeletionLocked
                        ? `${entry.field.label} is protected from deletion.`
                        : undefined
                    }
                    onClick={() =>
                      setConfirmDialog({
                        title:
                          entry.kind === "builtIn"
                            ? `Hide ${entry.field.label}?`
                            : `Delete ${entry.field.label}?`,
                        description:
                          entry.kind === "builtIn"
                            ? "This built-in field will be hidden from the module forms and can still be restored later from Hidden fields."
                            : "This custom field will be permanently deleted only if no saved records still use it. If you just want to stop showing it, use Hide instead.",
                        confirmLabel: entry.kind === "builtIn" ? "Hide field" : "Delete field",
                        onConfirm: () => {
                          void handleDeleteField(entry);
                        }
                      })
                    }
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </article>
          ))}

          {visibleEntries.length === 0 ? (
            <div className="office-fields-empty">
              <strong>No visible fields</strong>
              <p>Restore hidden fields or add a new custom field for this module.</p>
            </div>
          ) : null}
        </div>

        {hiddenEntries.length ? (
          <section className="office-fields-hidden">
            <div className="office-fields-section-head">
              <div>
                <h3>Hidden fields</h3>
                <p>Restore fields without leaving the centralized fields workspace.</p>
              </div>
            </div>
            <div className="office-fields-hidden-list">
              {hiddenEntries.map((entry) => (
                <article className="office-fields-hidden-row" key={`hidden:${entry.kind}:${entry.field.fieldKey}`}>
                  <div>
                    <strong>{entry.field.label}</strong>
                    <p>
                      {entry.kind === "custom" ? "Custom field" : "Built-in field"} ·{" "}
                      {getFieldTypeLabel(entry)}
                    </p>
                  </div>
                  <Button
                    disabled={pendingAction.length > 0}
                    onClick={() => handleRestoreField(entry)}
                    type="button"
                    variant="secondary"
                  >
                    Restore
                  </Button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {currentModule.module === "transaction" ? (
          <section className="office-fields-roles">
            <div className="office-fields-section-head">
              <div>
                <h3>Required contact roles</h3>
                <p>These roles remain transaction-only workflow requirements.</p>
              </div>
            </div>
            <div className="office-settings-checkbox-grid">
              {currentModule.requiredContactRoles.map((entry: OfficeRequiredContactRoleRecord) => (
                <CheckboxField className="office-settings-checkbox-item" key={entry.role} label={entry.label}>
                  <input
                    checked={entry.isRequired}
                    disabled={!canManageFields || pendingAction.length > 0}
                    onChange={(event) =>
                      handleRoleToggle(entry.role, event.target.checked)
                    }
                    type="checkbox"
                  />
                </CheckboxField>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <ConfirmActionDialog
        cancelLabel="Cancel"
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

      {editorState ? (
        <div className="bm-modal-overlay" onClick={() => setEditorState(null)}>
          <section
            className="office-fields-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="office-fields-modal-head">
              <div>
                <h3>
                  {editorState.mode === "create" ? "Add field" : editorState.label}
                </h3>
                <p>
                  {editorState.kind === "builtIn"
                    ? "Built-in field settings"
                    : "Custom field settings"}
                </p>
              </div>
              <button
                aria-label="Close field editor"
                className="office-fields-modal-close"
                onClick={() => setEditorState(null)}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="office-fields-modal-body">
              <label className="office-fields-modal-field">
                <span>Field label</span>
                <TextInput
                  onChange={(event) => updateEditor({ label: event.target.value })}
                  value={editorState.label}
                />
              </label>

              <label className="office-fields-modal-field">
                <span>Field type</span>
                {editorState.kind === "builtIn" ? (
                  <TextInput
                    disabled
                    value={
                      editorState.type === "textarea"
                        ? "long text"
                        : editorState.type === "select"
                          ? "dropdown"
                          : editorState.type
                    }
                  />
                ) : (
                  <SelectInput
                    onChange={(event) =>
                      updateEditor({
                        type: event.target.value as FieldEditorState["type"]
                      })
                    }
                    value={editorState.type}
                  >
                    {customFieldTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </label>

              <CheckboxField
                className="office-fields-modal-checkbox"
                label="Required"
              >
                <input
                  checked={editorState.isRequired}
                  disabled={editorState.isLockedRequired}
                  onChange={(event) =>
                    updateEditor({ isRequired: event.target.checked })
                  }
                  type="checkbox"
                />
              </CheckboxField>

              <CheckboxField
                className="office-fields-modal-checkbox"
                label="Visible"
              >
                <input
                  checked={editorState.isVisible}
                  disabled={editorState.isLockedVisible}
                  onChange={(event) =>
                    updateEditor({ isVisible: event.target.checked })
                  }
                  type="checkbox"
                />
              </CheckboxField>

              {editorState.kind === "custom" ? (
                <CheckboxField
                  className="office-fields-modal-checkbox"
                  label="Protected from deletion"
                >
                  <input
                    checked={editorState.isDeletionLocked}
                    disabled={editorState.isLockedDeletion}
                    onChange={(event) =>
                      updateEditor({ isDeletionLocked: event.target.checked })
                    }
                    type="checkbox"
                  />
                </CheckboxField>
              ) : null}

              {editorState.kind === "custom" && editorState.type === "select" ? (
                <label className="office-fields-modal-field is-full">
                  <span>Dropdown options</span>
                  <TextareaInput
                    onChange={(event) =>
                      updateEditor({ optionsText: event.target.value })
                    }
                    placeholder="One option per line"
                    rows={6}
                    value={editorState.optionsText}
                  />
                </label>
              ) : null}

              {editorState.kind === "builtIn" && editorState.type === "select" ? (
                <div className="office-fields-modal-option-list">
                  <div className="office-fields-modal-option-head">
                    <span>Enabled</span>
                    <span>Display label</span>
                  </div>
                  {editorState.selectOptions.map((option) => (
                    <div className="office-fields-modal-option-row" key={option.value}>
                      <label className="office-fields-option-toggle">
                        <input
                          checked={option.isEnabled}
                          onChange={(event) =>
                            updateEditorSelectOption(
                              option.value,
                              "isEnabled",
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                        <span>{option.value}</span>
                      </label>
                      <TextInput
                        onChange={(event) =>
                          updateEditorSelectOption(
                            option.value,
                            "label",
                            event.target.value
                          )
                        }
                        value={option.label}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="office-fields-modal-footer">
              <Button
                onClick={() => setEditorState(null)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={pendingAction.length > 0}
                onClick={handleEditorSave}
                type="button"
              >
                {pendingAction.length > 0 ? "Saving..." : editorState.mode === "create" ? "Add field" : "Save changes"}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
