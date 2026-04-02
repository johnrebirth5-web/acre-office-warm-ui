"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FilterField,
  FormField,
  ListPageFilters,
  ListPageFooter,
  SelectInput,
  StatusBadge,
  SummaryChip,
  TextareaInput,
  TextInput,
} from "@acre/ui";
import type { OfficeContactFieldSchema, OfficeContactRecord } from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate,
} from "../_components/office-list-page-template";

type ContactsClientProps = {
  contacts: OfficeContactRecord[];
  schema: OfficeContactFieldSchema;
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filters: {
    q: string;
    stage: string;
  };
};

const stageOptions = ["All", "Warm", "Tour booked", "Nurture", "New"] as const;
const pageSizeOptions = [10, 20, 50, 100] as const;
const contactCreateDefaults: Record<string, string> = {
  source: "Manual entry",
  stage: "New",
  intent: "Unknown",
};

type ContactVisibleField =
  | { kind: "builtIn"; field: OfficeContactFieldSchema["builtInFields"][number] }
  | { kind: "custom"; field: OfficeContactFieldSchema["customFields"][number] };

function sortSchemaFieldEntries(fields: ContactVisibleField[]) {
  return [...fields].sort((left, right) => {
    if (left.field.sortOrder !== right.field.sortOrder) {
      return left.field.sortOrder - right.field.sortOrder;
    }

    return left.field.label.localeCompare(right.field.label);
  });
}

function buildContactCreateValues(schema: OfficeContactFieldSchema) {
  const values: Record<string, string> = {};

  for (const field of schema.builtInFields) {
    values[field.inputName] = contactCreateDefaults[field.inputName] ?? "";
  }

  for (const field of schema.customFields) {
    values[field.inputName] = "";
  }

  return values;
}

function getContactFieldLabel(label: string, isRequired: boolean) {
  return isRequired ? `${label} *` : label;
}

function getContactModalFieldClassName(fieldClassName: string) {
  return fieldClassName.includes("is-span-4")
    ? "office-form-field office-form-grid-span-2"
    : "office-form-field";
}

function getContactStageTone(stage: string) {
  if (stage === "Tour booked") {
    return "accent" as const;
  }

  if (stage === "Warm") {
    return "warning" as const;
  }

  if (stage === "Nurture") {
    return "neutral" as const;
  }

  return "success" as const;
}

function normalizeStageFilter(value: string): (typeof stageOptions)[number] {
  return stageOptions.includes(value as (typeof stageOptions)[number])
    ? (value as (typeof stageOptions)[number])
    : "All";
}

function buildContactPrimaryMeta(contact: OfficeContactRecord) {
  const primaryValues = [contact.email, contact.phone, contact.source]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return primaryValues.length > 0
    ? primaryValues.join(" · ")
    : "No direct contact info recorded";
}

