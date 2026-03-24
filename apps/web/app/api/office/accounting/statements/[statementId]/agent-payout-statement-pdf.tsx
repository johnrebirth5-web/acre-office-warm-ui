import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { OfficeAgentPayoutStatementDetail } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    padding: 22,
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
    fontWeight: 700,
    marginBottom: 4
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 6
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4
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
    padding: 9
  },
  bankSection: {
    marginBottom: 12
  },
  bankTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  bankCard: {
    width: "32.2%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8
  },
  bankCardWide: {
    width: "100%"
  },
  bankValue: {
    fontSize: 10,
    fontWeight: 700
  },
  summaryAmount: {
    fontSize: 11,
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
  cellCreation: {
    width: "9%",
    paddingRight: 6
  },
  cellInvoice: {
    width: "10%",
    paddingRight: 6
  },
  cellOwner: {
    width: "12%",
    paddingRight: 6
  },
  cellBuilding: {
    width: "20%",
    paddingRight: 8
  },
  cellUnit: {
    width: "6%",
    paddingRight: 6
  },
  cellMoney: {
    width: "9%",
    textAlign: "right",
    paddingLeft: 6
  },
  cellRate: {
    width: "8%",
    textAlign: "right",
    paddingLeft: 6
  },
  buildingTitle: {
    fontWeight: 700
  },
  buildingAddress: {
    color: "#6b7280",
    marginTop: 2,
    fontSize: 8
  },
  footer: {
    marginTop: 14,
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

type AgentPayoutStatementPdfProps = {
  statement: OfficeAgentPayoutStatementDetail;
};

type StatementLineItemRowProps = {
  isLastRow: boolean;
  lineItem: OfficeAgentPayoutStatementDetail["lineItems"][number];
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

function formatStatementCellValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : "—";
}

function StatementLineItemRow({ lineItem, isLastRow }: StatementLineItemRowProps) {
  return (
    <View style={isLastRow ? [styles.row, styles.lastRow] : styles.row} wrap={false}>
      <Text style={styles.cellCreation}>{formatStatementCellValue(lineItem.creationDate)}</Text>
      <Text style={styles.cellInvoice}>{formatStatementCellValue(lineItem.invoiceNumber)}</Text>
      <Text style={styles.cellOwner}>{formatStatementCellValue(lineItem.ownerName)}</Text>
      <View style={styles.cellBuilding}>
        <Text style={styles.buildingTitle}>{formatStatementCellValue(lineItem.buildingName || lineItem.transactionLabel)}</Text>
        <Text style={styles.buildingAddress}>{formatStatementCellValue(lineItem.propertyAddress)}</Text>
      </View>
      <Text style={styles.cellUnit}>{formatStatementCellValue(lineItem.unitNumber)}</Text>
      <Text style={styles.cellMoney}>{lineItem.grossCommissionLabel}</Text>
      <Text style={styles.cellMoney}>{lineItem.preSplitLabel}</Text>
      <Text style={styles.cellRate}>{formatStatementCellValue(lineItem.commissionRate)}</Text>
      <Text style={styles.cellRate}>{lineItem.postSplitLabel}</Text>
      <Text style={styles.cellMoney}>{lineItem.netCommissionLabel}</Text>
    </View>
  );
}

export function AgentPayoutStatementPdfDocument({ statement }: AgentPayoutStatementPdfProps) {
  const bankFields = buildStatementBankFields(statement);

  return (
    <Document title={`${statement.agentLabel} payout statement`}>
      <Page size={{ width: 842, height: 595 }} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{statement.officeLabel}</Text>
          <Text style={styles.subtitle}>{statement.organizationLabel}</Text>
          <Text style={styles.title}>AGENT STATEMENT</Text>
          <Text style={styles.subtitle}>{statement.periodBasisLabel} · {statement.periodLabel}</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard} wrap={false}>
            <Text style={styles.metaLabel}>Prepared for</Text>
            <Text style={styles.metaValue}>{statement.agentLabel}</Text>
          </View>
          <View style={styles.metaCard} wrap={false}>
            <Text style={styles.metaLabel}>Generated</Text>
            <Text style={styles.metaValue}>{statement.generatedAtLabel}</Text>
          </View>
          <View style={styles.metaCard} wrap={false}>
            <Text style={styles.metaLabel}>Generated by</Text>
            <Text style={styles.metaValue}>{statement.generatedByLabel}</Text>
          </View>
          <View style={styles.metaCard} wrap={false}>
            <Text style={styles.metaLabel}>Line items</Text>
            <Text style={styles.metaValue}>{statement.lineItemCount}</Text>
          </View>
        </View>

        <View style={styles.bankSection}>
          <Text style={styles.bankTitle}>Bank information</Text>
          {bankFields.length > 0 ? (
            <View style={styles.bankGrid}>
              {bankFields.map((field) => (
                <View
                  key={field.label}
                  style={field.wide ? [styles.bankCard, styles.bankCardWide] : styles.bankCard}
                  wrap={false}
                >
                  <Text style={styles.metaLabel}>{field.label}</Text>
                  <Text style={styles.bankValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.bankCard} wrap={false}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.bankValue}>No bank information saved on the member profile.</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard} wrap={false}>
            <Text style={styles.metaLabel}>Gross commission</Text>
            <Text style={styles.summaryAmount}>{statement.totalGrossCommissionLabel}</Text>
          </View>
          <View style={styles.summaryCard} wrap={false}>
            <Text style={styles.metaLabel}>Agent net</Text>
            <Text style={styles.summaryAmount}>{statement.totalAgentNetLabel}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellCreation}>Creation date</Text>
            <Text style={styles.cellInvoice}>Invoice number</Text>
            <Text style={styles.cellOwner}>Owner</Text>
            <Text style={styles.cellBuilding}>Building name</Text>
            <Text style={styles.cellUnit}>Unit</Text>
            <Text style={styles.cellMoney}>Gross</Text>
            <Text style={styles.cellMoney}>Pre split</Text>
            <Text style={styles.cellRate}>Commission rate</Text>
            <Text style={styles.cellRate}>Post split</Text>
            <Text style={styles.cellMoney}>Net commission</Text>
          </View>

          {statement.lineItems.map((lineItem, index) => (
            <StatementLineItemRow
              isLastRow={index === statement.lineItems.length - 1}
              key={lineItem.id}
              lineItem={lineItem}
            />
          ))}
        </View>

        <View style={styles.footer} wrap={false}>
          <Text style={styles.footerLabel}>NET PAYOUT</Text>
          <Text style={styles.footerAmount}>{statement.totalStatementAmountLabel}</Text>
        </View>
      </Page>
    </Document>
  );
}
