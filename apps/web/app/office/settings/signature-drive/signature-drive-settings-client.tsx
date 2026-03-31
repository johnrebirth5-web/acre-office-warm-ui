"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, CheckboxField, ConfirmActionDialog, FormField, SectionCard, StatusBadge, TextInput, TextareaInput } from "@acre/ui";
import type { OfficeSignatureDriveSettingsSnapshot } from "@acre/db";

type OfficeSignatureDriveSettingsClientProps = {
  snapshot: OfficeSignatureDriveSettingsSnapshot;
  canManageSettings: boolean;
};

type FormState = {
  isEnabled: boolean;
  projectId: string;
  clientEmail: string;
  clientId: string;
  privateKeyId: string;
  privateKey: string;
  sharedDriveId: string;
  rootFolderId: string;
  hrFolderId: string;
  financeFolderId: string;
  adminFolderId: string;
  transactionFolderId: string;
  genericFolderId: string;
};

function buildFormState(snapshot: OfficeSignatureDriveSettingsSnapshot): FormState {
  return {
    isEnabled: snapshot.settings.isEnabled,
    projectId: snapshot.settings.projectId,
    clientEmail: snapshot.settings.clientEmail,
    clientId: snapshot.settings.clientId,
    privateKeyId: snapshot.settings.privateKeyId,
    privateKey: "",
    sharedDriveId: snapshot.settings.sharedDriveId,
    rootFolderId: snapshot.settings.rootFolderId,
    hrFolderId: snapshot.settings.folderMappings.hr,
    financeFolderId: snapshot.settings.folderMappings.finance,
    adminFolderId: snapshot.settings.folderMappings.admin,
    transactionFolderId: snapshot.settings.folderMappings.transaction,
    genericFolderId: snapshot.settings.folderMappings.generic
  };
}

