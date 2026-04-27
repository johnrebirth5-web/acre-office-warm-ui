"use client";

import { useEffect, useState } from "react";
import { Button, ConfirmActionDialog, SectionCard, StatusBadge } from "@acre/ui";
import type { OfficeQuickBooksSettingsSnapshot } from "@acre/db";

type QuickBooksFlashMessage = {
  tone: "success" | "error";
  message: string;
} | null;

type OfficeQuickBooksSettingsClientProps = {
  snapshot: OfficeQuickBooksSettingsSnapshot;
  canManageSettings: boolean;
  flashMessage: QuickBooksFlashMessage;
};

export function OfficeQuickBooksSettingsClient({
  snapshot,
  canManageSettings,
  flashMessage
}: OfficeQuickBooksSettingsClientProps) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [pendingAction, setPendingAction] = useState<"" | "validate" | "disconnect">("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    setCurrentSnapshot(snapshot);
    setSubmitError("");
    setSubmitSuccess(flashMessage?.tone === "success" ? flashMessage.message : "");
  }, [snapshot, flashMessage]);

  useEffect(() => {
    if (flashMessage?.tone === "error") {
      setSubmitError(flashMessage.message);
      setSubmitSuccess("");
    }
  }, [flashMessage]);

  async function handleValidate() {
    setPendingAction("validate");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/quickbooks/validate", {
        method: "POST"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to validate QuickBooks connection.");
      }

      const body = (await response.json()) as { snapshot: OfficeQuickBooksSettingsSnapshot };
      setCurrentSnapshot(body.snapshot);
      setSubmitSuccess("QuickBooks company info check passed.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to validate QuickBooks connection.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDisconnect() {
    setPendingAction("disconnect");
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/office/settings/quickbooks", {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to disconnect QuickBooks.");
      }

      const body = (await response.json()) as { snapshot: OfficeQuickBooksSettingsSnapshot };
      setCurrentSnapshot(body.snapshot);
      setConfirmDisconnect(false);
      setSubmitSuccess("QuickBooks connection removed.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to disconnect QuickBooks.");
    } finally {
      setPendingAction("");
    }
  }

  const canStartConnection =
    canManageSettings &&
    currentSnapshot.settings.clientConfigured &&
    currentSnapshot.settings.encryptionReady &&
    pendingAction === "";

  return (
    <>
      <section className="office-settings-card-grid">
        <SectionCard subtitle="OAuth connection to the company QuickBooks Online file." title="QuickBooks Online">
          <div className="office-settings-template-form">
            {submitError ? <p className="office-inline-error">{submitError}</p> : null}
            {submitSuccess ? <p className="office-inline-success">{submitSuccess}</p> : null}
            {!currentSnapshot.settings.clientConfigured ? (
              <p className="office-inline-error">
                QuickBooks OAuth requires <code>QUICKBOOKS_CLIENT_ID</code> / <code>QUICKBOOKS_CLIENT_SECRET</code> or the <code>ACRE_QUICKBOOKS_*</code> equivalents.
              </p>
            ) : null}
            {!currentSnapshot.settings.encryptionReady ? (
              <p className="office-inline-error">
                Saved QuickBooks tokens require <code>ACRE_SETTINGS_ENCRYPTION_SECRET</code> or <code>ACRE_SESSION_SECRET</code>.
              </p>
            ) : null}

            <div className="office-settings-user-inline-badges">
              <StatusBadge tone={currentSnapshot.summary.statusTone}>{currentSnapshot.summary.statusLabel}</StatusBadge>
              <StatusBadge tone="accent">{currentSnapshot.summary.environmentLabel}</StatusBadge>
              <StatusBadge tone={currentSnapshot.settings.hasStoredRefreshToken ? "success" : "neutral"}>
                Refresh token {currentSnapshot.settings.hasStoredRefreshToken ? "stored" : "missing"}
              </StatusBadge>
            </div>

            <div className="office-settings-actions">
              {canStartConnection ? (
                <a className="office-button office-button-primary" href="/api/office/settings/quickbooks/connect">
                  {currentSnapshot.settings.isConnected ? "Reconnect QuickBooks" : "Connect QuickBooks"}
                </a>
              ) : (
                <Button disabled type="button">
                  {currentSnapshot.settings.isConnected ? "Reconnect QuickBooks" : "Connect QuickBooks"}
                </Button>
              )}
              <Button
                disabled={!canManageSettings || !currentSnapshot.summary.canValidate || pendingAction !== ""}
                onClick={handleValidate}
                type="button"
                variant="secondary"
              >
                {pendingAction === "validate" ? "Checking..." : "Check connection"}
              </Button>
              {currentSnapshot.settings.source === "database" ? (
                <Button
                  disabled={!canManageSettings || pendingAction !== ""}
                  onClick={() => setConfirmDisconnect(true)}
                  type="button"
                  variant="secondary"
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard subtitle="Current connection details saved in Acre." title="Connection status">
          <div className="office-settings-template-form">
            <div className="office-form-grid">
              <div className="office-detail-field">
                <span>Company</span>
                <strong>{currentSnapshot.summary.companyLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Realm ID</span>
                <strong>{currentSnapshot.settings.realmId || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Legal name</span>
                <strong>{currentSnapshot.settings.legalName || "—"}</strong>
              </div>
              <div className="office-detail-field">
                <span>Scope</span>
                <strong>{currentSnapshot.settings.scope || currentSnapshot.settings.authorizationScope}</strong>
              </div>
              <div className="office-detail-field">
                <span>Access token expires</span>
                <strong>{currentSnapshot.settings.accessTokenExpiresAtLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Refresh token expires</span>
                <strong>{currentSnapshot.settings.refreshTokenExpiresAtLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Last checked</span>
                <strong>{currentSnapshot.settings.lastValidatedAtLabel}</strong>
              </div>
              <div className="office-detail-field">
                <span>Updated by</span>
                <strong>{currentSnapshot.settings.updatedByLabel}</strong>
              </div>
              <div className="office-detail-field office-detail-field-wide">
                <span>Last message</span>
                <strong>{currentSnapshot.settings.lastValidationMessage || "—"}</strong>
              </div>
              <div className="office-detail-field office-detail-field-wide">
                <span>Posting scope</span>
                <strong>Confirmed payout statements can be posted as unpaid QuickBooks bills. General invoice, payment, payout, and ledger sync is not enabled yet.</strong>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <ConfirmActionDialog
        cancelLabel="Keep connection"
        confirmLabel={pendingAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
        description="This removes the saved QuickBooks OAuth tokens from Acre. Accounting records will stay in Acre and no QuickBooks object will be marked as synced."
        isOpen={confirmDisconnect}
        onCancel={() => {
          if (pendingAction !== "disconnect") {
            setConfirmDisconnect(false);
          }
        }}
        onConfirm={handleDisconnect}
        title="Disconnect QuickBooks?"
      />
    </>
  );
}
