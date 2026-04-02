"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  ListPageSection,
  ListPageTableSection,
  SelectInput,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type { OfficeSignatureWorkspaceSnapshot } from "@acre/db";

type OfficeSignaturesClientProps = {
  workspace: OfficeSignatureWorkspaceSnapshot;
  canManageSignatures: boolean;
  canManageTemplateLibrary: boolean;
  canManageDriveSettings: boolean;
};

type FilterState = {
  status: string;
  category: string;
  requestedByMembershipId: string;
  recipientQuery: string;
  subjectMembershipId: string;
};

function buildFilterState(workspace: OfficeSignatureWorkspaceSnapshot): FilterState {
  return {
    status: workspace.filters.status,
    category: workspace.filters.category,
    requestedByMembershipId: workspace.filters.requestedByMembershipId,
    recipientQuery: workspace.filters.recipientQuery,
    subjectMembershipId: workspace.filters.subjectMembershipId
  };
}

function getStatusTone(statusKey: string) {
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

function getDriveTone(statusKey: string) {
  if (statusKey === "synced") {
    return "success" as const;
  }

  if (statusKey === "failed") {
    return "danger" as const;
  }

  if (statusKey === "pending") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function OfficeSignaturesClient({
  workspace,
  canManageSignatures,
  canManageDriveSettings,
  canManageTemplateLibrary
}: OfficeSignaturesClientProps) {
  const router = useRouter();
  const [filterState, setFilterState] = useState<FilterState>(() => buildFilterState(workspace));
  const [pendingRetryId, setPendingRetryId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function updateFilter(field: keyof FilterState, value: string) {
    setFilterState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();

    if (filterState.status && filterState.status !== "all") {
      query.set("status", filterState.status);
    }

    if (filterState.category && filterState.category !== "all") {
      query.set("category", filterState.category);
    }

    if (filterState.requestedByMembershipId) {
      query.set("requestedByMembershipId", filterState.requestedByMembershipId);
    }

    if (filterState.recipientQuery.trim()) {
      query.set("recipientQuery", filterState.recipientQuery.trim());
    }

    if (filterState.subjectMembershipId) {
      query.set("subjectMembershipId", filterState.subjectMembershipId);
    }

    router.push(query.size ? `/office/signatures?${query.toString()}` : "/office/signatures");
  }

  async function retryDriveSync(signatureRequestId: string) {
    setPendingRetryId(signatureRequestId);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/office/signatures/${signatureRequestId}/drive-sync`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Drive sync retry failed.");
      }

      setSuccessMessage(payload?.message || "Drive sync retried.");
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Drive sync retry failed.");
    } finally {
      setPendingRetryId("");
    }
  }

  return (
    <>
      <ListPageSection
        subtitle="Filter the live envelope list by status, template category, sender, or signer/recipient."
        title="Signature filters"
      >
        <form className="office-form-grid" onSubmit={applyFilters}>
          <FormField label="Status">
            <SelectInput onChange={(event) => updateFilter("status", event.target.value)} value={filterState.status}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_send">Pending Send</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="signed">Signed</option>
              <option value="completed">Completed</option>
              <option value="declined">Declined</option>
              <option value="voided">Void / Cancelled</option>
              <option value="expired">Expired</option>
            </SelectInput>
          </FormField>

          <FormField label="Template category">
            <SelectInput onChange={(event) => updateFilter("category", event.target.value)} value={filterState.category}>
              <option value="all">All categories</option>
              <option value="transaction">Transaction</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </SelectInput>
          </FormField>

          <FormField label="Requested by">
            <SelectInput onChange={(event) => updateFilter("requestedByMembershipId", event.target.value)} value={filterState.requestedByMembershipId}>
              <option value="">All senders</option>
              {workspace.requestedByOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Signer / recipient">
            <TextInput
              onChange={(event) => updateFilter("recipientQuery", event.target.value)}
              placeholder="Name or email"
              value={filterState.recipientQuery}
            />
          </FormField>

          <div className="office-settings-actions">
            <Button type="submit">Apply filters</Button>
            <Button onClick={() => router.push("/office/signatures")} type="button" variant="secondary">
              Clear
            </Button>
            {canManageTemplateLibrary ? (
              <Link className="office-button-secondary" href="/office/signatures/templates">
                Open template library
              </Link>
            ) : null}
            {canManageDriveSettings ? (
              <Link className="office-button-secondary" href="/office/settings/signature-drive">
                Open Drive settings
              </Link>
            ) : null}
          </div>
        </form>

        {error ? <p className="office-inline-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        subtitle="Each row reflects the current envelope state, recipient coverage, and Drive archival outcome."
        title="Signature requests"
      >
        <DataTable className="office-list-table office-list-table-signatures">
          <DataTableHeader className="office-list-table-header office-list-table-header-signatures">
            <span>Request</span>
            <span>Context</span>
            <span>Requested by</span>
            <span>Recipients</span>
            <span>Status</span>
            <span>Drive</span>
            <span>Updated</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {workspace.rows.map((row) => (
              <DataTableRow className="office-list-table-row office-list-table-row-signatures" key={row.id}>
                <div className="office-list-table-main">
                  <strong>{row.requestHref && canManageSignatures ? <Link href={row.requestHref}>{row.title}</Link> : row.title}</strong>
                  <p>{row.templateName ? `${row.templateName} · ${row.templateCategoryLabel}` : row.templateCategoryLabel}</p>
                  <div className="office-signatures-request-meta">
                    {row.sentAt ? <span>{`Sent ${row.sentAt}`}</span> : null}
                    <span>{row.completedAt ? `Completed ${row.completedAt}` : "In progress"}</span>
                  </div>
                </div>
                <div className="office-list-table-cell-stack office-signatures-context-cell">
                  <strong>{row.contextLabel || "—"}</strong>
                  {row.transactionHref ? <p><Link href={row.transactionHref}>{row.transactionLabel}</Link></p> : null}
                </div>
                <span className="office-list-table-wrap-cell">{row.requestedByLabel}</span>
                <div className="office-list-table-cell-stack office-signatures-recipients-cell">
                  <strong className="office-signatures-recipients-primary">{row.recipientsLabel || "—"}</strong>
                  <p>{`${row.signersCount} signer · ${row.approversCount} approver · ${row.ccCount} CC`}</p>
                </div>
                <StatusBadge className="office-list-table-status" tone={getStatusTone(row.statusKey)}>
                  {row.status}
                </StatusBadge>
                <div className="office-list-table-cell-stack office-signatures-drive-cell">
                  <StatusBadge tone={getDriveTone(row.driveSyncStatus)}>{row.driveSyncStatusLabel}</StatusBadge>
                  {row.completedDocumentHref ? (
                    <div className="office-signatures-drive-actions">
                      <Link className="office-button-secondary office-button-sm" href={row.completedDocumentHref} target="_blank">
                        Signed PDF
                      </Link>
                      {canManageSignatures ? (
                        <Button
                          disabled={pendingRetryId === row.id}
                          onClick={() => retryDriveSync(row.id)}
                          size="sm"
                          variant="secondary"
                        >
                          {pendingRetryId === row.id ? "Retrying..." : "Retry Drive"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <span className="office-signatures-updated-cell">{row.updatedAt || "—"}</span>
              </DataTableRow>
            ))}

            {workspace.rows.length === 0 ? (
              <EmptyState
                description="Try clearing one of the filters or open a transaction to start a new signature request."
                title="No signature requests matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </>
  );
}
