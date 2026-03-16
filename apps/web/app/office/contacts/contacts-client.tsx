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
  ListPageFilters,
  ListPageFooter,
  SelectInput,
  StatusBadge,
  SummaryChip,
  TextInput,
} from "@acre/ui";
import type { OfficeContactRecord } from "@acre/db";
import {
  OfficeListPagePagination,
  OfficeListPageTemplate,
} from "../_components/office-list-page-template";

type ContactsClientProps = {
  contacts: OfficeContactRecord[];
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
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    setSearchQuery(filters.q);
    setStageFilter(normalizeStageFilter(filters.stage));
  }, [filters.q, filters.stage]);

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

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/office/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create contact.");
      }

      setIsModalOpen(false);
      setFormVersion((current) => current + 1);
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
      className="bm-contacts-toolbar"
      onSubmit={handleFilterSubmit}
    >
      <FilterField className="bm-contacts-search-field" label="Search">
        <TextInput
          aria-label="Search contacts"
          className="bm-contacts-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, email, phone, area..."
          value={searchQuery}
        />
      </FilterField>

      <FilterField className="bm-contacts-stage-field" label="Current view">
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
      <Button
        className="office-list-page-primary-action"
        onClick={() => setIsModalOpen(true)}
        type="button"
      >
        New contact
      </Button>
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
        <DataTable className="office-list-table office-list-table-wide bm-contacts-table">
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
        <div className="bm-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <section
            className="bm-transaction-modal bm-contact-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="bm-transaction-modal-header">
              <h3>NEW CONTACT</h3>
              <button
                aria-label="Close create contact modal"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>

            <form
              className="bm-transaction-modal-body"
              key={formVersion}
              onSubmit={handleCreateContact}
            >
              <div className="bm-contact-form-grid">
                <label className="bm-transaction-modal-field">
                  <span>Full name</span>
                  <input name="fullName" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Email</span>
                  <input name="email" type="email" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Phone</span>
                  <input name="phone" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Contact type</span>
                  <input name="contactType" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Source</span>
                  <input name="source" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Stage</span>
                  <input defaultValue="New" name="stage" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Intent</span>
                  <input name="intent" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Budget min</span>
                  <input name="budgetMin" type="text" />
                </label>
                <label className="bm-transaction-modal-field">
                  <span>Budget max</span>
                  <input name="budgetMax" type="text" />
                </label>
                <label className="bm-transaction-modal-field is-span-4">
                  <span>Preferred areas (comma separated)</span>
                  <input name="preferredAreas" type="text" />
                </label>
                <label className="bm-transaction-modal-field is-span-4">
                  <span>Notes</span>
                  <input name="notes" type="text" />
                </label>
              </div>

              <footer className="bm-transaction-modal-footer">
                <span>Minimal contact create flow</span>
                <div className="bm-transaction-modal-actions">
                  {submitError ? (
                    <p className="bm-transaction-submit-error">{submitError}</p>
                  ) : null}
                  <button
                    className="bm-transaction-next"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? "Saving..." : "Save contact"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