export function OfficeSignatureDriveSettingsClient({
  snapshot,
  canManageSettings
}: OfficeSignatureDriveSettingsClientProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [formState, setFormState] = useState<FormState>(() => buildFormState(snapshot));
  const [pendingAction, setPendingAction] = useState<"" | "save" | "delete">("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setCurrentSnapshot(snapshot);
    setFormState(buildFormState(snapshot));
    setSubmitError("");
    setSubmitSuccess("");
  }, [snapshot]);

  function applySnapshot(nextSnapshot: OfficeSignatureDriveSettingsSnapshot, successMessage: string) {
    setCurrentSnapshot(nextSnapshot);
    setFormState(buildFormState(nextSnapshot));
    setSubmitError("");
    setSubmitSuccess(successMessage);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("save");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/signature-drive", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isEnabled: formState.isEnabled,
          projectId: formState.projectId,
          clientEmail: formState.clientEmail,
          clientId: formState.clientId,
          privateKeyId: formState.privateKeyId,
          privateKey: formState.privateKey,
          sharedDriveId: formState.sharedDriveId,
          rootFolderId: formState.rootFolderId,
          folderMappings: {
            hr: formState.hrFolderId,
            finance: formState.financeFolderId,
            admin: formState.adminFolderId,
            transaction: formState.transactionFolderId,
            generic: formState.genericFolderId
          }
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save Signature Drive settings.");
      }

      const body = (await response.json()) as { snapshot: OfficeSignatureDriveSettingsSnapshot };
      applySnapshot(body.snapshot, "Signature Drive settings saved.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save Signature Drive settings.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/signature-drive", {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to remove Signature Drive settings.");
      }

      const body = (await response.json()) as { snapshot: OfficeSignatureDriveSettingsSnapshot };
      setConfirmDelete(false);
      applySnapshot(body.snapshot, "Saved Signature Drive configuration removed.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to remove Signature Drive settings.");
    } finally {
      setPendingAction("");
    }
  }

  const privateKeyHelper =
    currentSnapshot.settings.source === "database" && currentSnapshot.settings.hasStoredPrivateKey
      ? "Leave this blank to keep the stored service-account private key."
      : "Paste the Google service-account private key exactly as generated, including the BEGIN/END markers.";

  return (
    <>
      <section className="office-settings-card-grid">
        <SectionCard subtitle="Service-account credentials and folder targets for completed signed documents." title="Google Drive configuration">
          <form className="office-settings-template-form" onSubmit={handleSave}>
            {submitError ? <p className="office-inline-error">{submitError}</p> : null}
            {submitSuccess ? <p className="office-inline-success">{submitSuccess}</p> : null}
            {!currentSnapshot.settings.encryptionReady ? (
              <p className="office-inline-error">
                Saved Drive private keys require <code>ACRE_SETTINGS_ENCRYPTION_SECRET</code> or <code>ACRE_SESSION_SECRET</code>.
              </p>
            ) : null}
            <p className="office-form-helper">
              Acre uploads completed signature artifacts directly into Google Drive with the saved service account. Use the root folder as the
              default target, then optionally override by category for HR, Finance, Admin, Transaction, and generic envelopes.
            </p>

            <div className="office-form-grid">
              <div className="office-detail-field office-detail-field-wide">
                <CheckboxField label="Enable Signature Drive sync">
                  <input
                    checked={formState.isEnabled}
                    disabled={!canManageSettings || pendingAction !== ""}
                    onChange={(event) => setFormState((current) => ({ ...current, isEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>
                <p className="office-form-helper">When enabled, Acre attempts Drive upload immediately after a signature request is completed.</p>
              </div>

              <FormField label="Project ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, projectId: event.target.value }))}
                  placeholder="google-cloud-project-id"
                  value={formState.projectId}
                />
              </FormField>

              <FormField label="Client email">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, clientEmail: event.target.value }))}
                  placeholder="service-account@project.iam.gserviceaccount.com"
                  value={formState.clientEmail}
                />
              </FormField>

              <FormField label="Client ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, clientId: event.target.value }))}
                  placeholder="Optional"
                  value={formState.clientId}
                />
              </FormField>

              <FormField label="Private key ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, privateKeyId: event.target.value }))}
                  placeholder="Optional"
                  value={formState.privateKeyId}
                />
              </FormField>

              <FormField className="office-detail-field-wide" helper={privateKeyHelper} label="Private key">
                <TextareaInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, privateKey: event.target.value }))}
                  placeholder={
                    currentSnapshot.settings.hasStoredPrivateKey
                      ? "Stored securely"
                      : "-----BEGIN PRIVATE KEY-----"
                  }
                  rows={7}
                  value={formState.privateKey}
                />
              </FormField>

              <FormField label="Shared Drive ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, sharedDriveId: event.target.value }))}
                  placeholder="Optional shared drive ID"
                  value={formState.sharedDriveId}
                />
              </FormField>

              <FormField label="Root folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, rootFolderId: event.target.value }))}
                  placeholder="Default Drive folder ID"
                  value={formState.rootFolderId}
                />
              </FormField>

              <FormField label="HR folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, hrFolderId: event.target.value }))}
                  value={formState.hrFolderId}
                />
              </FormField>

              <FormField label="Finance folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, financeFolderId: event.target.value }))}
                  value={formState.financeFolderId}
                />
              </FormField>

              <FormField label="Admin folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, adminFolderId: event.target.value }))}
                  value={formState.adminFolderId}
                />
              </FormField>

              <FormField label="Transaction folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, transactionFolderId: event.target.value }))}
                  value={formState.transactionFolderId}
                />
              </FormField>

              <FormField label="Generic folder ID">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, genericFolderId: event.target.value }))}
                  value={formState.genericFolderId}
                />
              </FormField>
            </div>

            <div className="office-settings-actions">
              <Button disabled={!canManageSettings || pendingAction !== ""} type="submit">
                {pendingAction === "save" ? "Saving..." : "Save settings"}
              </Button>
              {currentSnapshot.settings.source === "database" ? (
                <Button
                  disabled={!canManageSettings || pendingAction !== ""}
                  onClick={() => setConfirmDelete(true)}
                  type="button"
                  variant="secondary"
                >
                  Remove saved configuration
                </Button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard subtitle="Current readiness for post-signature Google Drive sync." title="Current status">
          <div className="office-settings-template-form">
            <div className="office-settings-user-inline-badges">
              <StatusBadge tone={currentSnapshot.summary.statusTone}>{currentSnapshot.summary.statusLabel}</StatusBadge>
              <StatusBadge tone="accent">{currentSnapshot.summary.configuredFolderCount} folder targets</StatusBadge>
            </div>

            <div className="office-form-grid">
              <div className="office-detail-field">
                <span>Can sync now</span>
                <strong>{currentSnapshot.summary.canSyncNow ? "Yes" : "No"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Client email</span>
                <strong>{currentSnapshot.settings.clientEmail || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Root folder</span>
                <strong>{currentSnapshot.settings.rootFolderId || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Private key stored</span>
                <strong>{currentSnapshot.settings.hasStoredPrivateKey ? "Yes" : "No"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Last updated</span>
                <strong>{currentSnapshot.settings.updatedAtLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Updated by</span>
                <strong>{currentSnapshot.settings.updatedByLabel}</strong>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <ConfirmActionDialog
        cancelLabel="Keep settings"
        confirmLabel={pendingAction === "delete" ? "Removing..." : "Remove settings"}
        description="This removes the saved Google Drive configuration from Acre. Completed signatures will stop syncing until an administrator saves a new configuration."
        isOpen={confirmDelete}
        onCancel={() => {
          if (pendingAction !== "delete") {
            setConfirmDelete(false);
          }
        }}
        onConfirm={handleDelete}
        title="Remove saved Signature Drive settings?"
      />
    </>
  );
}
