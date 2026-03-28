import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Office1099SummaryDetail } from "@acre/db";

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
  company: {
    fontSize: 16,
    fontWeight: 700
  },
  office: {
    marginTop: 4,
    color: "#6b7280"
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 8
  },
  subtitle: {
    marginTop: 4,
    color: "#6b7280"
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12
  },
  metaCard: {
    width: "24%",
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
  warning: {
    marginBottom: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 6,
    backgroundColor: "#fff7ed"
  },
  warningTitle: {
    fontWeight: 700,
    color: "#92400e",
    marginBottom: 4
  },
  warningCopy: {
    color: "#92400e",
    lineHeight: 1.4
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12
  },
  detailCard: {
    width: "32.2%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8
  },
  detailCardWide: {
    width: "100%"
  },
  detailLabel: {
    color: "#6b7280",
    marginBottom: 4
  },
  detailValue: {
    fontSize: 10,
    fontWeight: 700
  },
  table: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 7,
    paddingHorizontal: 8
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 7,
    paddingHorizontal: 8
  },
  lastTableRow: {
    borderBottomWidth: 0
  },
  dateCell: {
    width: "20%",
    paddingRight: 8
  },
  amountCell: {
    width: "18%",
    paddingRight: 8,
    textAlign: "right"
  },
  memoCell: {
    width: "62%"
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    alignItems: "flex-end"
  },
  footerLabel: {
    color: "#6b7280"
  },
  footerAmount: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 4
  }
});

type Agent1099SummaryPdfDocumentProps = {
  detail: Office1099SummaryDetail;
  organizationName: string;
  officeName: string;
};

function formatPdfFieldValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

export function Agent1099SummaryPdfDocument(props: Agent1099SummaryPdfDocumentProps) {
  const { detail, officeName, organizationName } = props;
  const detailFields = [
    { label: "Payee Name", value: detail.payeeName },
    { label: "Tax ID", value: detail.taxIdLabel },
    { label: "Contact Number", value: detail.contactNumber },
    { label: "Email", value: detail.email },
    { label: "Address", value: detail.address, wide: true }
  ];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{organizationName}</Text>
          <Text style={styles.office}>{officeName}</Text>
          <Text style={styles.title}>1099 Summary / Backup Document</Text>
          <Text style={styles.subtitle}>
            Internal support document generated from saved 1099 Tracker payment records. This export is not an official IRS form.
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Agent</Text>
            <Text style={styles.metaValue}>{detail.agentLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Display Name</Text>
            <Text style={styles.metaValue}>{detail.displayName}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Tax Year</Text>
            <Text style={styles.metaValue}>{String(detail.taxYear)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Total Paid</Text>
            <Text style={styles.metaValue}>{detail.totalPaidLabel}</Text>
          </View>
        </View>

        {detail.missingProfileFields.length > 0 ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Profile warning</Text>
            <Text style={styles.warningCopy}>
              Missing profile fields: {detail.missingProfileFields.join(", ")}. Blank values remain blank in this PDF export.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Payee Profile</Text>
        <View style={styles.detailGrid}>
          {detailFields.map((field) => (
            <View key={field.label} style={field.wide ? [styles.detailCard, styles.detailCardWide] : styles.detailCard}>
              <Text style={styles.detailLabel}>{field.label}</Text>
              <Text style={styles.detailValue}>{formatPdfFieldValue(field.value)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Payment Records</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.dateCell}>Payment Date</Text>
            <Text style={styles.amountCell}>Payment Amount</Text>
            <Text style={styles.memoCell}>Memo</Text>
          </View>

          {detail.paymentRecords.map((record, index) => (
            <View key={record.id} style={index === detail.paymentRecords.length - 1 ? [styles.tableRow, styles.lastTableRow] : styles.tableRow}>
              <Text style={styles.dateCell}>{record.paymentDateLabel}</Text>
              <Text style={styles.amountCell}>{record.paymentAmountLabel}</Text>
              <Text style={styles.memoCell}>{formatPdfFieldValue(record.memo)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Total Paid</Text>
          <Text style={styles.footerAmount}>{detail.totalPaidLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
