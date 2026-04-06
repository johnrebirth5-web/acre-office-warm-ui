import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { OfficeAgentBillingLedgerRow, OfficeBillingStatementRow } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    color: "#1f2937",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db"
  },
  organization: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4
  },
  eyebrow: {
    color: "#9ca3af",
    textTransform: "uppercase",
    fontSize: 8,
    letterSpacing: 0.6
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 6
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 1.45
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12
  },
  metaCard: {
    width: "32%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 9,
    marginBottom: 8
  },
  metaLabel: {
    color: "#6b7280",
    marginBottom: 4
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12
  },
  summaryCard: {
    width: "49%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 9,
    marginBottom: 8
  },
  section: {
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8
  },
  sectionBody: {
    color: "#4b5563",
    lineHeight: 1.45
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    overflow: "hidden"
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 7,
    paddingHorizontal: 6
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 7,
    paddingHorizontal: 6
  },
  lastRow: {
    borderBottomWidth: 0
  },
  cellDate: {
    width: "11%",
    paddingRight: 6
  },
  cellType: {
    width: "12%",
    paddingRight: 6
  },
  cellDescription: {
    width: "31%",
    paddingRight: 8
  },
  cellAmount: {
    width: "11%",
    textAlign: "right",
    paddingLeft: 6
  },
  cellApplied: {
    width: "11%",
    textAlign: "right",
    paddingLeft: 6
  },
  cellOutstanding: {
    width: "12%",
    textAlign: "right",
    paddingLeft: 6
  },
  cellStatus: {
    width: "12%",
    paddingLeft: 6,
    textAlign: "right"
  },
  descriptionTitle: {
    fontWeight: 700
  },
  descriptionMeta: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 8,
    lineHeight: 1.35
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    color: "#6b7280",
    fontSize: 8,
    lineHeight: 1.5
  }
});

type BillingStatementPdfDocumentProps = {
  organizationLabel: string;
  membershipLabel: string;
  generatedAtLabel: string;
  statement: OfficeBillingStatementRow;
  ledgerRows: OfficeAgentBillingLedgerRow[];
};

function buildLedgerDescription(row: OfficeAgentBillingLedgerRow) {
  const title = row.referenceNumber || row.counterparty || row.type;
  const meta = [row.chargeCategory || "", row.linkedTransactionLabel !== "—" ? row.linkedTransactionLabel : ""].filter(Boolean).join(" · ");

  return {
    title,
    meta
  };
}

export function BillingStatementPdfDocument({
  organizationLabel,
  membershipLabel,
  generatedAtLabel,
  statement,
  ledgerRows
}: BillingStatementPdfDocumentProps) {
  const summaryCards = [
    { label: "Total charges", value: statement.totalChargesLabel },
    { label: "Total payments", value: statement.totalPaymentsLabel },
    { label: "Total credits", value: statement.creditsLabel },
    { label: "Current balance", value: statement.currentBalanceLabel }
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{organizationLabel}</Text>
          <Text style={styles.eyebrow}>Billing statement export</Text>
          <Text style={styles.title}>{statement.periodLabel}</Text>
          <Text style={styles.subtitle}>
            Live-generated self-service PDF export from the current billing ledger. This document does not create or represent a
            finalized archived statement, payment gateway record, ACH record, or settlement artifact.
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Membership</Text>
            <Text style={styles.metaValue}>{membershipLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{generatedAtLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Ledger items in period</Text>
            <Text style={styles.metaValue}>{String(statement.entryCount)}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <View key={card.label} style={styles.summaryCard}>
              <Text style={styles.metaLabel}>{card.label}</Text>
              <Text style={styles.metaValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statement basis</Text>
          <Text style={styles.sectionBody}>
            The summary totals above are computed from the same live monthly statement data shown in the Office billing page. Current
            balance reflects invoice rows from this period using the billing ledger&apos;s current applied payment and credit state at
            export time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ledger rows included in this period</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellDate}>Date</Text>
              <Text style={styles.cellType}>Type</Text>
              <Text style={styles.cellDescription}>Description</Text>
              <Text style={styles.cellAmount}>Amount</Text>
              <Text style={styles.cellApplied}>Applied</Text>
              <Text style={styles.cellOutstanding}>Outstanding</Text>
              <Text style={styles.cellStatus}>Status</Text>
            </View>

            {ledgerRows.map((row, index) => {
              const description = buildLedgerDescription(row);
              const rowStyle = index === ledgerRows.length - 1 ? [styles.row, styles.lastRow] : styles.row;

              return (
                <View key={row.id} style={rowStyle}>
                  <Text style={styles.cellDate}>{row.accountingDate || "—"}</Text>
                  <Text style={styles.cellType}>{row.type}</Text>
                  <View style={styles.cellDescription}>
                    <Text style={styles.descriptionTitle}>{description.title}</Text>
                    {description.meta ? <Text style={styles.descriptionMeta}>{description.meta}</Text> : null}
                  </View>
                  <Text style={styles.cellAmount}>{row.amountLabel}</Text>
                  <Text style={styles.cellApplied}>{row.appliedAmountLabel}</Text>
                  <Text style={styles.cellOutstanding}>{row.outstandingAmountLabel}</Text>
                  <Text style={styles.cellStatus}>{row.status}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.footer}>
          This export is scoped to the signed-in membership that generated it. Re-download the statement from Office billing if you
          need a refreshed live view after payments, credits, or invoice applications change.
        </Text>
      </Page>
    </Document>
  );
}
