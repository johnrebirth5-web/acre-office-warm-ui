import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    color: "#1f2937",
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  organization: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  eyebrow: {
    color: "#9ca3af",
    textTransform: "uppercase",
    fontSize: 8,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 6,
  },
  subtitle: {
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 1.4,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaCard: {
    width: "24%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 9,
    marginBottom: 8,
  },
  metaLabel: {
    color: "#6b7280",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  },
  sectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  infoCard: {
    width: "49%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 9,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 4,
  },
  infoCardBody: {
    color: "#4b5563",
    lineHeight: 1.5,
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 9,
  },
  listItem: {
    paddingBottom: 7,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  listItemLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  listItemTitle: {
    fontWeight: 700,
    marginBottom: 2,
  },
  listItemDetail: {
    color: "#4b5563",
    lineHeight: 1.45,
  },
  bullet: {
    marginBottom: 4,
    color: "#4b5563",
    lineHeight: 1.45,
  },
  divider: {
    marginVertical: 2,
  },
  footer: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    color: "#6b7280",
    fontSize: 8,
    lineHeight: 1.5,
  },
});

type FrontOfficeClientSummaryPdfProps = {
  snapshot: FrontOfficeClientDetailSnapshot;
  organizationLabel: string;
  agentLabel: string;
  generatedAtLabel: string;
};

function normalizeValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "Not captured";
}

function buildNegotiationSummary(snapshot: FrontOfficeClientDetailSnapshot) {
  switch (snapshot.negotiation.boundaryLabel) {
    case "BO workspace live":
      return {
        title: "Formal offer or application workflow is active",
        description:
          snapshot.negotiation.offerCount > 0
            ? `${snapshot.negotiation.offerCount} formal record(s) are active, and the current primary state is ${snapshot.negotiation.acceptedOfferLabel}.`
            : "A formal record is active and ready for the next offer or application step.",
      };
    case "Ready for BO handoff":
      return {
        title: "Preparation is ready to become a formal record",
        description:
          "Property feedback, timing, and key terms are aligned closely enough to move into a formal offer or application workflow.",
      };
    default:
      return {
        title: "Preparation is still underway",
        description:
          "Search criteria, showing feedback, and decision timing are still being refined before a formal offer or application is opened.",
      };
  }
}

function buildInspectionSummary(snapshot: FrontOfficeClientDetailSnapshot) {
  switch (snapshot.inspection.boundaryLabel) {
    case "Inspection-era live":
      return {
        title: "Contract and inspection support are active",
        description:
          "The formal contract file is carrying live milestone work, including checklist steps, signatures, and review items.",
      };
    case "Contract file live":
      return {
        title: "The formal contract file is open",
        description:
          "Core contract setup is active, and final acceptance details are still being confirmed before the full inspection-era workflow settles in.",
      };
    case "Ready for contract file":
      return {
        title: "The file is ready for formal contract setup",
        description:
          "Planning has progressed to the point where the next formal contract step should start from the shared transaction record.",
      };
    default:
      return {
        title: "Contract support has not started yet",
        description:
          "The current work remains in follow-up, showing coordination, and decision preparation rather than formal contract execution.",
      };
  }
}

function buildInspectionMilestones(snapshot: FrontOfficeClientDetailSnapshot) {
  const milestones = [
    `Open milestone tasks: ${snapshot.inspection.openTaskCount}`,
    `Overdue milestone tasks: ${snapshot.inspection.overdueTaskCount}`,
    `Signatures in progress: ${snapshot.inspection.pendingSignatureCount}`,
    `Review items pending: ${snapshot.inspection.pendingIncomingUpdateCount}`,
  ];

  if (
    snapshot.inspection.openTaskCount === 0 &&
    snapshot.inspection.pendingSignatureCount === 0 &&
    snapshot.inspection.pendingIncomingUpdateCount === 0
  ) {
    milestones.push(
      "No contract-support pressure is currently showing in the shared transaction workflow.",
    );
  }

  return milestones;
}

function buildMaterialLines(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot.sendRecords.length) {
    return [
      "No listing or resource packet has been sent from this client dossier yet.",
    ];
  }

  return snapshot.sendRecords.slice(0, 4).map((record) =>
    [record.title, `Shared ${record.sentAtLabel}`, record.appointmentLabel]
      .filter(Boolean)
      .join(" | "),
  );
}

