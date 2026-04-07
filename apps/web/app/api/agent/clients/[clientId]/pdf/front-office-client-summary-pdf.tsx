import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingRight: 28,
    paddingBottom: 32,
    paddingLeft: 28,
    fontSize: 9,
    color: "#1f2937",
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  organization: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    color: "#4b5563",
  },
  heroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#dbe4f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  heroLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  heroValue: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 3,
  },
  heroDetail: {
    color: "#475569",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 7,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  infoCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  fullCard: {
    width: "100%",
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
    borderRadius: 8,
    padding: 10,
  },
  bullet: {
    color: "#4b5563",
    marginBottom: 5,
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
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

type SummaryBlock = {
  title: string;
  description: string;
};

function normalizeValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "Not captured";
}

function buildNegotiationSummary(snapshot: FrontOfficeClientDetailSnapshot): SummaryBlock {
  switch (snapshot.negotiation.boundaryLabel) {
    case "BO workspace live":
      return {
        title: "Formal offer or application steps are already active",
        description:
          snapshot.negotiation.offerCount > 0
            ? `${snapshot.negotiation.offerCount} formal offer or application record(s) are already active, and the current primary status is ${snapshot.negotiation.acceptedOfferLabel}.`
            : "A formal record is already active, so pricing, terms, and paperwork now move from the shared transaction workspace.",
      };
    case "Ready for BO handoff":
      return {
        title: "The client is ready for the formal next step",
        description:
          "Search feedback, timing, and decision readiness are aligned enough that the next move is to open the formal transaction workflow.",
      };
    default:
      return {
        title: "Decision-making is still being narrowed",
        description:
          "We are still using showings, shortlist feedback, and follow-up to clarify the best fit before opening any formal offer or application record.",
      };
  }
}

function buildInspectionSummary(snapshot: FrontOfficeClientDetailSnapshot): SummaryBlock {
  switch (snapshot.inspection.boundaryLabel) {
    case "Inspection-era live":
      return {
        title: "Contract support and milestone follow-through are active",
        description:
          "The shared formal transaction record is already carrying active checklist work, signatures, and review items for this client.",
      };
    case "Contract file live":
      return {
        title: "The formal contract file is open",
        description:
          "The shared record is live and carrying the next contract step, even if final acceptance-era details are still settling.",
      };
    case "Ready for contract file":
      return {
        title: "Formal contract setup is the next move",
        description:
          "This dossier has advanced to the point where the next contract or application step should start from the formal shared record.",
      };
    default:
      return {
        title: "Formal contract support has not started yet",
        description:
          "The current work is still focused on follow-up, showings, shortlist decisions, and early client coordination.",
      };
  }
}

function buildSearchSummaryLines(snapshot: FrontOfficeClientDetailSnapshot) {
  return [
    `Search or move intent: ${normalizeValue(snapshot.intentLabel)}`,
    `Budget: ${normalizeValue(snapshot.budgetLabel)}`,
    `Preferred areas: ${normalizeValue(snapshot.preferredAreasLabel)}`,
    `Current stage: ${snapshot.stage}`,
  ];
}

function buildLeaseTimingText(snapshot: FrontOfficeClientDetailSnapshot) {
  if (
    snapshot.leaseReminder.leaseEndDateLabel === "No lease end date captured" &&
    snapshot.leaseReminder.statusLabel === "No lease reminder"
  ) {
    return "No lease-driven timing is currently recorded on this dossier.";
  }

  return [
    `Lease end: ${snapshot.leaseReminder.leaseEndDateLabel}`,
    `Reminder timing: ${snapshot.leaseReminder.reminderAtLabel}`,
    snapshot.leaseReminder.helperText,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCurrentPlanLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const lines = [
    `${snapshot.workflow.nextStepTitle}: ${snapshot.workflow.nextStepDescription}`,
    `Next planned touch: ${snapshot.followUpCue.dueLabel}`,
    `Workflow pressure: ${snapshot.workflow.pressureLabel}`,
  ];

  if (snapshot.leaseReminder.statusLabel !== "No lease reminder") {
    lines.push(`Lease timing: ${snapshot.leaseReminder.statusLabel}`);
  }

  return lines;
}

function buildUpcomingCoordinationLines(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot.appointments.length) {
    return [
      `No appointment is currently booked. The next move is still anchored on ${snapshot.followUpCue.dueLabel.toLowerCase()}.`,
    ];
  }

  return snapshot.appointments.slice(0, 4).map((appointment) =>
    [
      appointment.title,
      appointment.startsAtLabel,
      appointment.locationLabel,
      appointment.externalStatusDetail,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function buildMaterialsLines(snapshot: FrontOfficeClientDetailSnapshot) {
  if (!snapshot.sendRecords.length) {
    return [
      "No listing packet or tracked resource has been shared from this dossier yet.",
    ];
  }

  return snapshot.sendRecords.slice(0, 5).map((record) =>
    [
      record.title,
      `Shared ${record.sentAtLabel}`,
      record.engagementLabel,
      record.appointmentLabel,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function buildFormalMilestoneLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const negotiationSummary = buildNegotiationSummary(snapshot);
  const inspectionSummary = buildInspectionSummary(snapshot);
  const lines = [
    `${negotiationSummary.title} | ${negotiationSummary.description}`,
    `${inspectionSummary.title} | ${inspectionSummary.description}`,
    `Current closing or milestone view: ${snapshot.closing.boundaryLabel} | ${snapshot.closing.keyDateLabel}`,
  ];

  if (snapshot.negotiation.offers.length) {
    lines.push(
      ...snapshot.negotiation.offers.slice(0, 3).map((offer) =>
        [
          offer.title,
          offer.statusLabel,
          offer.priceLabel,
          offer.expirationLabel,
        ]
          .filter(Boolean)
          .join(" | "),
      ),
    );
  }

  return lines;
}

function buildRecentProgressLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const lines = [
    ...snapshot.stageHistory.slice(0, 3).map((entry) =>
      [entry.changedAtLabel, entry.title].filter(Boolean).join(" | "),
    ),
    ...snapshot.sendRecords.slice(0, 2).map((record) =>
      [
        record.sentAtLabel,
        `Shared ${record.title}`,
        record.engagementLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
    ...snapshot.handoffs.slice(0, 2).map((handoff) =>
      [
        handoff.updatedAtLabel,
        handoff.stageLabel,
        handoff.statusLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    ),
  ].filter(Boolean);

  return lines.length
    ? lines.slice(0, 6)
    : ["No recent progress has been logged on this dossier yet."];
}

function HeroCard(props: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroLabel}>{props.label}</Text>
      <Text style={styles.heroValue}>{String(props.value)}</Text>
      <Text style={styles.heroDetail}>{props.detail}</Text>
    </View>
  );
}

function InfoCard(props: {
  title: string;
  body: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={props.fullWidth ? [styles.infoCard, styles.fullCard] : styles.infoCard}>
      <Text style={styles.infoCardTitle}>{props.title}</Text>
      <Text style={styles.infoCardBody}>{props.body}</Text>
    </View>
  );
}

function BulletList(props: { lines: string[] }) {
  return (
    <View style={styles.listCard}>
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
          <Text style={styles.eyebrow}>Client progress summary</Text>
          <Text style={styles.title}>{props.snapshot.fullName}</Text>
          <Text style={styles.subtitle}>
            Prepared {props.generatedAtLabel} by {props.agentLabel}. This
            summary reflects the live Acre client dossier at the moment it was
            generated.
          </Text>
        </View>

        <View style={styles.heroGrid}>
          <HeroCard
            label="Current focus"
            value={props.snapshot.workflow.nextStepTitle}
            detail={props.snapshot.workflow.pressureDescription}
          />
          <HeroCard
            label="Next planned touch"
            value={props.snapshot.followUpCue.dueLabel}
            detail={props.snapshot.followUpCue.description}
          />
          <HeroCard
            label="Upcoming appointments"
            value={props.snapshot.summary.upcomingAppointmentCount}
            detail={
              props.snapshot.summary.upcomingAppointmentCount
                ? "Appointments are already on the calendar for this dossier."
                : "The next move is still being driven by follow-up and shortlist work."
            }
          />
          <HeroCard
            label="Formal workflow status"
            value={props.snapshot.nextStepRail.decisionLabel}
            detail={props.snapshot.nextStepRail.decisionDescription}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search summary</Text>
          <View style={styles.cardGrid}>
            <InfoCard
              title="What we are solving"
              body={buildSearchSummaryLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Client contact"
              body={[
                `Email: ${normalizeValue(props.snapshot.email || "")}`,
                `Phone: ${normalizeValue(props.snapshot.phone || "")}`,
              ].join("\n")}
            />
            <InfoCard
              title="Current working plan"
              body={buildCurrentPlanLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Lease timing"
              body={buildLeaseTimingText(props.snapshot)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming coordination</Text>
          <BulletList lines={buildUpcomingCoordinationLines(props.snapshot)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formal workflow view</Text>
          <View style={styles.cardGrid}>
            <InfoCard
              title={negotiationSummary.title}
              body={negotiationSummary.description}
            />
            <InfoCard
              title={inspectionSummary.title}
              body={inspectionSummary.description}
            />
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{props.organizationLabel}</Text>
          <Text style={styles.eyebrow}>Client progress summary</Text>
          <Text style={styles.title}>Activity and milestones</Text>
          <Text style={styles.subtitle}>
            Recent coordination, shared materials, and formal milestone context
            pulled from the live dossier.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materials and shortlist activity</Text>
          <BulletList lines={buildMaterialsLines(props.snapshot)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Formal milestones</Text>
          <BulletList lines={buildFormalMilestoneLines(props.snapshot)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent progress</Text>
          <BulletList lines={buildRecentProgressLines(props.snapshot)} />
        </View>

        <View style={styles.footer}>
          <Text>
            This summary is meant for client-facing coordination and recap.
            Formal transaction records, signatures, accounting, and archival
            documents continue to live in Acre&apos;s shared formal transaction
            workspace.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
