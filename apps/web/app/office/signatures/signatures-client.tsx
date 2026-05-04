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
import { useI18n } from "../../../lib/i18n/client";
import type { TranslationSelector, TranslationVariables } from "../../../lib/i18n";

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

type TranslateFn = (
  selector: TranslationSelector,
  values?: TranslationVariables,
) => string;

function getSignatureStatusLabel(statusKey: string, t: TranslateFn) {
  switch (statusKey) {
    case "draft":
      return t((messages) => messages.officeSignatures.drafts);
    case "pending_send":
      return t((messages) => messages.officeSignatures.pendingSend);
    case "sent":
      return t((messages) => messages.officeSignatures.sent);
    case "viewed":
      return t((messages) => messages.officeSignatures.viewed);
    case "signed":
      return t((messages) => messages.officeSignatures.signed);
    case "completed":
      return t((messages) => messages.officeSignatures.completed);
    case "declined":
      return t((messages) => messages.officeSignatures.declined);
    case "canceled":
    case "voided":
      return t((messages) => messages.officeSignatures.voidCancelled);
    case "expired":
      return t((messages) => messages.officeSignatures.expired);
    default:
      return statusKey;
  }
}

function getDriveStatusLabel(statusKey: string, t: TranslateFn) {
  switch (statusKey) {
    case "pending":
      return t((messages) => messages.officeSignatures.drivePending);
    case "synced":
      return t((messages) => messages.officeSignatures.driveSynced);
    case "failed":
      return t((messages) => messages.officeSignatures.driveFailed);
    case "not_configured":
      return t((messages) => messages.officeSignatures.driveNotConfigured);
    default:
      return statusKey;
  }
}

function getTemplateCategoryLabel(category: string, t: TranslateFn) {
  switch (category) {
    case "transaction":
      return t((messages) => messages.officeSignatures.transactionCategory);
    case "hr":
      return t((messages) => messages.officeSignatures.hrCategory);
    case "finance":
      return t((messages) => messages.officeSignatures.financeCategory);
    case "admin":
      return t((messages) => messages.officeSignatures.adminCategory);
    case "generic":
      return t((messages) => messages.officeSignatures.genericCategory);
    default:
      return category || "—";
  }
}

function getContextTypeLabel(contextType: string, t: TranslateFn) {
  switch (contextType) {
    case "transaction":
      return t((messages) => messages.officeSignatures.transactionCategory);
    case "membership":
      return t((messages) => messages.officeSignatures.hrCategory);
    case "finance_request":
      return t((messages) => messages.officeSignatures.financeCategory);
    case "admin_request":
      return t((messages) => messages.officeSignatures.adminCategory);
    case "generic":
      return t((messages) => messages.officeSignatures.genericCategory);
    case "project":
      return t((messages) => messages.officeSignatures.projectCategory);
    default:
      return contextType || "—";
  }
}

function getPrimaryActionLabel(label: string, t: TranslateFn) {
  switch (label) {
    case "Continue draft":
      return t((messages) => messages.officeSignatureTemplates.continueLatestDraft);
    case "Open request":
      return t((messages) => messages.officeSignatures.openRequest);
    case "Open transaction":
      return t((messages) => messages.officeSignatures.openTransaction);
    case "Open project signing":
      return t((messages) => messages.officeSignatures.openProjectSigning);
    default:
      return label;
  }
}

function getDriveSettingsStatusLabel(label: string, t: TranslateFn) {
  switch (label) {
    case "Ready":
      return t((messages) => messages.officeSignatures.available);
    case "Incomplete":
      return t((messages) => messages.common.unavailable);
    case "Disabled":
      return t((messages) => messages.common.inactive);
    case "Not configured":
      return t((messages) => messages.common.notRecorded);
    default:
      return label;
  }
}