function buildAppointmentLines(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot.appointments.length) {
    return ["No upcoming appointment is currently attached to this dossier."];
  }

  return snapshot.appointments.slice(0, 4).map((appointment) =>
    [
      appointment.title,
      appointment.startsAtLabel,
      appointment.locationLabel,
      appointment.contextLabel,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function buildOfferLines(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot.negotiation.offers.length) {
    return [
      snapshot.negotiation.acceptedOfferLabel !== "No accepted offer"
        ? `Primary status: ${snapshot.negotiation.acceptedOfferLabel}`
        : "No formal offer or application record is currently listed in the active workflow.",
    ];
  }

  return snapshot.negotiation.offers.slice(0, 3).map((offer) =>
    [
      offer.title,
      offer.statusLabel,
      offer.priceLabel,
      offer.expirationLabel,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function MetaCard(props: { label: string; value: string | number }) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{props.label}</Text>
      <Text style={styles.metaValue}>{String(props.value)}</Text>
    </View>
  );
}

function BulletList(props: { lines: string[] }) {
  return (
    <View>
      {props.lines.map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.bullet}>
          - {line}
        </Text>
      ))}
    </View>
  );
}

export function FrontOfficeClientSummaryPdfDocument(
  props: FrontOfficeClientSummaryPdfProps,
) {
  const negotiationSummary = buildNegotiationSummary(props.snapshot);
  const inspectionSummary = buildInspectionSummary(props.snapshot);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{props.organizationLabel}</Text>
          <Text style={styles.eyebrow}>Front Office Client Summary</Text>
          <Text style={styles.title}>{props.snapshot.fullName}</Text>
          <Text style={styles.subtitle}>
            Prepared {props.generatedAtLabel} by {props.agentLabel}. This PDF
            uses the live Front Office dossier and linked formal workflow
            context at the moment it was generated.
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <MetaCard label="Current stage" value={props.snapshot.stage} />
          <MetaCard
            label="Next planned touch"
            value={props.snapshot.nextTouchLabel}
          />
          <MetaCard
            label="Upcoming appointments"
            value={props.snapshot.summary.upcomingAppointmentCount}
          />
          <MetaCard
            label="Shared materials"
            value={props.snapshot.engagement.sendCount}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client brief</Text>
          <View style={styles.sectionGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Search or move intent</Text>
              <Text style={styles.infoCardBody}>
                {normalizeValue(props.snapshot.intentLabel)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Budget</Text>
              <Text style={styles.infoCardBody}>
                {normalizeValue(props.snapshot.budgetLabel)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Preferred areas</Text>
              <Text style={styles.infoCardBody}>
                {normalizeValue(props.snapshot.preferredAreasLabel)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Contact on file</Text>
              <Text style={styles.infoCardBody}>
                {normalizeValue(props.snapshot.email || props.snapshot.phone)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming schedule</Text>
          <View style={styles.listCard}>
            <BulletList lines={buildAppointmentLines(props.snapshot)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared materials</Text>
          <View style={styles.listCard}>
            <BulletList lines={buildMaterialLines(props.snapshot)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offer and decision status</Text>
          <View style={styles.listCard}>
            <View style={styles.listItem}>
              <Text style={styles.listItemTitle}>{negotiationSummary.title}</Text>
              <Text style={styles.listItemDetail}>
                {negotiationSummary.description}
              </Text>
            </View>
            <View style={styles.listItemLast}>
              <BulletList lines={buildOfferLines(props.snapshot)} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contract and inspection support</Text>
          <View style={styles.listCard}>
            <View style={styles.listItem}>
              <Text style={styles.listItemTitle}>{inspectionSummary.title}</Text>
              <Text style={styles.listItemDetail}>
                {inspectionSummary.description}
              </Text>
            </View>
            <View style={styles.listItemLast}>
              <BulletList lines={buildInspectionMilestones(props.snapshot)} />
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Agent: {props.agentLabel}
          {"\n"}
          Generated from Acre Front Office live dossier data. Formal transaction,
          signature, and archival records continue to live in the shared Back
          Office workflow.
        </Text>
      </Page>
    </Document>
  );
}
