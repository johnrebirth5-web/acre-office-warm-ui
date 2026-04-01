import Link from "next/link";
import { canAccessOffice1099Tracker } from "@acre/auth";
import { getOffice1099SummaryDetail } from "@acre/db";
import {
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  HorizontalScrollArea,
  SectionCard,
  StatusBadge,
  SummaryChip
} from "@acre/ui";
import { notFound, redirect } from "next/navigation";
import { requireOfficeSession } from "../../../../../lib/auth-session";
import { OfficeDetailPageHeader, OfficeDetailPageShell } from "../../../_components/office-detail-page-template";

type Office1099PreviewPageProps = {
  params: Promise<{
    membershipId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return value;
}

export default async function Office1099PreviewPage(props: Office1099PreviewPageProps) {
  const context = await requireOfficeSession();

  if (!canAccessOffice1099Tracker(context.currentMembership)) {
    redirect("/office/dashboard");
  }

  const { membershipId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const taxYear = readSearchParamValue(searchParams.taxYear);
  const detail = await getOffice1099SummaryDetail({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    membershipId,
    taxYear: taxYear ?? ""
  });

  if (!detail) {
    notFound();
  }

  return (
    <OfficeDetailPageShell className="office-1099-preview-page">
      <OfficeDetailPageHeader
        description="Internal 1099 summary / backup document preview built from saved payment records and the current agent payout profile."
        eyebrow="1099 Tracker"
        summary={
          <>
            <SummaryChip label="Tax year" tone="accent" value={detail.taxYear} />
            <SummaryChip label="Payment lines" value={detail.paymentRecords.length} />
            <SummaryChip label="Total paid" value={detail.totalPaidLabel} />
          </>
        }
        title={detail.displayName}
      />

      <SectionCard
        actions={
          <div className="office-section-actions office-1099-summary-actions">
            <Link className="office-button-secondary" href={`/office/1099-tracker?tab=summary&taxYear=${detail.taxYear}`}>
              Back to summary
            </Link>
            <a
              className="office-button-secondary"
              href={`/api/office/1099-tracker/summary/${detail.membershipId}/pdf?taxYear=${detail.taxYear}`}
              rel="noreferrer"
              target="_blank"
            >
              Export PDF
            </a>
          </div>
        }
        subtitle="The top section uses the agent's current 1099 profile fields. Missing items remain blank in the PDF export."
        title="1099 Payee Summary"
      >
        {detail.missingProfileFields.length > 0 ? (
          <div className="office-1099-warning">
            <StatusBadge tone="warning">Profile warning</StatusBadge>
            <p>Missing profile fields: {detail.missingProfileFields.join(", ")}.</p>
          </div>
        ) : null}

        <div className="office-detail-grid">
          <div className="office-detail-field">
            <span>Payee Name</span>
            <strong>{detail.payeeName || "—"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Tax ID</span>
            <strong>{detail.taxIdLabel || "—"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Contact Number</span>
            <strong>{detail.contactNumber || "—"}</strong>
          </div>
          <div className="office-detail-field office-detail-field-wide">
            <span>Address</span>
            <strong>{detail.address || "—"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Email</span>
            <strong>{detail.email || "—"}</strong>
          </div>
          <div className="office-detail-field">
            <span>Tax Year</span>
            <strong>{detail.taxYear}</strong>
          </div>
          <div className="office-detail-field">
            <span>Total Paid Amount</span>
            <strong>{detail.totalPaidLabel}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard subtitle="Each row below is sourced directly from the saved payment record batch for the selected tax year." title="Payment Records">
        <HorizontalScrollArea>
          <DataTable className="office-table">
            <DataTableHeader className="office-table-header office-table-row office-table-row-1099-preview">
              <span>Payment Date</span>
              <span>Payment Amount</span>
              <span>Memo</span>
            </DataTableHeader>
            <DataTableBody>
              {detail.paymentRecords.map((record) => (
                <DataTableRow className="office-table-row office-table-row-1099-preview" key={record.id}>
                  <span>{record.paymentDateLabel}</span>
                  <span>{record.paymentAmountLabel}</span>
                  <span>{record.memo || "—"}</span>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </HorizontalScrollArea>

        <div className="office-1099-total-row">
          <span>Total Paid</span>
          <strong>{detail.totalPaidLabel}</strong>
        </div>
      </SectionCard>
    </OfficeDetailPageShell>
  );
}