function getBlockerCopy(
  code: string,
  t: TranslateFn,
) {
  switch (code) {
    case "signature-request-transaction-required":
      return {
        title: t((messages) => messages.officeSignatures.blockerTransactionRequiredTitle),
        detail: t((messages) => messages.officeSignatures.blockerTransactionRequiredDetail),
      };
    case "signature-recipient-field-transaction-required":
      return {
        title: t((messages) => messages.officeSignatures.blockerRecipientsRequiredTitle),
        detail: t((messages) => messages.officeSignatures.blockerRecipientsRequiredDetail),
      };
    case "signature-editor-needs-transaction-pdf":
      return {
        title: t((messages) => messages.officeSignatures.blockerEditorNeedsPdfTitle),
        detail: t((messages) => messages.officeSignatures.blockerEditorNeedsPdfDetail),
      };
    case "generic-template-category-missing":
      return {
        title: t((messages) => messages.officeSignatures.blockerGenericMissingTitle),
        detail: t((messages) => messages.officeSignatures.blockerGenericMissingDetail),
      };
    default:
      return null;
  }
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

function buildRoleSummary(row: OfficeSignatureWorkspaceRow, t: TranslateFn) {
  return t((messages) => messages.officeSignatures.rolesSummary, {
    signers: row.signersCount,
    approvers: row.approversCount,
    cc: row.ccCount,
  });
}

function buildQueueAction(
  row: OfficeSignatureWorkspaceRow,
  canManageSignatures: boolean,
  pendingRetryId: string,
  retryDriveSync: (signatureRequestId: string) => Promise<void>,
  t: TranslateFn,
) {
  const actions: ReactNode[] = [];
  const actionClassName = "office-button-secondary office-button-sm office-signatures-queue-action";

  if (canManageSignatures && row.primaryActionHref) {
    actions.push(
      <Link className={actionClassName} href={row.primaryActionHref} key={`${row.id}-primary`}>
        {getPrimaryActionLabel(row.primaryActionLabel, t)}
      </Link>
    );
  }

  if (row.transactionHref) {
    actions.push(
      <Link className={actionClassName} href={row.transactionHref} key={`${row.id}-transaction`}>
        {t((messages) => messages.officeSignatures.transactionAction)}
      </Link>
    );
  }

  if (row.completedDocumentHref) {
    actions.push(
      <Link
        className={actionClassName}
        href={row.completedDocumentHref}
        key={`${row.id}-document`}
        target="_blank"
      >
        {t((messages) => messages.officeSignatures.signedPdf)}
      </Link>
    );
  }

  if (row.driveSyncStatus === "failed" && canManageSignatures) {
    actions.push(
      <Button
        className="office-signatures-queue-action"
        disabled={pendingRetryId === row.id}
        key={`${row.id}-retry-drive`}
        onClick={() => retryDriveSync(row.id)}
        size="sm"
        variant="secondary"
      >
        {pendingRetryId === row.id
          ? t((messages) => messages.officeSignatures.retryingDrive)
          : t((messages) => messages.officeSignatures.retryDrive)}
      </Button>
    );
  }

  if (actions.length === 0) {
    return null;
  }

  return <div className="office-signatures-queue-actions">{actions}</div>;
}

function buildQueueMeta(row: OfficeSignatureWorkspaceRow, t: TranslateFn) {
  const items = [
    {
      label: t((messages) => messages.officeSignatures.templateMeta),
      value: row.templateName
        ? `${row.templateName} · ${getTemplateCategoryLabel(row.templateCategory, t)}`
        : getTemplateCategoryLabel(row.templateCategory, t)
    },
    {
      label: t((messages) => messages.officeSignatures.recipientsMeta),
      value: row.recipientsLabel || t((messages) => messages.officeSignatures.noSignerAssignedYet)
    },
    {
      label: t((messages) => messages.officeSignatures.requestedBy),
      value: row.requestedByLabel
    },
    {
      label: t((messages) => messages.officeSignatures.updatedMeta),
      value: row.updatedAt || "—"
    }
  ];

  if (row.subjectLabel && row.subjectLabel !== "—") {
    items.splice(3, 0, {
      label: t((messages) => messages.officeSignatures.subjectMeta),
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
  const { t } = useI18n();
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
    { key: "transaction", label: getTemplateCategoryLabel("transaction", t), count: workspace.rows.filter((row) => row.templateCategory === "transaction").length },
    { key: "hr", label: getTemplateCategoryLabel("hr", t), count: workspace.rows.filter((row) => row.templateCategory === "hr").length },
    { key: "finance", label: getTemplateCategoryLabel("finance", t), count: workspace.rows.filter((row) => row.templateCategory === "finance").length },
    { key: "admin", label: getTemplateCategoryLabel("admin", t), count: workspace.rows.filter((row) => row.templateCategory === "admin").length },
    { key: "generic", label: getTemplateCategoryLabel("generic", t), count: workspace.rows.filter((row) => row.templateCategory === "generic").length }
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
        throw new Error(payload?.error || payload?.message || t((messages) => messages.officeSignatures.driveSyncRetryFailed));
      }

      setSuccessMessage(t((messages) => messages.officeSignatures.driveSyncRetried));
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : t((messages) => messages.officeSignatures.driveSyncRetryFailed));
    } finally {
      setPendingRetryId("");
    }
  }

  return (
    <>
      <ListPageStatsGrid>
        <StatCard hint={t((messages) => messages.officeSignatures.statsDraftsHint)} label={t((messages) => messages.officeSignatures.drafts)} tone="accent" value={workspace.summary.draftCount} />
        <StatCard hint={t((messages) => messages.officeSignatures.statsReadyToSendHint)} label={t((messages) => messages.officeSignatures.readyToSend)} value={workspace.summary.readyToSendCount} />
        <StatCard hint={t((messages) => messages.officeSignatures.statsInFlightHint)} label={t((messages) => messages.officeSignatures.inFlight)} value={workspace.summary.inFlightCount} />
        <StatCard hint={t((messages) => messages.officeSignatures.statsCompletedHint)} label={t((messages) => messages.officeSignatures.completed)} value={workspace.summary.completedCount} />
        <StatCard
          hint={t((messages) => messages.officeSignatures.statsNonTransactionTrackedHint)}
          label={t((messages) => messages.officeSignatures.nonTransactionTracked)}
          value={workspace.summary.nonTransactionRequestCount}
        />
        {canManageTemplateLibrary ? (
          <StatCard
            hint={t((messages) => messages.officeSignatures.statsActiveTemplatesHint)}
            label={t((messages) => messages.officeSignatures.activeTemplates)}
            value={workspace.summary.activeTemplateCount}
          />
        ) : null}
        {driveSnapshot ? (
          <StatCard
            hint={t((messages) => messages.officeSignatures.statsGenericDriveRouteHint)}
            label={t((messages) => messages.officeSignatures.genericDriveRoute)}
            value={driveSnapshot.summary.genericEnvelopeTargetLabel}
          />
        ) : null}
      </ListPageStatsGrid>

      <ListPageSplit>
        <ListPageSection
          subtitle={t((messages) => messages.officeSignatures.continueSubtitle)}
          title={t((messages) => messages.officeSignatures.continueTitle)}
        >
          {centerQueue.length > 0 ? (
            <div className="office-queue-list">
              {centerQueue.map((row) => (
                <QueueItem
                  action={buildQueueAction(row, canManageSignatures, pendingRetryId, retryDriveSync, t)}
                  badge={<StatusBadge tone={getStatusTone(row.statusKey)}>{getSignatureStatusLabel(row.statusKey, t)}</StatusBadge>}
                  context={`${getContextTypeLabel(row.contextType, t)} · ${getTemplateCategoryLabel(row.templateCategory, t)}`}
                  description={
                    row.statusKey === "draft" || row.statusKey === "pending_send"
                      ? t((messages) => messages.officeSignatures.continueDraftDescription)
                      : row.driveSyncStatus === "failed"
                        ? t((messages) => messages.officeSignatures.continueDriveDescription)
                        : t((messages) => messages.officeSignatures.continueMonitorDescription)
                  }
                  key={row.id}
                  meta={buildQueueMeta(row, t)}
                  title={canManageSignatures && row.primaryActionHref ? <Link href={row.primaryActionHref}>{row.title}</Link> : row.title}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                canManageTemplateLibrary ? (
                  <Link className="office-button-secondary" href="/office/signatures/templates">
                    {t((messages) => messages.officeSignatures.openTemplateLibrary)}
                  </Link>
                ) : null
              }
              description={t((messages) => messages.officeSignatures.urgentEmptyBody)}
              title={t((messages) => messages.officeSignatures.urgentEmptyTitle)}
            />
          )}
        </ListPageSection>

        <ListPageSection
          subtitle={t((messages) => messages.officeSignatures.directCreateSubtitle)}
          title={t((messages) => messages.officeSignatures.directCreateTitle)}
        >
          <div className="office-queue-list">
            <QueueItem
              badgeLabel={workspace.createSupport.canStartNonTransactionDraft ? t((messages) => messages.officeSignatures.available) : t((messages) => messages.officeSignatures.comingSoon)}
              badgeTone={workspace.createSupport.canStartNonTransactionDraft ? "success" : "danger"}
              description={t((messages) => messages.officeSignatures.directCreateUnavailableBody)}
              meta={
                <SecondaryMetaList
                  items={workspace.createSupport.blockers.map((blocker) => {
                    const localizedBlocker = getBlockerCopy(blocker.code, t);

                    return {
                      label: localizedBlocker?.title ?? blocker.title,
                      value: localizedBlocker?.detail ?? blocker.detail,
                    };
                  })}
                />
              }
              title={t((messages) => messages.officeSignatures.directCreateUnavailableTitle)}
            />

            <QueueItem
              badgeLabel={t((messages) => messages.officeSignatures.availableToday)}
              description={t((messages) => messages.officeSignatures.directCreateAvailableBody)}
              meta={
                <SecondaryMetaList
                  items={[
                    {
                      label: t((messages) => messages.officeSignatures.currentAuthoringPath),
                      value: t((messages) => messages.officeSignatures.currentAuthoringPathValue)
                    },
                    {
                      label: t((messages) => messages.officeSignatures.templateReuse),
                      value: canManageTemplateLibrary
                        ? t((messages) => messages.officeSignatures.templateReuseValue, {
                            active: workspace.summary.activeTemplateCount,
                            nonTransaction: workspace.summary.nonTransactionTemplateCount,
                          })
                        : t((messages) => messages.officeSignatures.managedThroughSharedTemplateLibrary)
                    },
                    {
                      label: t((messages) => messages.officeSignatures.requestsTrackedHere),
                      value:
                        categoryBreakdown.length > 0
                          ? categoryBreakdown.map((entry) => `${entry.label} ${entry.count}`).join(" · ")
                          : t((messages) => messages.officeSignatures.noRequestsInCurrentFilterSet)
                    }
                  ]}
                />
              }
              title={t((messages) => messages.officeSignatures.directCreateAvailableTitle)}
            />

            {driveSnapshot ? (
              <QueueItem
                badgeLabel={getDriveSettingsStatusLabel(driveSnapshot.summary.statusLabel, t)}
                badgeTone={driveSnapshot.summary.canSyncNow ? "success" : "neutral"}
                description={t((messages) => messages.officeSignatures.driveRoutingBody)}
                meta={
                  <SecondaryMetaList
                    items={[
                      {
                        label: t((messages) => messages.officeSignatures.genericEnvelopes),
                        value: driveSnapshot.summary.genericEnvelopeTargetLabel
                      },
                      {
                        label: t((messages) => messages.officeSignatures.transactionEnvelopes),
                        value: driveSnapshot.summary.transactionEnvelopeTargetLabel
                      }
                    ]}
                  />
                }
                title={t((messages) => messages.officeSignatures.driveRoutingTitle)}
              />
            ) : canManageDriveSettings ? null : (
              <QueueItem
                badgeLabel={t((messages) => messages.officeSignatures.settings)}
                description={t((messages) => messages.officeSignatures.simpleArchivalBody)}
                title={t((messages) => messages.officeSignatures.simpleArchivalTitle)}
              />
            )}
          </div>
        </ListPageSection>
      </ListPageSplit>

      <ListPageSection
        subtitle={t((messages) => messages.officeSignatures.liveQueueFiltersSubtitle)}
        title={t((messages) => messages.officeSignatures.liveQueueFiltersTitle)}
      >
        <form className="office-form-grid" onSubmit={applyFilters}>
          <FormField label={t((messages) => messages.officeSignatures.statusFilter)}>
            <SelectInput onChange={(event) => updateFilter("status", event.target.value)} value={filterState.status}>
              <option value="all">{t((messages) => messages.officeSignatures.allStatuses)}</option>
              <option value="draft">{t((messages) => messages.officeSignatures.drafts)}</option>
              <option value="pending_send">{t((messages) => messages.officeSignatures.pendingSend)}</option>
              <option value="sent">{t((messages) => messages.officeSignatures.sent)}</option>
              <option value="viewed">{t((messages) => messages.officeSignatures.viewed)}</option>
              <option value="signed">{t((messages) => messages.officeSignatures.signed)}</option>
              <option value="completed">{t((messages) => messages.officeSignatures.completed)}</option>
              <option value="declined">{t((messages) => messages.officeSignatures.declined)}</option>
              <option value="voided">{t((messages) => messages.officeSignatures.voidCancelled)}</option>
              <option value="expired">{t((messages) => messages.officeSignatures.expired)}</option>
            </SelectInput>
          </FormField>

          <FormField label={t((messages) => messages.officeSignatures.categoryFilter)}>
            <SelectInput onChange={(event) => updateFilter("category", event.target.value)} value={filterState.category}>
              <option value="all">{t((messages) => messages.officeSignatures.allCategories)}</option>
              <option value="transaction">{t((messages) => messages.officeSignatures.transactionCategory)}</option>
              <option value="hr">{t((messages) => messages.officeSignatures.hrCategory)}</option>
              <option value="finance">{t((messages) => messages.officeSignatures.financeCategory)}</option>
              <option value="admin">{t((messages) => messages.officeSignatures.adminCategory)}</option>
              <option value="generic">{t((messages) => messages.officeSignatures.genericCategory)}</option>
            </SelectInput>
          </FormField>

          <FormField label={t((messages) => messages.officeSignatures.requestedBy)}>
            <SelectInput onChange={(event) => updateFilter("requestedByMembershipId", event.target.value)} value={filterState.requestedByMembershipId}>
              <option value="">{t((messages) => messages.officeSignatures.allSenders)}</option>
              {workspace.requestedByOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={t((messages) => messages.officeSignatures.subject)}>
            <SelectInput onChange={(event) => updateFilter("subjectMembershipId", event.target.value)} value={filterState.subjectMembershipId}>
              <option value="">{t((messages) => messages.officeSignatures.allInternalSubjects)}</option>
              {workspace.subjectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={t((messages) => messages.officeSignatures.signerRecipient)}>
            <TextInput
              onChange={(event) => updateFilter("recipientQuery", event.target.value)}
              placeholder={t((messages) => messages.officeSignatures.nameOrEmail)}
              value={filterState.recipientQuery}
            />
          </FormField>

          <div className="office-filter-actions office-form-grid-span-2 office-signatures-filter-actions">
            <Button type="submit">{t((messages) => messages.officeSignatures.updateQueue)}</Button>
            <Button onClick={() => router.push("/office/signatures")} type="button" variant="secondary">
              {t((messages) => messages.officeSignatures.clear)}
            </Button>
            {canManageTemplateLibrary ? (
              <Link className="office-button-secondary" href="/office/signatures/templates">
                {t((messages) => messages.officeSignatures.templateLibrary)}
              </Link>
            ) : null}
            {canManageDriveSettings ? (
              <Link className="office-button-secondary" href="/office/settings/signature-drive">
                {t((messages) => messages.officeSignatures.driveSettings)}
              </Link>
            ) : null}
          </div>
        </form>

        {driveSnapshot ? (
          <p className="office-form-helper">
            {t((messages) => messages.officeSignatures.driveRouteHelper, {
              target: driveSnapshot.summary.genericEnvelopeTargetLabel,
            }).split(driveSnapshot.summary.genericEnvelopeTargetLabel)[0]}
            <strong>{driveSnapshot.summary.genericEnvelopeTargetLabel}</strong>
            {t((messages) => messages.officeSignatures.driveRouteHelper, {
              target: driveSnapshot.summary.genericEnvelopeTargetLabel,
            }).split(driveSnapshot.summary.genericEnvelopeTargetLabel)[1] ?? ""}
          </p>
        ) : null}

        {error ? <p className="office-inline-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        subtitle={t((messages) => messages.officeSignatures.requestTableSubtitle)}
        title={t((messages) => messages.officeSignatures.requestTableTitle)}
      >
        <DataTable className="office-list-table office-list-table-signatures">
          <DataTableHeader className="office-list-table-header office-list-table-header-signatures">
            <span>{t((messages) => messages.officeSignatures.tableRequest)}</span>
            <span>{t((messages) => messages.officeSignatures.tablePath)}</span>
            <span>{t((messages) => messages.officeSignatures.tableRequestedBy)}</span>
            <span>{t((messages) => messages.officeSignatures.tableRecipients)}</span>
            <span>{t((messages) => messages.officeSignatures.tableStatus)}</span>
            <span>{t((messages) => messages.officeSignatures.tableDrive)}</span>
            <span>{t((messages) => messages.officeSignatures.tableUpdated)}</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {workspace.rows.map((row) => (
              <DataTableRow className="office-list-table-row office-list-table-row-signatures" key={row.id}>
                <div className="office-list-table-main">
                  <strong>{row.requestHref && canManageSignatures ? <Link href={row.requestHref}>{row.title}</Link> : row.title}</strong>
                  <p>{row.templateName ? `${row.templateName} · ${getTemplateCategoryLabel(row.templateCategory, t)}` : getTemplateCategoryLabel(row.templateCategory, t)}</p>
                  <div className="office-list-table-main-meta">
                    {canManageSignatures && row.primaryActionHref ? (
                      <span>
                        <Link className="office-toggle-link" href={row.primaryActionHref}>
                          {getPrimaryActionLabel(row.primaryActionLabel, t)}
                        </Link>
                      </span>
                    ) : null}
                    {row.sentAt ? <span>{t((messages) => messages.officeSignatures.sentPrefix, { value: row.sentAt })}</span> : null}
                    <span>{row.completedAt ? t((messages) => messages.officeSignatures.completedPrefix, { value: row.completedAt }) : t((messages) => messages.officeSignatures.stillActive)}</span>
                  </div>
                </div>
                <div className="office-list-table-cell-stack office-signatures-context-cell">
                  <strong>{getContextTypeLabel(row.contextType, t)}</strong>
                  {row.transactionHref ? <p><Link href={row.transactionHref}>{row.transactionLabel}</Link></p> : <p>{row.contextLabel || "—"}</p>}
                  {row.subjectLabel && row.subjectLabel !== "—" ? <p>{`${t((messages) => messages.officeSignatures.subject)} · ${row.subjectLabel}`}</p> : null}
                </div>
                <span className="office-list-table-wrap-cell">{row.requestedByLabel}</span>
                <div className="office-list-table-cell-stack office-signatures-recipients-cell">
                  <strong className="office-signatures-recipients-primary">{row.recipientsLabel || t((messages) => messages.officeSignatures.noSignerAssignedYet)}</strong>
                  <p>{buildRoleSummary(row, t)}</p>
                </div>
                <StatusBadge className="office-list-table-status" tone={getStatusTone(row.statusKey)}>
                  {getSignatureStatusLabel(row.statusKey, t)}
                </StatusBadge>
                <div className="office-list-table-cell-stack office-signatures-drive-cell">
                  <StatusBadge tone={getDriveTone(row.driveSyncStatus)}>{getDriveStatusLabel(row.driveSyncStatus, t)}</StatusBadge>
                  {row.completedDocumentHref ? (
                    <div className="office-signatures-drive-actions">
                      <Link className="office-button-secondary office-button-sm" href={row.completedDocumentHref} target="_blank">
                        {t((messages) => messages.officeSignatures.signedPdf)}
                      </Link>
                      {row.driveSyncStatus === "failed" && canManageSignatures ? (
                        <Button
                          disabled={pendingRetryId === row.id}
                          onClick={() => retryDriveSync(row.id)}
                          size="sm"
                          variant="secondary"
                        >
                          {pendingRetryId === row.id ? t((messages) => messages.officeSignatures.retryingDrive) : t((messages) => messages.officeSignatures.retryDrive)}
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
                      {t((messages) => messages.officeSignatures.openTemplateLibrary)}
                    </Link>
                  ) : null
                }
                description={t((messages) => messages.officeSignatures.noRequestsMatchedBody)}
                title={t((messages) => messages.officeSignatures.noRequestsMatchedTitle)}
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>
    </>
  );
}
