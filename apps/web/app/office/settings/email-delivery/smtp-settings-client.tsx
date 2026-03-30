"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, CheckboxField, ConfirmActionDialog, FormField, SectionCard, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeEmailDeliverySettingsSnapshot } from "@acre/db";

type OfficeEmailDeliveryClientProps = {
  snapshot: OfficeEmailDeliverySettingsSnapshot;
  canManageSettings: boolean;
};

type FormState = {
  isEnabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

function buildFormState(snapshot: OfficeEmailDeliverySettingsSnapshot): FormState {
  return {
    isEnabled: snapshot.settings.isEnabled,
    host: snapshot.settings.host,
    port: String(snapshot.settings.port || 587),
    secure: snapshot.settings.secure,
    user: snapshot.settings.user,
    password: "",
    fromEmail: snapshot.settings.fromEmail,
    fromName: snapshot.settings.fromName,
    replyTo: snapshot.settings.replyTo
  };
}

export function OfficeEmailDeliveryClient({ snapshot, canManageSettings }: OfficeEmailDeliveryClientProps) {
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

  function applySnapshot(nextSnapshot: OfficeEmailDeliverySettingsSnapshot, successMessage: string) {
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
      const response = await fetch("/api/office/settings/email-delivery", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isEnabled: formState.isEnabled,
          host: formState.host,
          port: Number(formState.port),
          secure: formState.secure,
          user: formState.user,
          password: formState.password,
          fromEmail: formState.fromEmail,
          fromName: formState.fromName,
          replyTo: formState.replyTo
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save email delivery settings.");
      }

      const body = (await response.json()) as { snapshot: OfficeEmailDeliverySettingsSnapshot };
      applySnapshot(body.snapshot, "Email delivery settings saved.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save email delivery settings.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/email-delivery", {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to remove email delivery settings.");
      }

      const body = (await response.json()) as { snapshot: OfficeEmailDeliverySettingsSnapshot };
      setConfirmDelete(false);
      applySnapshot(body.snapshot, "Saved system email delivery settings removed.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to remove email delivery settings.");
    } finally {
      setPendingAction("");
    }
  }

  const passwordHelper =
    currentSnapshot.settings.source === "database" && currentSnapshot.settings.hasStoredPassword
      ? "Leave this blank to keep the currently stored SMTP password."
      : currentSnapshot.settings.source === "environment"
        ? "Environment fallback is active. Enter the SMTP password to save these settings into Acre."
        : "Password is required before signature email delivery can be enabled.";

  return (
    <>
      <section className="office-settings-card-grid">
        <SectionCard subtitle="Administrator-managed SMTP settings for outgoing signature requests." title="SMTP configuration">
          <form className="office-settings-template-form" onSubmit={handleSave}>
            {submitError ? <p className="office-inline-error">{submitError}</p> : null}
            {submitSuccess ? <p className="office-inline-success">{submitSuccess}</p> : null}
            {!currentSnapshot.settings.encryptionReady ? (
              <p className="office-inline-error">
                Saved SMTP passwords require <code>ACRE_SETTINGS_ENCRYPTION_SECRET</code> or <code>ACRE_SESSION_SECRET</code>.
              </p>
            ) : null}

            <div className="office-form-grid">
              <div className="office-detail-field office-detail-field-wide">
                <CheckboxField label="Enable signature email delivery">
                  <input
                    checked={formState.isEnabled}
                    disabled={!canManageSettings || pendingAction !== ""}
                    onChange={(event) => setFormState((current) => ({ ...current, isEnabled: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>
                <p className="office-form-helper">When disabled, Acre keeps the configuration but will not send signature request emails.</p>
              </div>

              <FormField label="SMTP host">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, host: event.target.value }))}
                  placeholder="smtp.example.com"
                  value={formState.host}
                />
              </FormField>

              <FormField label="SMTP port">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  inputMode="numeric"
                  onChange={(event) => setFormState((current) => ({ ...current, port: event.target.value }))}
                  placeholder="587"
                  value={formState.port}
                />
              </FormField>

              <div className="office-detail-field">
                <CheckboxField label="Secure transport (SSL/TLS)">
                  <input
                    checked={formState.secure}
                    disabled={!canManageSettings || pendingAction !== ""}
                    onChange={(event) => setFormState((current) => ({ ...current, secure: event.target.checked }))}
                    type="checkbox"
                  />
                </CheckboxField>
                <p className="office-form-helper">Usually enabled for port 465 and disabled for port 587.</p>
              </div>

              <FormField label="SMTP username">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, user: event.target.value }))}
                  placeholder="postmaster@example.com"
                  value={formState.user}
                />
              </FormField>

              <FormField label="SMTP password" helper={passwordHelper}>
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                  placeholder={
                    currentSnapshot.settings.source === "database" && currentSnapshot.settings.hasStoredPassword
                      ? "Stored securely"
                      : "Enter SMTP password"
                  }
                  type="password"
                  value={formState.password}
                />
              </FormField>

              <FormField label="Sender email">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, fromEmail: event.target.value }))}
                  placeholder="signatures@example.com"
                  value={formState.fromEmail}
                />
              </FormField>

              <FormField label="Sender name">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, fromName: event.target.value }))}
                  placeholder="Acre Signatures"
                  value={formState.fromName}
                />
              </FormField>

              <FormField className="office-detail-field-wide" label="Reply-to email" helper="Optional. Leave blank to use the sender-level reply-to when a request does not provide one.">
                <TextInput
                  disabled={!canManageSettings || pendingAction !== ""}
                  onChange={(event) => setFormState((current) => ({ ...current, replyTo: event.target.value }))}
                  placeholder="operations@example.com"
                  value={formState.replyTo}
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

        <SectionCard subtitle="What Acre is currently using to send signature emails." title="Current status">
          <div className="office-settings-template-form">
            <div className="office-settings-user-inline-badges">
              <StatusBadge tone={currentSnapshot.summary.sourceTone}>{currentSnapshot.summary.sourceLabel}</StatusBadge>
              <StatusBadge tone={currentSnapshot.summary.statusTone}>{currentSnapshot.summary.statusLabel}</StatusBadge>
            </div>

            <div className="office-form-grid">
              <div className="office-detail-field">
                <span>Can send now</span>
                <strong>{currentSnapshot.summary.canSendSignatureEmails ? "Yes" : "No"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Active host</span>
                <strong>{currentSnapshot.settings.host || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Sender email</span>
                <strong>{currentSnapshot.settings.fromEmail || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Password available</span>
                <strong>{currentSnapshot.settings.hasStoredPassword ? "Yes" : "No"}</strong>
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

            {currentSnapshot.settings.source === "environment" ? (
              <p className="office-form-helper">
                Acre is currently using environment variables as a fallback. Save this form to move delivery settings into the system database.
              </p>
            ) : null}

            {currentSnapshot.settings.source === "database" && currentSnapshot.environmentFallback.isReady ? (
              <p className="office-form-helper">
                Environment fallback is available, but Acre will prefer the saved system configuration until it is removed.
              </p>
            ) : null}

            {currentSnapshot.settings.source === "none" ? (
              <p className="office-form-helper">
                No SMTP configuration is available yet. Signature request emails will fail until an administrator saves valid settings here.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <ConfirmActionDialog
        cancelLabel="Keep settings"
        confirmLabel={pendingAction === "delete" ? "Removing..." : "Remove settings"}
        description="This removes the saved SMTP configuration from Acre. If environment fallback is configured, signature emails will use that instead."
        isOpen={confirmDelete}
        onCancel={() => {
          if (pendingAction !== "delete") {
            setConfirmDelete(false);
          }
        }}
        onConfirm={handleDelete}
        title="Remove saved email delivery settings?"
      />
    </>
  );
}
