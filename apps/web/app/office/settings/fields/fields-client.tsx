"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, CheckboxField, DataTable, DataTableBody, DataTableHeader, DataTableRow, ListPageFooter, ListPageSection, ListPageStack, ListPageTableSection } from "@acre/ui";
import type { OfficeFieldSettingsSnapshot } from "@acre/db";

type OfficeSettingsFieldsClientProps = {
  snapshot: OfficeFieldSettingsSnapshot;
  canManageFields: boolean;
};

type RoleState = Record<string, boolean>;
type FieldState = Record<string, { isRequired: boolean; isVisible: boolean }>;
type CustomFieldState = Record<string, { isRequired: boolean; isVisible: boolean }>;

export function OfficeSettingsFieldsClient({ snapshot, canManageFields }: OfficeSettingsFieldsClientProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [roleState, setRoleState] = useState<RoleState>(
    Object.fromEntries(snapshot.contactRoleSettings.map((entry) => [entry.role, entry.isRequired]))
  );
  const [fieldState, setFieldState] = useState<FieldState>(
    Object.fromEntries(
      snapshot.transactionFieldSettings.map((entry) => [
        entry.fieldKey,
        {
          isRequired: entry.isRequired,
          isVisible: entry.isVisible
        }
      ])
    )
  );
  const [customFieldState, setCustomFieldState] = useState<CustomFieldState>(
    Object.fromEntries(
      snapshot.transactionCustomFieldDefinitions.map((entry) => [
        entry.fieldKey,
        {
          isRequired: entry.isRequired,
          isVisible: entry.isVisible
        }
      ])
    )
  );

  useEffect(() => {
    setRoleState(Object.fromEntries(snapshot.contactRoleSettings.map((entry) => [entry.role, entry.isRequired])));
    setFieldState(
      Object.fromEntries(
        snapshot.transactionFieldSettings.map((entry) => [
          entry.fieldKey,
          {
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        ])
      )
    );
    setCustomFieldState(
      Object.fromEntries(
        snapshot.transactionCustomFieldDefinitions.map((entry) => [
          entry.fieldKey,
          {
            isRequired: entry.isRequired,
            isVisible: entry.isVisible
          }
        ])
      )
    );
  }, [snapshot]);

  function setFieldValue(fieldKey: string, field: "isRequired" | "isVisible", value: boolean) {
    setFieldState((current) => ({
      ...current,
      [fieldKey]: {
        ...(current[fieldKey] ?? { isRequired: false, isVisible: true }),
        [field]: value
      }
    }));
  }

  function setCustomFieldValue(fieldKey: string, field: "isRequired" | "isVisible", value: boolean) {
    setCustomFieldState((current) => ({
      ...current,
      [fieldKey]: {
        ...(current[fieldKey] ?? { isRequired: false, isVisible: true }),
        [field]: value
      }
    }));
  }

  async function handleSave() {
    setPendingAction(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/office/settings/fields", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contactRoleSettings: snapshot.contactRoleSettings.map((entry) => ({
            role: entry.role,
            isRequired: roleState[entry.role] ?? false
          })),
          transactionFieldSettings: snapshot.transactionFieldSettings.map((entry) => ({
            fieldKey: entry.fieldKey,
            isRequired: fieldState[entry.fieldKey]?.isRequired ?? false,
            isVisible: fieldState[entry.fieldKey]?.isVisible ?? true
          })),
          transactionCustomFieldDefinitions: snapshot.transactionCustomFieldDefinitions.map((entry) => ({
            fieldKey: entry.fieldKey,
            label: entry.label,
            type: entry.type,
            isRequired: customFieldState[entry.fieldKey]?.isRequired ?? false,
            isVisible: customFieldState[entry.fieldKey]?.isVisible ?? true,
            sortOrder: entry.sortOrder,
            options: entry.options
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save field settings.");
      }

      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save field settings.");
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <ListPageStack>
      {submitError ? <p className="office-inline-error">{submitError}</p> : null}

      <ListPageSection subtitle="These roles are required for the office workflow before a transaction is considered fully staffed." title="Required contact roles">
        <div className="office-settings-checkbox-grid">
          {snapshot.contactRoleSettings.map((entry) => (
            <CheckboxField className="office-settings-checkbox-item" key={entry.role} label={entry.label}>
              <input
                checked={roleState[entry.role] ?? false}
                disabled={!canManageFields}
                onChange={(event) => setRoleState((current) => ({ ...current, [entry.role]: event.target.checked }))}
                type="checkbox"
              />
            </CheckboxField>
          ))}
        </div>
      </ListPageSection>

      <ListPageTableSection
        footer={<ListPageFooter summary={`${snapshot.transactionFieldSettings.length} configurable transaction fields`} />}
        subtitle="Control which transaction fields stay visible and which are enforced as required in Back Office."
        title="Transaction field behavior"
      >
        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-fields">
            <span>Field</span>
            <span>Visible</span>
            <span>Required</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.transactionFieldSettings.map((entry) => (
              <DataTableRow className="office-table-row office-table-row-settings-fields" key={entry.fieldKey}>
                <strong>{entry.label}</strong>
                <CheckboxField label="Visible">
                  <input
                    checked={fieldState[entry.fieldKey]?.isVisible ?? true}
                    disabled={!canManageFields}
                    onChange={(event) => setFieldValue(entry.fieldKey, "isVisible", event.target.checked)}
                    type="checkbox"
                  />
                </CheckboxField>
                <CheckboxField label="Required">
                  <input
                    checked={fieldState[entry.fieldKey]?.isRequired ?? false}
                    disabled={!canManageFields}
                    onChange={(event) => setFieldValue(entry.fieldKey, "isRequired", event.target.checked)}
                    type="checkbox"
                  />
                </CheckboxField>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>

        {canManageFields ? (
          <div className="office-settings-actions">
            <Button disabled={pendingAction} onClick={handleSave} variant="secondary">
              {pendingAction ? "Saving..." : "Save field settings"}
            </Button>
          </div>
        ) : null}
      </ListPageTableSection>

      <ListPageTableSection
        footer={<ListPageFooter summary={`${snapshot.transactionCustomFieldDefinitions.length} configurable custom fields`} />}
        subtitle="Custom transaction fields are created from the transaction intake editor and can still be reviewed here for visibility and requiredness."
        title="Custom transaction fields"
      >
        <DataTable className="office-table">
          <DataTableHeader className="office-table-header office-table-row office-table-row-settings-fields">
            <span>Field</span>
            <span>Visible</span>
            <span>Required</span>
          </DataTableHeader>
          <DataTableBody>
            {snapshot.transactionCustomFieldDefinitions.map((entry) => (
              <DataTableRow className="office-table-row office-table-row-settings-fields" key={entry.fieldKey}>
                <strong>{entry.label}</strong>
                <CheckboxField label="Visible">
                  <input
                    checked={customFieldState[entry.fieldKey]?.isVisible ?? true}
                    disabled={!canManageFields}
                    onChange={(event) => setCustomFieldValue(entry.fieldKey, "isVisible", event.target.checked)}
                    type="checkbox"
                  />
                </CheckboxField>
                <CheckboxField label="Required">
                  <input
                    checked={customFieldState[entry.fieldKey]?.isRequired ?? false}
                    disabled={!canManageFields}
                    onChange={(event) => setCustomFieldValue(entry.fieldKey, "isRequired", event.target.checked)}
                    type="checkbox"
                  />
                </CheckboxField>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </ListPageStack>
  );
}
