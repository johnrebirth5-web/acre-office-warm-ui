"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OfficeAgentPayoutStatementDetail } from "@acre/db";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableHeader,
  DataTableRow,
  HorizontalScrollArea,
  SectionCard,
  StatCard,
  StatusBadge,
  TextareaInput,
} from "@acre/ui";
import { LocalDateTime } from "../../_components/local-date-time";

type PayoutStatementReviewClientProps = {
  statement: OfficeAgentPayoutStatementDetail;
};

type StatementBankField = {
  label: string;
  value: string;
  wide?: boolean;
};

function getReviewStatusTone(
  status: OfficeAgentPayoutStatementDetail["reviewStatus"],
) {
  if (status === "confirmed") {
    return "success" as const;
  }

  if (status === "revision_requested") {
    return "warning" as const;
  }

  if (status === "awaiting_agent") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function buildStatementBankFields(
  statement: OfficeAgentPayoutStatementDetail,
): StatementBankField[] {
  const bankInformation = statement.bankInformation;

  if (!bankInformation) {
    return [];
  }

  return [
    { label: "First name", value: bankInformation.firstName },
    { label: "Last name", value: bankInformation.lastName },
    { label: "Email", value: bankInformation.email },
    { label: "Phone number", value: bankInformation.phoneNumber },
    { label: "Address", value: bankInformation.address, wide: true },
    { label: "Bank name", value: bankInformation.bankName },
    { label: "Account number", value: bankInformation.accountNumber },
    { label: "Routing number", value: bankInformation.routingNumber },
    {
      label: "SSN / EIN",
      value: [bankInformation.taxIdTypeLabel, bankInformation.taxIdValue]
        .filter(Boolean)
        .join(" · "),
    },
    { label: "Date of birth", value: bankInformation.dateOfBirth },
    {
      label: "Account type",
      value: bankInformation.accountTypeLabel || bankInformation.accountType,
    },
  ].filter((field) => field.value.trim().length > 0);
}

function formatStatementCellValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : "—";
}

function StatementPostSplitCell({
  lineItem,
}: {
  lineItem: OfficeAgentPayoutStatementDetail["lineItems"][number];
}) {
  return (
    <div className="office-agent-statement-post-split">
      <strong>{lineItem.postSplitLabel}</strong>
      {lineItem.postSplitBreakdown.map((detail) => (
        <p key={`${lineItem.id}:${detail.feeTypeValue}`}>
          {detail.feeTypeLabel}: {detail.amountLabel}
        </p>
      ))}
    </div>
  );
}

