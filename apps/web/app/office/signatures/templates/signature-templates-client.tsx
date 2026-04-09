"use client";

import Link from "next/link";
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
  ListPageStatsGrid,
  ListPageTableSection,
  SecondaryMetaList,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeSignatureTemplate, OfficeSignatureTemplateLibrarySnapshot } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";
import type { TranslationSelector, TranslationVariables } from "../../../../lib/i18n";

type SignatureTemplatesClientProps = {
  snapshot: OfficeSignatureTemplateLibrarySnapshot;
  canManageSignatures: boolean;
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

type LibraryFilterState = {
  query: string;
  category: "all" | "transaction" | "hr" | "finance" | "admin";
  status: "all" | "active" | "inactive" | "live_drafts" | "unused";
};

type TranslateFn = (
  selector: TranslationSelector,
  values?: TranslationVariables,
) => string;

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

function buildSnapshotSummary(templates: OfficeSignatureTemplate[]) {
  return {
    totalCount: templates.length,
    activeCount: templates.filter((template) => template.isActive).length,
    inactiveCount: templates.filter((template) => !template.isActive).length,
    nonTransactionCount: templates.filter((template) => template.category !== "transaction").length,
    usedCount: templates.filter((template) => template.usage.totalCount > 0).length,
    templatesWithLiveDraftsCount: templates.filter((template) => template.usage.draftCount > 0).length
  };
}

function getTemplateTone(isActive: boolean) {
  return isActive ? ("success" as const) : ("neutral" as const);
}

function getRequestTone(statusKey: string) {
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

function getLatestRequestActionLabel(template: OfficeSignatureTemplate, t: TranslateFn) {
  if (!template.latestRequest) {
    return "";
  }

  if (template.latestRequest.statusKey === "draft" || template.latestRequest.statusKey === "pending_send") {
    return t((messages) => messages.officeSignatureTemplates.continueLatestDraft);
  }

  return t((messages) => messages.officeSignatureTemplates.openLatestRequest);
}

function getReuseActionLabel(template: OfficeSignatureTemplate, t: TranslateFn) {
  if (!template.latestRequest?.reuseHref) {
    return "";
  }

  if (template.usage.totalCount > 0) {
    return t((messages) => messages.officeSignatureTemplates.reuseLatestSourcePdf);
  }

  return t((messages) => messages.officeSignatureTemplates.useTemplate);
}

export function SignatureTemplatesClient({
  snapshot,
  canManageSignatures
}: SignatureTemplatesClientProps) {
  const { t } = useI18n();
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [editorState, setEditorState] = useState<EditorState>(() => buildEditorState(snapshot));
  const [filterState, setFilterState] = useState<LibraryFilterState>({
    query: "",
    category: "all",
    status: "all"
  });
  const [pendingAction, setPendingAction] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedTemplate = useMemo(
    () => currentSnapshot.templates.find((template) => template.id === editorState.templateId) ?? null,
    [currentSnapshot.templates, editorState.templateId]
  );

  const filteredTemplates = useMemo(() => {
    const query = filterState.query.trim().toLowerCase();

    return currentSnapshot.templates.filter((template) => {
      if (filterState.category !== "all" && template.category !== filterState.category) {
        return false;
      }

      if (filterState.status === "active" && !template.isActive) {
        return false;
      }

      if (filterState.status === "inactive" && template.isActive) {
        return false;
      }

      if (filterState.status === "live_drafts" && template.usage.draftCount === 0) {
        return false;
      }

      if (filterState.status === "unused" && template.usage.totalCount > 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        template.name,
        template.description,
        template.categoryLabel,
        template.emailSubject,
        template.senderDisplayName,
        template.latestRequest?.title ?? "",
        template.latestRequest?.transactionLabel ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [currentSnapshot.templates, filterState]);

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
      setError(t((messages) => messages.officeSignatureTemplates.selectTemplateFirst));
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
      const payload = (await response.json().catch(() => null)) as { template?: OfficeSignatureTemplate; error?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error || t((messages) => messages.officeSignatureTemplates.failedToSave));
      }

      const nextTemplates = currentSnapshot.templates.map((template) =>
        template.id === payload.template!.id ? payload.template! : template
      );

      setCurrentSnapshot({
        summary: buildSnapshotSummary(nextTemplates),
        capabilities: currentSnapshot.capabilities,
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
      setSuccessMessage(t((messages) => messages.officeSignatureTemplates.templateUpdated));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t((messages) => messages.officeSignatureTemplates.failedToSave));
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <>
      <ListPageStatsGrid>
        <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsActiveHint)} label={t((messages) => messages.officeSignatureTemplates.active)} tone="accent" value={currentSnapshot.summary.activeCount} />
        <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsInactiveHint)} label={t((messages) => messages.common.inactive)} value={currentSnapshot.summary.inactiveCount} />
        <StatCard
          hint={t((messages) => messages.officeSignatureTemplates.statsNonTransactionHint)}
          label={t((messages) => messages.officeSignatureTemplates.nonTransaction)}
          value={currentSnapshot.summary.nonTransactionCount}
        />
        <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsUsedHint)} label={t((messages) => messages.officeSignatureTemplates.usedAtLeastOnce)} value={currentSnapshot.summary.usedCount} />
        <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsLiveDraftsHint)} label={t((messages) => messages.officeSignatureTemplates.liveDrafts)} value={currentSnapshot.summary.templatesWithLiveDraftsCount} />
      </ListPageStatsGrid>

      <ListPageSection
        subtitle={t((messages) => messages.officeSignatureTemplates.libraryControlsSubtitle)}
        title={t((messages) => messages.officeSignatureTemplates.libraryControlsTitle)}
      >
        <div className="office-form-grid">
          <FormField label={t((messages) => messages.common.search)}>
            <TextInput
              onChange={(event) => setFilterState((current) => ({ ...current, query: event.target.value }))}
              placeholder={t((messages) => messages.officeSignatureTemplates.searchPlaceholder)}
              value={filterState.query}
            />
          </FormField>

          <FormField label={t((messages) => messages.officeSignatureTemplates.categoryLabel)}>
            <SelectInput
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  category: event.target.value as LibraryFilterState["category"]
                }))
              }
              value={filterState.category}
            >
              <option value="all">{t((messages) => messages.officeSignatures.allCategories)}</option>
              <option value="transaction">{t((messages) => messages.officeSignatures.transactionCategory)}</option>
              <option value="hr">{t((messages) => messages.officeSignatures.hrCategory)}</option>
              <option value="finance">{t((messages) => messages.officeSignatures.financeCategory)}</option>
              <option value="admin">{t((messages) => messages.officeSignatures.adminCategory)}</option>
            </SelectInput>
          </FormField>

          <FormField label={t((messages) => messages.officeSignatureTemplates.statusLabel)}>
            <SelectInput
              onChange={(event) =>
                setFilterState((current) => ({
                  ...current,
                  status: event.target.value as LibraryFilterState["status"]
                }))
              }
              value={filterState.status}
            >
              <option value="all">{t((messages) => messages.officeSignatureTemplates.allTemplates)}</option>
              <option value="active">{t((messages) => messages.officeSignatureTemplates.activeOnly)}</option>
              <option value="inactive">{t((messages) => messages.officeSignatureTemplates.inactiveOnly)}</option>
              <option value="live_drafts">{t((messages) => messages.officeSignatureTemplates.withLiveDrafts)}</option>
              <option value="unused">{t((messages) => messages.officeSignatureTemplates.neverUsed)}</option>
            </SelectInput>
          </FormField>

          <div className="office-filter-actions office-form-grid-span-2 office-signatures-filter-actions">
            <Button
              onClick={() =>
                setFilterState({
                  query: "",
                  category: "all",
                  status: "all"
                })
              }
              type="button"
              variant="secondary"
            >
              {t((messages) => messages.officeSignatureTemplates.clearFilters)}
            </Button>
            <Link className="office-button-secondary" href="/office/signatures">
              {t((messages) => messages.officeSignatureTemplates.openSignaturesCenter)}
            </Link>
          </div>
        </div>

        <p className="office-form-helper">
          {t((messages) => messages.officeSignatureTemplates.showingTemplates, {
            note: t((messages) => messages.officeSignatureTemplates.genericCategoryNote),
            filtered: filteredTemplates.length,
            total: currentSnapshot.summary.totalCount,
          })}
        </p>
      </ListPageSection>

      <ListPageTableSection
        className="office-list-card"
        subtitle={t((messages) => messages.officeSignatureTemplates.tableSubtitle)}
        title={t((messages) => messages.officeSignatureTemplates.tableTitle)}
      >
        <DataTable className="office-list-table office-list-table-reports">
          <DataTableHeader className="office-list-table-header office-list-table-header-reports">
            <span>{t((messages) => messages.officeSignatureTemplates.tableTemplate)}</span>
            <span>{t((messages) => messages.officeSignatureTemplates.tableCategory)}</span>
            <span>{t((messages) => messages.officeSignatureTemplates.tableStructure)}</span>
            <span>{t((messages) => messages.officeSignatureTemplates.tableLiveQueue)}</span>
            <span>{t((messages) => messages.officeSignatureTemplates.tableStatus)}</span>
            <span>{t((messages) => messages.officeSignatureTemplates.tableUpdated)}</span>
          </DataTableHeader>

          <DataTableBody className="office-list-table-body">
            {filteredTemplates.map((template) => (
              <DataTableRow className="office-list-table-row office-list-table-row-reports" key={template.id}>
                <div className="office-list-table-main">
                  <strong>
                    <button className="office-toggle-link" onClick={() => selectTemplate(template.id)} type="button">
                      {template.name}
                    </button>
                  </strong>
                  <p>{template.description || t((messages) => messages.officeSignatureTemplates.noDescription)}</p>
                  <div className="office-list-table-main-meta">
                    <span>{template.createdByLabel}</span>
                    <span>{t((messages) => messages.officeSignatureTemplates.version, { value: template.version })}</span>
                    {canManageSignatures && template.latestRequest?.requestHref ? (
                      <span>
                        <Link className="office-toggle-link" href={template.latestRequest.requestHref}>
                          {getLatestRequestActionLabel(template, t)}
                        </Link>
                      </span>
                    ) : null}
                    {canManageSignatures && template.latestRequest?.reuseHref ? (
                      <span>
                        <Link className="office-toggle-link" href={template.latestRequest.reuseHref}>
                          {getReuseActionLabel(template, t)}
                        </Link>
                      </span>
                    ) : null}
                  </div>
                </div>
                <span>{getTemplateCategoryLabel(template.category, t)}</span>
                <div className="office-list-table-cell-stack">
                  <strong>{t((messages) => messages.officeSignatureTemplates.rolesCount, { count: template.recipients.length })}</strong>
                  <p>{t((messages) => messages.officeSignatureTemplates.fieldsCount, { count: template.fields.length })}</p>
                </div>
                <div className="office-list-table-cell-stack">
                  <strong>{template.usage.totalCount ? t((messages) => messages.officeSignatureTemplates.totalUses, { count: template.usage.totalCount }) : t((messages) => messages.officeSignatureTemplates.noLiveUsage)}</strong>
                  <p>{t((messages) => messages.officeSignatureTemplates.usageBreakdown, {
                    drafts: template.usage.draftCount,
                    inFlight: template.usage.inFlightCount,
                    completed: template.usage.completedCount,
                  })}</p>
                </div>
                <StatusBadge tone={getTemplateTone(template.isActive)}>{template.isActive ? t((messages) => messages.common.active) : t((messages) => messages.common.inactive)}</StatusBadge>
                <span>{template.updatedAt || "—"}</span>
              </DataTableRow>
            ))}

            {filteredTemplates.length === 0 ? (
              <EmptyState
                description={t((messages) => messages.officeSignatureTemplates.noTemplatesMatchedBody)}
                title={t((messages) => messages.officeSignatureTemplates.noTemplatesMatchedTitle)}
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </ListPageTableSection>

      {selectedTemplate ? (
        <ListPageSection
          subtitle={t((messages) => messages.officeSignatureTemplates.selectedTemplateSubtitle)}
          title={t((messages) => messages.officeSignatureTemplates.selectedTemplateTitle)}
        >
          {error ? <p className="office-inline-error">{error}</p> : null}
          {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}

          <ListPageStatsGrid>
            <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsRecipientRolesHint)} label={t((messages) => messages.officeSignatureTemplates.recipientRoles)} tone="accent" value={selectedTemplate.recipients.length} />
            <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsFieldsHint)} label={t((messages) => messages.officeSignatureTemplates.fieldsLabel)} value={selectedTemplate.fields.length} />
            <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsLiveDraftsSelectedHint)} label={t((messages) => messages.officeSignatureTemplates.liveDrafts)} value={selectedTemplate.usage.draftCount} />
            <StatCard hint={t((messages) => messages.officeSignatureTemplates.statsTotalUsesHint)} label={t((messages) => messages.officeSignatureTemplates.totalUsesLabel)} value={selectedTemplate.usage.totalCount} />
          </ListPageStatsGrid>

          <p className="office-form-helper">
            {t((messages) => messages.officeSignatureTemplates.selectedTemplateHelper)}
          </p>

          <SecondaryMetaList
            items={[
              {
                label: t((messages) => messages.officeSignatureTemplates.metaCategory),
                value: getTemplateCategoryLabel(selectedTemplate.category, t)
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaSupportedCategories),
                value: currentSnapshot.capabilities.supportedCategories.map((category) => getTemplateCategoryLabel(category.key, t)).join(" · ")
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaGenericCategory),
                value: t((messages) => messages.officeSignatureTemplates.genericCategoryNote)
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaCreatedBy),
                value: selectedTemplate.createdByLabel
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaLatestLiveRequest),
                value: selectedTemplate.latestRequest ? (
                  canManageSignatures && selectedTemplate.latestRequest.requestHref ? (
                    <Link href={selectedTemplate.latestRequest.requestHref}>{selectedTemplate.latestRequest.title}</Link>
                  ) : (
                    selectedTemplate.latestRequest.title
                  )
                ) : (
                  t((messages) => messages.officeSignatureTemplates.noTemplateRequestYet)
                )
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaLatestRequestStatus),
                value: selectedTemplate.latestRequest ? (
                  <StatusBadge tone={getRequestTone(selectedTemplate.latestRequest.statusKey)}>
                    {getSignatureStatusLabel(selectedTemplate.latestRequest.statusKey, t)}
                  </StatusBadge>
                ) : (
                  "—"
                )
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaLatestTransaction),
                value: selectedTemplate.latestRequest?.transactionHref ? (
                  <Link href={selectedTemplate.latestRequest.transactionHref}>{selectedTemplate.latestRequest.transactionLabel}</Link>
                ) : (
                  "—"
                )
              },
              {
                label: t((messages) => messages.officeSignatureTemplates.metaLatestActivity),
                value: selectedTemplate.latestRequest?.updatedAt || selectedTemplate.updatedAt || "—"
              }
            ]}
          />

          <div className="office-settings-actions">
            {canManageSignatures && selectedTemplate.latestRequest?.requestHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.requestHref}>
                {getLatestRequestActionLabel(selectedTemplate, t)}
              </Link>
            ) : null}
            {canManageSignatures && selectedTemplate.latestRequest?.reuseHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.reuseHref}>
                {getReuseActionLabel(selectedTemplate, t)}
              </Link>
            ) : null}
            {selectedTemplate.latestRequest?.transactionHref ? (
              <Link className="office-button-secondary" href={selectedTemplate.latestRequest.transactionHref}>
                {t((messages) => messages.officeSignatureTemplates.openTransaction)}
              </Link>
            ) : null}
            <Link className="office-button-secondary" href={`/office/signatures?category=${selectedTemplate.category}`}>
              {t((messages) => messages.officeSignatureTemplates.openCategoryQueue, {
                category: getTemplateCategoryLabel(selectedTemplate.category, t),
              })}
            </Link>
          </div>

          <form className="office-form-grid" onSubmit={handleSave}>
            <FormField label={t((messages) => messages.officeSignatureTemplates.selectedTemplateLabel)}>
              <SelectInput onChange={(event) => selectTemplate(event.target.value)} value={editorState.templateId}>
                {currentSnapshot.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label={t((messages) => messages.officeSignatureTemplates.categoryLabel)}>
              <SelectInput
                onChange={(event) =>
                  setEditorState((current) => ({
                    ...current,
                    category: event.target.value as EditorState["category"]
                  }))
                }
                value={editorState.category}
              >
                <option value="transaction">{t((messages) => messages.officeSignatures.transactionCategory)}</option>
                <option value="hr">{t((messages) => messages.officeSignatures.hrCategory)}</option>
                <option value="finance">{t((messages) => messages.officeSignatures.financeCategory)}</option>
                <option value="admin">{t((messages) => messages.officeSignatures.adminCategory)}</option>
              </SelectInput>
            </FormField>

            <FormField label={t((messages) => messages.officeSignatureTemplates.templateName)}>
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, name: event.target.value }))} value={editorState.name} />
            </FormField>

            <div className="office-detail-field">
              <label className="office-detail-label">{t((messages) => messages.officeSignatureTemplates.activeTemplateLabel)}</label>
              <input
                checked={editorState.isActive}
                onChange={(event) => setEditorState((current) => ({ ...current, isActive: event.target.checked }))}
                type="checkbox"
              />
            </div>

            <FormField className="office-detail-field-wide" label={t((messages) => messages.officeLibrary.descriptionLabel)}>
              <TextareaInput onChange={(event) => setEditorState((current) => ({ ...current, description: event.target.value }))} rows={3} value={editorState.description} />
            </FormField>

            <FormField className="office-detail-field-wide" label={t((messages) => messages.officeSignatureTemplates.emailSubject)}>
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, emailSubject: event.target.value }))} value={editorState.emailSubject} />
            </FormField>

            <FormField className="office-detail-field-wide" label={t((messages) => messages.officeSignatureTemplates.emailBody)}>
              <TextareaInput onChange={(event) => setEditorState((current) => ({ ...current, emailBody: event.target.value }))} rows={4} value={editorState.emailBody} />
            </FormField>

            <FormField label={t((messages) => messages.officeSignatureTemplates.senderDisplayName)}>
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, senderDisplayName: event.target.value }))} value={editorState.senderDisplayName} />
            </FormField>

            <FormField label={t((messages) => messages.officeSignatureTemplates.replyToEmail)}>
              <TextInput onChange={(event) => setEditorState((current) => ({ ...current, senderReplyTo: event.target.value }))} type="email" value={editorState.senderReplyTo} />
            </FormField>

            <div className="office-settings-actions">
              <Button disabled={pendingAction} type="submit">
                {pendingAction ? t((messages) => messages.officeSignatureTemplates.savingTemplate) : t((messages) => messages.officeSignatureTemplates.saveTemplate)}
              </Button>
            </div>
          </form>
        </ListPageSection>
      ) : null}
    </>
  );
}
