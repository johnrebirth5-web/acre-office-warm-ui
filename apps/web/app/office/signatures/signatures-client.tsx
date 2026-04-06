"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  ListPageSection,
  ListPageSplit,
  ListPageStatsGrid,
  ListPageTableSection,
  QueueItem,
  SecondaryMetaList,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput
} from "@acre/ui";
import type {
  OfficeSignatureDriveSettingsSnapshot,
  OfficeSignatureWorkspaceRow,
  OfficeSignatureWorkspaceSnapshot
} from "@acre/db";

type OfficeSignaturesClientProps = {
  workspace: OfficeSignatureWorkspaceSnapshot;
  driveSnapshot: OfficeSignatureDriveSettingsSnapshot | null;
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

function buildRoleSummary(row: OfficeSignatureWorkspaceRow) {
  return `${row.signersCount} signer · ${row.approversCount} approver · ${row.ccCount} CC`;
}

function buildQueueAction(
  row: OfficeSignatureWorkspaceRow,
  canManageSignatures: boolean,
  pendingRetryId: string,
  retryDriveSync: (signatureRequestId: string) => Promise<void>
) {
  const actions: ReactNode[] = [];

  if (canManageSignatures && row.primaryActionHref) {
    actions.push(
      <Link className="office-button-secondary office-button-sm" href={row.primaryActionHref} key={`${row.id}-primary`}>
        {row.primaryActionLabel}
      </Link>
    );
  }

  if (row.transactionHref) {
    actions.push(
      <Link className="office-button-secondary office-button-sm" href={row.transactionHref} key={`${row.id}-transaction`}>
        Transaction
      </Link>
    );
  }

  if (row.completedDocumentHref) {
    actions.push(
      <Link
        className="office-button-secondary office-button-sm"
        href={row.completedDocumentHref}
        key={`${row.id}-document`}
        target="_blank"
      >
        Signed PDF
      </Link>
    );
  }

  if (row.driveSyncStatus === "failed" && canManageSignatures) {
    actions.push(
      <Button
        disabled={pendingRetryId === row.id}
        key={`${row.id}-retry-drive`}
        onClick={() => retryDriveSync(row.id)}
        size="sm"
        variant="secondary"
      >
        {pendingRetryId === row.id ? "Retrying..." : "Retry Drive"}
      </Button>
    );
  }

  if (actions.length === 0) {
    return null;
  }

  return <>{actions}</>;
}

function buildQueueMeta(row: OfficeSignatureWorkspaceRow) {
  const items = [
    {
      label: "Template",
      value: row.templateName ? `${row.templateName} · ${row.templateCategoryLabel}` : row.templateCategoryLabel
    },
    {
      label: "Recipients",
      value: row.recipientsLabel || "No signer assigned yet"
    },
    {
      label: "Requested by",
      value: row.requestedByLabel
    },
    {
      label: "Updated",
      value: row.updatedAt || "—"
    }
  ];

  if (row.subjectLabel && row.subjectLabel !== "—") {
    items.splice(3, 0, {
      label: "Subject",
      value: row.subjectLabel
    });
  }

  return <SecondaryMetaList items={items} />;
}

export function OfficeSignaturesClient({
  workspace,
  driveSnapshot,
  canManageSignatures,
  canManageDriveSettings,
  canManageTemplateLibrary
}: OfficeSignaturesClientProps) {
  const router = useRouter();
  const [filterState, setFilterState] = useState<FilterState>(() => buildFilterState(workspace));
  const [pendingRetryId, setPendingRetryId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const draftRows = workspace.rows.filter((row) => row.statusKey === "draft" || row.statusKey === "pending_send");
  const inFlightRows = workspace.rows.filter(
    (row) => row.statusKey === "sent" || row.statusKey === "viewed" || row.statusKey === "signed"
  );
  const failedDriveRows = workspace.rows.filter((row) => row.driveSyncStatus === "failed");
  const centerQueue: OfficeSignatureWorkspaceRow[] = [];

  for (const candidate of [...draftRows, ...inFlightRows, ...failedDriveRows]) {
    if (centerQueue.some((row) => row.id === candidate.id)) {
      continue;
    }

    centerQueue.push(candidate);

    if (centerQueue.length >= 6) {
      break;
    }
  }

  const categoryBreakdown = [
    { key: "transaction", label: "Transaction", count: workspace.rows.filter((row) => row.templateCategory === "transaction").length },
    { key: "hr", label: "HR", count: workspace.rows.filter((row) => row.templateCategory === "hr").length },
    { key: "finance", label: "Finance", count: workspace.rows.filter((row) => row.templateCategory === "finance").length },
    { key: "admin", label: "Admin", count: workspace.rows.filter((row) => row.templateCategory === "admin").length },
    { key: "generic", label: "Generic", count: workspace.rows.filter((row) => row.templateCategory === "generic").length }
  ].filter((entry) => entry.count > 0);

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
      <ListPageStatsGrid>
        <StatCard hint="Saved requests that still need recipient or PDF-field work before they can move on." label="Drafts" tone="accent" value={workspace.summary.draftCount} />
        <StatCard hint="Saved requests that are ready for send review but have not gone out yet." label="Ready to send" value={workspace.summary.readyToSendCount} />
        <StatCard hint="Envelopes already in recipient hands or partially completed." label="In flight" value={workspace.summary.inFlightCount} />
        <StatCard hint="Finished requests in the current filtered center view." label="Completed" value={workspace.summary.completedCount} />
        <StatCard
          hint="HR, finance, admin, and generic requests visible here even though authoring still starts on a source PDF."
          label="Non-transaction"
          value={workspace.summary.nonTransactionRequestCount}
        />
        {canManageTemplateLibrary ? (
          <StatCard
            hint="Active reusable templates available for the next request authoring session."
            label="Active templates"
            value={workspace.summary.activeTemplateCount}
          />
        ) : null}
        {driveSnapshot ? (
          <StatCard
            hint="Completed non-transaction envelopes currently route here inside Signature Drive."
            label="Generic Drive route"
            value={driveSnapshot.summary.genericEnvelopeTargetLabel}
          />
        ) : null}
      </ListPageStatsGrid>

      <ListPageSplit>
        <ListPageSection
          subtitle="This center can reopen saved drafts, surface sent envelopes that still need attention, and let operations retry Drive sync without backing into a transaction detail page first."
          title="Start / continue from center"
        >
          {centerQueue.length > 0 ? (
            <div className="office-queue-list">
              {centerQueue.map((row) => (
                <QueueItem
                  action={buildQueueAction(row, canManageSignatures, pendingRetryId, retryDriveSync)}
                  badge={<StatusBadge tone={getStatusTone(row.statusKey)}>{row.status}</StatusBadge>}
                  context={`${row.contextTypeLabel} · ${row.templateCategoryLabel}`}
                  description={
                    row.statusKey === "draft" || row.statusKey === "pending_send"
                      ? "Continue recipient, delivery, or field placement work."
                      : row.driveSyncStatus === "failed"
                        ? "The request completed, but Drive archival still needs attention."
                        : "Monitor the live request without leaving the signatures workspace."
                  }
                  key={row.id}
                  meta={buildQueueMeta(row)}
                  title={canManageSignatures && row.primaryActionHref ? <Link href={row.primaryActionHref}>{row.title}</Link> : row.title}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                canManageTemplateLibrary ? (
                  <Link className="office-button-secondary" href="/office/signatures/templates">
                    Open template library
                  </Link>
                ) : null
              }
              description="No drafts, in-flight envelopes, or Drive retries are currently bubbling to the top of the center."
              title="Nothing urgent in the signatures workspace"
            />
          )}
        </ListPageSection>

        <ListPageSection
          subtitle="The center now makes the create-anywhere path clearer, while staying honest about the current transaction-backed editor and storage model."
          title="Operating path"
        >
          <div className="office-queue-list">
            <QueueItem
              badgeLabel="Reusable"
              badgeTone="accent"
              description={
                canManageTemplateLibrary
                  ? `${workspace.summary.activeTemplateCount} active templates are ready to prefill recipients, routing, copy, and field placements once a source PDF is chosen.`
                  : "Templates still govern the reusable recipient, routing, and field-placement defaults for this workspace."
              }
              meta={
                <SecondaryMetaList
                  items={[
                    {
                      label: "Library scope",
                      value: canManageTemplateLibrary ? `${workspace.summary.templateCount} total templates` : "Managed by template admins"
                    },
                    {
                      label: "Non-transaction templates",
                      value: canManageTemplateLibrary ? workspace.summary.nonTransactionTemplateCount : "Available in the shared library"
                    }
                  ]}
                />
              }
              title="Templates now read like a shared signature library, not just a transaction side effect."
            />

            <QueueItem
              badgeLabel="Truthful"
              description="Actual request authoring still lands on a real transaction PDF. This center deepens visibility, draft continuation, and template reuse without pretending a new schema-level generic create flow already exists."
              meta={
                <SecondaryMetaList
                  items={[
                    {
                      label: "Current authoring path",
                      value: "Transaction PDF -> optional template prefill -> save draft -> continue here"
                    },
                    {
                      label: "Requests visible here",
                      value:
                        categoryBreakdown.length > 0
                          ? categoryBreakdown.map((entry) => `${entry.label} ${entry.count}`).join(" · ")
                          : "No requests in the current filter set"
                    }
                  ]}
                />
              }
              title="The signatures center is a real workspace now, even before schema-level generic create lands."
            />

            {driveSnapshot ? (
              <QueueItem
                badgeLabel={driveSnapshot.summary.statusLabel}
                badgeTone={driveSnapshot.summary.canSyncNow ? "success" : "neutral"}
                description="Drive routing stays visible from the center so operations can see how completed signature packets will archive for transaction and non-transaction work."
                meta={
                  <SecondaryMetaList
                    items={[
                      {
                        label: "Generic envelopes",
                        value: driveSnapshot.summary.genericEnvelopeTargetLabel
                      },
                      {
                        label: "Transaction envelopes",
                        value: driveSnapshot.summary.transactionEnvelopeTargetLabel
                      }
                    ]}
                  />
                }
                title="Drive routing is exposed as an operational path, not a hidden settings dependency."
              />
            ) : canManageDriveSettings ? null : (
              <QueueItem
                badgeLabel="Settings"
                description="Template admins can still route completed generic and transaction envelopes through Signature Drive, but the underlying sync remains the same synchronous in-product flow."
                title="Drive archival remains intentionally simple."
              />
            )}
          </div>
        </ListPageSection>
      </ListPageSplit>

      <ListPageSection
        subtitle="Filter the signatures center by lifecycle, category, sender, internal subject, or signer/recipient so the workspace can serve both transaction and non-transaction operations."
        title="Live queue filters"
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

          <FormField label="Template / request category">
            <SelectInput onChange={(event) => updateFilter("category", event.target.value)} value={filterState.category}>
              <option value="all">All categories</option>
              <option value="transaction">Transaction</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
              <option value="generic">Generic</option>
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

          <FormField label="Subject">
            <SelectInput onChange={(event) => updateFilter("subjectMembershipId", event.target.value)} value={filterState.subjectMembershipId}>
              <option value="">All internal subjects</option>
              {workspace.subjectOptions.map((option) => (
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

          <div className="office-filter-actions office-form-grid-span-2 office-signatures-filter-actions">
            <Button type="submit">Update queue</Button>
            <Button onClick={() => router.push("/office/signatures")} type="button" variant="secondary">
              Clear
            </Button>
            {canManageTemplateLibrary ? (
              <Link className="office-button-secondary" href="/office/signatures/templates">
                Template library
              </Link>
            ) : null}
            {canManageDriveSettings ? (
              <Link className="office-button-secondary" href="/office/settings/signature-drive">
                Drive settings
              </Link>
            ) : null}
          </div>
        </form>

        {driveSnapshot ? (
          <p className="office-form-helper">
            Completed non-transaction envelopes currently route to <strong>{driveSnapshot.summary.genericEnvelopeTargetLabel}</strong> in Signature
            Drive.
          </p>
        ) : null}

        {error ? <p className="office-inline-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        subtitle="Every row is reachable from the signatures center so operations can continue drafts, review live envelopes, and confirm archive state without relying on a reverse jump from transaction detail."
        title="Signature requests"
      >
        <DataTable className="office-list-table office-list-table-signatures">
          <DataTableHeader className="office-list-table-header office-list-table-header-signatures">
            <span>Request</span>
            <span>Path</span>
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
                  <div className="office-list-table-main-meta">
                    {canManageSignatures && row.primaryActionHref ? (
                      <span>
                        <Link className="office-toggle-link" href={row.primaryActionHref}>
                          {row.primaryActionLabel}
                        </Link>
                      </span>
                    ) : null}
                    {row.sentAt ? <span>{`Sent ${row.sentAt}`}</span> : null}
                    <span>{row.completedAt ? `Completed ${row.completedAt}` : "Still active"}</span>
                  </div>
                </div>
                <div className="office-list-table-cell-stack office-signatures-context-cell">
                  <strong>{row.contextTypeLabel}</strong>
                  {row.transactionHref ? <p><Link href={row.transactionHref}>{row.transactionLabel}</Link></p> : <p>{row.contextLabel || "—"}</p>}
                  {row.subjectLabel && row.subjectLabel !== "—" ? <p>{`Subject · ${row.subjectLabel}`}</p> : null}
                </div>
                <span className="office-list-table-wrap-cell">{row.requestedByLabel}</span>
                <div className="office-list-table-cell-stack office-signatures-recipients-cell">
                  <strong className="office-signatures-recipients-primary">{row.recipientsLabel || "No signer assigned yet"}</strong>
                  <p>{buildRoleSummary(row)}</p>
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
                      {row.driveSyncStatus === "failed" && canManageSignatures ? (
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
                action={
                  canManageTemplateLibrary ? (
                    <Link className="office-button-secondary" href="/office/signatures/templates">
                      Open template library
                    </Link>
                  ) : null
                }
                description="Clear a filter, continue an existing draft, or start from a transaction PDF and let the request return here once it becomes a live envelope."
                title="No signature requests matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </>
  );
}