export function PayoutStatementReviewClient({
  statement,
}: PayoutStatementReviewClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "confirm" | "request_revision" | ""
  >("");
  const bankFields = useMemo(
    () => buildStatementBankFields(statement),
    [statement],
  );
  const canReview = statement.reviewStatus === "awaiting_agent";
  const hasManualAdjustments =
    Number(statement.manualAdjustmentTotalValue) !== 0;

  async function handleReview(response: "confirm" | "request_revision") {
    if (response === "request_revision" && !message.trim()) {
      setError("Describe what should change before requesting a revision.");
      return;
    }

    setPendingAction(response);
    setError("");

    try {
      const request = await fetch(
        `/api/office/accounting/self-service/statements/${statement.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response,
            message,
          }),
        },
      );
      const payload = (await request.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!request.ok) {
        throw new Error(
          payload?.error ?? "Failed to submit the payout statement review.",
        );
      }

      setMessage("");
      startTransition(() => {
        router.refresh();
      });
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Failed to submit the payout statement review.",
      );
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div className="office-dashboard-primary-stack">
      <SectionCard
        subtitle={`${statement.periodBasisLabel} · ${statement.periodLabel}`}
        title="Statement summary"
      >
        <div className="office-kpi-grid office-commission-kpi-grid">
          <StatCard
            hint="current confirmation state"
            label="Review status"
            value={statement.reviewStatusLabel}
          />
          <StatCard
            hint="invoice-based payout subtotal"
            label="Invoice payout"
            value={statement.invoicePayoutTotalLabel}
          />
          <StatCard
            hint="manual adjustment total already applied by finance"
            label="Manual adjustments"
            value={statement.manualAdjustmentTotalLabel}
          />
          <StatCard
            hint="final statement total currently under review"
            label="Final payout"
            value={statement.totalStatementAmountLabel}
          />
        </div>

        <div className="office-inline-meta">
          <span>
            Generated:{" "}
            <LocalDateTime
              fallbackLabel={statement.generatedAtLabel}
              value={statement.generatedAt}
            />
          </span>
          <span>Generated by: {statement.generatedByLabel}</span>
          {statement.lastSharedAtLabel ? (
            <span>
              Last finance send:{" "}
              <LocalDateTime
                fallbackLabel={statement.lastSharedAtLabel}
                value={statement.lastSharedAt}
              />
            </span>
          ) : null}
          {statement.confirmedAtLabel ? (
            <span>
              Confirmed:{" "}
              <LocalDateTime
                fallbackLabel={statement.confirmedAtLabel}
                value={statement.confirmedAt}
              />
            </span>
          ) : null}
          <span>
            Status:{" "}
            <StatusBadge tone={getReviewStatusTone(statement.reviewStatus)}>
              {statement.reviewStatusLabel}
            </StatusBadge>
          </span>
        </div>
      </SectionCard>

      <SectionCard
        subtitle="The payout profile finance used for this statement snapshot."
        title="Payment information"
      >
        {bankFields.length > 0 ? (
          <div className="office-detail-grid">
            {bankFields.map((field) => (
              <div
                className={
                  field.wide
                    ? "office-detail-field office-detail-field-wide"
                    : "office-detail-field"
                }
                key={field.label}
              >
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="office-form-helper">
            Finance has not saved payment information on your member profile
            yet.
          </p>
        )}
      </SectionCard>

      <SectionCard
        subtitle={
          canReview
            ? "Confirm the statement if it looks correct, or explain exactly what finance should revise."
            : statement.reviewStatus === "revision_requested"
              ? "Finance has your revision request. They will reply here and resend the updated statement inside the system."
              : "This statement has already been finalized in the current review cycle."
        }
        title="Review actions"
      >
        <TextareaInput
          disabled={!canReview || pendingAction !== ""}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            canReview
              ? "Optional note for confirmation, or required details if you need finance to revise this statement."
              : "This statement is not currently waiting for your action."
          }
          rows={4}
          value={message}
        />
        <div className="office-section-actions">
          <Button
            disabled={!canReview || pendingAction !== ""}
            onClick={() => void handleReview("confirm")}
            type="button"
          >
            {pendingAction === "confirm"
              ? "Submitting..."
              : "Confirm statement"}
          </Button>
          <Button
            disabled={!canReview || pendingAction !== ""}
            onClick={() => void handleReview("request_revision")}
            type="button"
            variant="secondary"
          >
            {pendingAction === "request_revision"
              ? "Submitting..."
              : "Request revision"}
          </Button>
          <Link className="office-button-secondary" href="/office/dashboard">
            Back to dashboard
          </Link>
        </div>
        {error ? <p className="office-inline-error">{error}</p> : null}
      </SectionCard>

      <SectionCard
        subtitle="Every finance send, reply, and agent response stays on this statement record."
        title="System timeline"
      >
        {statement.timeline.length > 0 ? (
          <div className="office-payout-statement-timeline">
            {statement.timeline.map((item) => (
              <article
                className="office-payout-statement-timeline-item"
                key={item.id}
              >
                <div className="office-payout-statement-timeline-head">
                  <strong>{item.messageTypeLabel}</strong>
                  <span>{item.authorLabel}</span>
                  <span>{item.createdAtLabel}</span>
                </div>
                {item.body ? (
                  <p>{item.body}</p>
                ) : (
                  <p className="office-form-helper">
                    No note added for this step.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="office-form-helper">
            No system messages have been recorded on this statement yet.
          </p>
        )}
      </SectionCard>

      <SectionCard
        subtitle="These line items are the locked snapshot finance sent to you for this review."
        title="Invoice items"
      >
        <HorizontalScrollArea>
          <DataTable className="office-table">
            <DataTableHeader className="office-table-header office-table-row office-table-row-agent-statement-snapshot">
              <span>Creation date</span>
              <span>Invoice number</span>
              <span>Owner</span>
              <span>Building name</span>
              <span>Unit</span>
              <span>Gross</span>
              <span>Pre split</span>
              <span>Commission rate</span>
              <span>Post split detail</span>
              <span>Net commission</span>
            </DataTableHeader>
            <DataTableBody>
              {statement.lineItems.map((lineItem) => (
                <DataTableRow
                  className="office-table-row office-table-row-agent-statement-snapshot"
                  key={lineItem.id}
                >
                  <span>{formatStatementCellValue(lineItem.creationDate)}</span>
                  <span>
                    {formatStatementCellValue(lineItem.invoiceNumber)}
                  </span>
                  <span>{formatStatementCellValue(lineItem.ownerName)}</span>
                  <div className="office-agent-statement-building">
                    <strong>
                      <Link href={lineItem.transactionHref}>
                        {formatStatementCellValue(lineItem.buildingName)}
                      </Link>
                    </strong>
                    <p>{formatStatementCellValue(lineItem.propertyAddress)}</p>
                  </div>
                  <span>{formatStatementCellValue(lineItem.unitNumber)}</span>
                  <span>{lineItem.grossCommissionLabel}</span>
                  <span>{lineItem.preSplitLabel}</span>
                  <span>
                    {formatStatementCellValue(lineItem.commissionRate)}
                  </span>
                  <StatementPostSplitCell lineItem={lineItem} />
                  <span>{lineItem.netCommissionLabel}</span>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </HorizontalScrollArea>

        <div className="office-payout-statement-total-row">
          <div className="office-payout-statement-total-copy">
            <span>Final payout total</span>
            <p>
              {hasManualAdjustments
                ? `Invoice payout subtotal ${statement.invoicePayoutTotalLabel}; manual adjustments ${statement.manualAdjustmentTotalLabel}.`
                : `Matches the invoice payout subtotal ${statement.invoicePayoutTotalLabel}.`}
            </p>
          </div>
          <strong>{statement.totalStatementAmountLabel}</strong>
        </div>
      </SectionCard>
    </div>
  );
}