function buildContactsHref(
  pathname: string,
  params: {
    q: string;
    stage: string;
    page: number;
    pageSize: number;
  },
) {
  const searchParams = new URLSearchParams();

  if (params.q.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.stage && params.stage !== "All") {
    searchParams.set("stage", params.stage);
  }

  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.pageSize !== 20) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ContactsClient({
  contacts,
  schema,
  totalCount,
  totalPages,
  page,
  pageSize,
  filters,
}: ContactsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [stageFilter, setStageFilter] = useState<(typeof stageOptions)[number]>(
    normalizeStageFilter(filters.stage),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createValues, setCreateValues] = useState<Record<string, string>>(() =>
    buildContactCreateValues(schema),
  );

  useEffect(() => {
    setSearchQuery(filters.q);
    setStageFilter(normalizeStageFilter(filters.stage));
  }, [filters.q, filters.stage]);

  useEffect(() => {
    setCreateValues(buildContactCreateValues(schema));
  }, [schema]);

  const visibleFields: ContactVisibleField[] = sortSchemaFieldEntries([
    ...schema.builtInFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "builtIn" as const, field })),
    ...schema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "custom" as const, field })),
  ]);

  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const currentStageLabel = stageFilter === "All" ? "All stages" : stageFilter;

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildContactsHref(pathname, {
        q: searchQuery,
        stage: stageFilter,
        page: 1,
        pageSize,
      }),
    );
  }

  function handleResetFilters() {
    setSearchQuery("");
    setStageFilter("All");
    router.push(
      buildContactsHref(pathname, {
        q: "",
        stage: "All",
        page: 1,
        pageSize,
      }),
    );
  }

  function handlePageSizeChange(nextPageSize: number) {
    router.push(
      buildContactsHref(pathname, {
        q: searchQuery,
        stage: stageFilter,
        page: 1,
        pageSize: nextPageSize,
      }),
    );
  }

  function setCreateValue(fieldName: string, value: string) {
    setCreateValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/office/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createValues),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create contact.");
      }

      setIsModalOpen(false);
      setCreateValues(buildContactCreateValues(schema));
      router.push(
        buildContactsHref(pathname, {
          q: searchQuery,
          stage: stageFilter,
          page: 1,
          pageSize,
        }),
      );
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create contact.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const contactFilters = (
    <ListPageFilters
      as="form"
      className="office-contacts-toolbar"
      onSubmit={handleFilterSubmit}
    >
      <FilterField className="office-contacts-search-field" label="Search">
        <TextInput
          aria-label="Search contacts"
          className="office-contacts-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, email, phone, area..."
          value={searchQuery}
        />
      </FilterField>

      <FilterField className="office-contacts-stage-field" label="Current view">
        <SelectInput
          onChange={(event) =>
            setStageFilter(event.target.value as (typeof stageOptions)[number])
          }
          value={stageFilter}
        >
          {stageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </FilterField>

      <div className="office-filter-actions">
        <Button type="submit">Apply filters</Button>
        <Button onClick={handleResetFilters} type="button" variant="secondary">
          Reset
        </Button>
      </div>
    </ListPageFilters>
  );

  const contactFooter = (
    <ListPageFooter
      controls={
        <OfficeListPagePagination
          nextHref={
            page < totalPages
              ? buildContactsHref(pathname, {
                  q: filters.q,
                  stage: filters.stage,
                  page: page + 1,
                  pageSize,
                })
              : undefined
          }
          onPageSizeChange={handlePageSizeChange}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          previousHref={
            page > 1
              ? buildContactsHref(pathname, {
                  q: filters.q,
                  stage: filters.stage,
                  page: page - 1,
                  pageSize,
                })
              : undefined
          }
          totalPages={totalPages}
        />
      }
      summary={`${pageStart}-${pageEnd} of ${totalCount}`}
    />
  );

  const contactSummary = (
    <>
      <SummaryChip label="Contacts" value={totalCount} />
      <SummaryChip
        label="Current view"
        tone="accent"
        value={currentStageLabel}
      />
      <div className="office-page-summary-action">
        <Button onClick={() => setIsModalOpen(true)} type="button">
          New contact
        </Button>
      </div>
    </>
  );

  return (
    <>
      <OfficeListPageTemplate
        className="office-contacts-page"
        description="Operational contact list with organization-scoped search, stage views, and follow-up visibility across the current office."
        eyebrow="Contacts"
        filters={contactFilters}
        footer={contactFooter}
        sectionSubtitle="Search, filter, and review the current office contact set."
        sectionTitle="Contact list"
        summary={contactSummary}
        title="Contacts"
      >
        <DataTable className="office-list-table office-list-table-wide office-contacts-table">
          <DataTableHeader className="office-list-table-header office-list-table-header-contacts">
            <span>Contact</span>
            <span>Stage</span>
            <span>Intent / budget</span>
            <span>Preferred areas</span>
            <span>Last contact</span>
            <span>Next follow-up</span>
          </DataTableHeader>
          <DataTableBody className="office-list-table-body">
            {contacts.map((contact) => (
              <DataTableRow
                className="office-list-table-row office-list-table-row-contacts"
                key={contact.id}
              >
                <div className="office-list-table-main">
                  <strong>
                    <Link href={`/office/contacts/${contact.id}`}>
                      {contact.fullName}
                    </Link>
                  </strong>
                  <p>{buildContactPrimaryMeta(contact)}</p>
                  {contact.contactType || contact.owner ? (
                    <div className="office-list-table-main-meta">
                      {contact.contactType ? (
                        <span>{contact.contactType}</span>
                      ) : null}
                      {contact.owner ? <span>{contact.owner}</span> : null}
                    </div>
                  ) : null}
                </div>
                <StatusBadge
                  className="office-list-table-status"
                  tone={getContactStageTone(contact.stage)}
                >
                  {contact.stage}
                </StatusBadge>
                <div className="office-list-table-cell-stack">
                  <strong>{contact.intent || "—"}</strong>
                  <p>{contact.budget}</p>
                </div>
                <div className="office-list-table-wrap-cell">
                  {contact.areas.join(", ") || "—"}
                </div>
                <span>{contact.lastContactLabel}</span>
                <span>{contact.nextFollowUpLabel}</span>
              </DataTableRow>
            ))}
            {contacts.length === 0 ? (
              <EmptyState
                description="Try widening the search or resetting the stage filter."
                title="No contacts matched the current filters"
              />
            ) : null}
          </DataTableBody>
        </DataTable>
      </OfficeListPageTemplate>

      {isModalOpen ? (
        <div className="office-modal-overlay office-create-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <section
            className="office-modal office-create-modal office-contact-create-modal office-contact-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="office-modal-header office-create-modal-header">
              <div className="office-modal-title-block office-create-modal-title-block">
                <span className="office-create-modal-kicker">Contacts</span>
                <h3>Create contact</h3>
                <p>Add a lead or client profile with the current office contact schema so follow-up can start immediately.</p>
              </div>
              <Button
                aria-label="Close create contact modal"
                onClick={() => setIsModalOpen(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Close
              </Button>
            </header>

            <form
              className="office-modal-body office-create-modal-body office-contact-create-body"
              onSubmit={handleCreateContact}
            >
              <section className="office-create-modal-section office-contact-create-section">
                <div className="office-create-modal-section-head">
                  <h4>Contact details</h4>
                  <p>Capture the person&apos;s core identity, current stage, and follow-up context using the shared office contact schema.</p>
                </div>

                <div className="office-form-grid office-contact-create-grid">
                  {visibleFields.map((entry) => {
                    const field = entry.field;
                    const fieldType =
                      entry.kind === "builtIn" ? entry.field.control : entry.field.type;
                    const fieldClassName =
                      entry.kind === "builtIn" ? entry.field.className : "";

                    return (
                      <FormField
                        className={getContactModalFieldClassName(fieldClassName)}
                        key={`${entry.kind}:${field.fieldKey}`}
                        label={getContactFieldLabel(field.label, field.isRequired)}
                      >
                        {fieldType === "textarea" ? (
                          <TextareaInput
                            name={field.inputName}
                            onChange={(event) =>
                              setCreateValue(field.inputName, event.target.value)
                            }
                            rows={4}
                            value={createValues[field.inputName] ?? ""}
                          />
                        ) : fieldType === "select" ? (
                          <SelectInput
                            name={field.inputName}
                            onChange={(event) =>
                              setCreateValue(field.inputName, event.target.value)
                            }
                            value={createValues[field.inputName] ?? ""}
                          >
                            <option value="">Select...</option>
                            {field.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </SelectInput>
                        ) : (
                          <TextInput
                            name={field.inputName}
                            onChange={(event) =>
                              setCreateValue(field.inputName, event.target.value)
                            }
                            type={
                              fieldType === "date"
                                ? "date"
                                : field.inputName === "email"
                                  ? "email"
                                  : "text"
                            }
                            value={createValues[field.inputName] ?? ""}
                          />
                        )}
                      </FormField>
                    );
                  })}
                </div>
              </section>

              {submitError ? <p className="office-inline-error office-contact-create-feedback">{submitError}</p> : null}

              <footer className="office-modal-footer office-create-modal-footer">
                <div className="office-create-modal-footer-copy">
                  <strong>Save the profile to start office follow-up</strong>
                  <p>Contact fields stay aligned with the centralized schema in Settings, so the roster and detail pages remain consistent.</p>
                </div>

                <div className="office-modal-actions office-contact-create-actions">
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Saving..." : "Create contact"}
                  </Button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
