import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { OfficeAgentPayoutStatementDetail } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    color: "#1f2937",
    fontFamily: "Helvetica"
  },
  header: {
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db"
  },
  company: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    marginTop: 8
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16
  },
  metaCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12
  },
  metaLabel: {
    color: "#6b7280",
    marginBottom: 4
  },
  metaValue: {
    fontSize: 12,
    fontWeight: 700
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16
  },
  summaryCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 10
  },
  bankSection: {
    marginBottom: 16
  },
  bankTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  bankCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 10,
    marginBottom: 10
  },
  bankCardWide: {
    width: "100%"
  },
  bankValue: {
    fontSize: 11,
    fontWeight: 700
  },
  summaryAmount: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 4
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
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  lastRow: {
    borderBottomWidth: 0
  },
  cellTransaction: {
    width: "34%",
    paddingRight: 8
  },
  cellDate: {
    width: "12%",
    paddingRight: 8
  },
  cellAmount: {
    width: "14%",
    textAlign: "right"
  },
  cellStatus: {
    width: "14%",
    paddingLeft: 8
  },
  transactionTitle: {
    fontWeight: 700
  },
  transactionAddress: {
    color: "#6b7280",
    marginTop: 2
  },
  footer: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    alignItems: "flex-end"
  },
  footerLabel: {
    color: "#6b7280"
  },
  footerAmount: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 4
  }
});

type AgentPayoutStatementPdfProps = {
  statement: OfficeAgentPayoutStatementDetail;
};

function buildStatementBankFields(statement: OfficeAgentPayoutStatementDetail) {
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
      value: [bankInformation.taxIdTypeLabel, bankInformation.taxIdValue].filter(Boolean).join(" · ")
    },
    { label: "Date of birth", value: bankInformation.dateOfBirth },
    { label: "Account type", value: bankInformation.accountTypeLabel || bankInformation.accountType }
  ].filter((field) => field.value.trim().length > 0);
}

export function AgentPayoutStatementPdfDocument({ statement }: AgentPayoutStatementPdfProps) {
  const bankFields = buildStatementBankFields(statement);

  return (
    <Document title={`${statement.agentLabel} payout statement`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{statement.officeLabel}</Text>
          <Text style={styles.subtitle}>{statement.organizationLabel}</Text>
          <Text style={styles.title}>AGENT STATEMENT</Text>
          <Text style={styles.subtitle}>{statement.periodBasisLabel} · {statement.periodLabel}</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Prepared for</Text>
            <Text style={styles.metaValue}>{statement.agentLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{statement.generatedAtLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Generated by</Text>
            <Text style={styles.metaValue}>{statement.generatedByLabel}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Line items</Text>
            <Text style={styles.metaValue}>{statement.lineItemCount}</Text>
          </View>
        </View>

        <View style={styles.bankSection}>
          <Text style={styles.bankTitle}>Bank information</Text>
          {bankFields.length > 0 ? (
            <View style={styles.bankGrid}>
              {bankFields.map((field) => (
                <View key={field.label} style={field.wide ? [styles.bankCard, styles.bankCardWide] : styles.bankCard}>
                  <Text style={styles.metaLabel}>{field.label}</Text>
                  <Text style={styles.bankValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.bankCard}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.bankValue}>No bank information saved on the member profile.</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.metaLabel}>Gross commission</Text>
            <Text style={styles.summaryAmount}>{statement.totalGrossCommissionLabel}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.metaLabel}>Agent net</Text>
            <Text style={styles.summaryAmount}>{statement.totalAgentNetLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellTransaction}>Transaction</Text>
            <Text style={styles.cellDate}>Closing</Text>
            <Text style={styles.cellDate}>Calculated</Text>
            <Text style={styles.cellAmount}>Gross</Text>
            <Text style={styles.cellAmount}>Fees</Text>
            <Text style={styles.cellAmount}>Payout</Text>
            <Text style={styles.cellStatus}>Status</Text>
          </View>

          {statement.lineItems.map((lineItem, index) => (
            <View
              key={lineItem.id}
              style={index === statement.lineItems.length - 1 ? [styles.row, styles.lastRow] : styles.row}
            >
              <View style={styles.cellTransaction}>
                <Text style={styles.transactionTitle}>{lineItem.transactionLabel}</Text>
                <Text style={styles.transactionAddress}>{lineItem.propertyAddress}</Text>
              </View>
              <Text style={styles.cellDate}>{lineItem.closingDate || "Missing"}</Text>
              <Text style={styles.cellDate}>{lineItem.calculatedAt}</Text>
              <Text style={styles.cellAmount}>{lineItem.grossCommissionLabel}</Text>
              <Text style={styles.cellAmount}>{lineItem.feesLabel}</Text>
              <Text style={styles.cellAmount}>{lineItem.statementAmountLabel}</Text>
              <Text style={styles.cellStatus}>{lineItem.statusAtGeneration}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>NET PAYOUT</Text>
          <Text style={styles.footerAmount}>{statement.totalStatementAmountLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
