import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FrontOfficeClientDetailSnapshot } from "@acre/db";
import { FrontOfficeSendMaterialType } from "@prisma/client";

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
  sectionIntro: {
    color: "#64748b",
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

function formatTrackedMaterialTypeLabel(
  materialType: FrontOfficeSendMaterialType,
) {
  switch (materialType) {
    case FrontOfficeSendMaterialType.listing_share:
      return "Listing share";
    default:
      return "Tracked share";
  }
}

function buildFormalWorkflowSummary(
  snapshot: FrontOfficeClientDetailSnapshot,
): SummaryBlock {
  switch (snapshot.contract.boundaryState) {
    case "back_office_live":
      return {
        title: "The formal deal record is active in Back Office",
        description:
          "The shared transaction record is already carrying the formal offer, contract, signature, or milestone work. Client-facing coordination can still continue, but the auditable paperwork now lives in that formal file and should stay there as the source of truth.",
      };
    case "ready_for_back_office":
      return {
        title: "The formal Back Office record should open next",
        description:
          "Search feedback, timing, and decision readiness are aligned enough that the next formal step should start from the shared transaction record instead of a duplicate note.",
      };
    case "post_close_front_office":
      return {
        title: "The formal transaction is already complete",
        description:
          "The next work is relationship-driven: move support, recap, referrals, testimonials, and the next future-planning conversation.",
      };
    case "cancelled_reentry":
      return {
        title: "The formal file is paused, but future planning stays open",
        description:
          "The formal file is no longer the active lane. A respectful re-entry or future-planning touch can still happen from the live client record.",
      };
    default:
      return {
        title: "We are still in Front Office planning and coordination",
        description:
          "The current focus is still follow-up, showings, shortlist feedback, and decision support before any formal paperwork is needed.",
      };
  }
}

function buildNegotiationSummary(
  snapshot: FrontOfficeClientDetailSnapshot,
): SummaryBlock {
  switch (snapshot.negotiation.boundaryLabel) {
    case "BO workspace live":
      return {
        title: "The formal offer file is the source of truth",
        description:
          snapshot.negotiation.offerCount > 0
            ? `${snapshot.negotiation.offerCount} formal offer or application record(s) are already active, and the current primary state is ${snapshot.negotiation.acceptedOfferLabel}. Front Office should stay client-facing and point back to that file.`
            : "A formal record is already active, so pricing, terms, and document control are now managed from the shared transaction workspace.",
      };
    case "Ready for BO handoff":
      return {
        title: "The next formal offer file should open in Back Office",
        description:
          "Search direction, timing, and decision-making are aligned enough that the next record should be a formal offer, application, or transaction setup in Back Office instead of a duplicate Front Office note.",
      };
    default:
      return {
        title: "Keep offer prep in Front Office until the file is ready",
        description:
          "Showings, shortlist feedback, and follow-up are still doing the work of clarifying the best option before formal terms are opened.",
      };
  }
}

function buildInspectionSummary(
  snapshot: FrontOfficeClientDetailSnapshot,
): SummaryBlock {
  switch (snapshot.inspection.boundaryLabel) {
    case "Inspection-era live":
      return {
        title: "The live contract file owns inspection support",
        description:
          "Checklist work, signatures, and incoming transaction updates are already moving in the shared formal record, while Front Office stays the explanation layer.",
      };
    case "Contract file live":
      return {
        title: "The formal contract file is open in Back Office",
        description:
          "The shared transaction record is already carrying the live contract lane, even if next-step details are still settling.",
      };
    case "Ready for contract file":
      return {
        title: "The next formal contract step should start in Back Office",
        description:
          "This client has advanced far enough that the next contract or application step should start in the formal record instead of a second Front Office tracker.",
      };
    default:
      return {
        title: "Inspection support starts after the formal file exists",
        description:
          "The current work is still centered on follow-up, showings, shortlist decisions, and early coordination.",
      };
  }
}

function buildSearchSummaryLines(snapshot: FrontOfficeClientDetailSnapshot) {
  return [
    `Search or move goal: ${normalizeValue(snapshot.intentLabel)}`,
    `Budget range: ${normalizeValue(snapshot.budgetLabel)}`,
    `Preferred areas: ${normalizeValue(snapshot.preferredAreasLabel)}`,
    `Current stage: ${snapshot.stage}`,
  ];
}

function buildContactSummaryLines(snapshot: FrontOfficeClientDetailSnapshot) {
  return [
    `Email: ${normalizeValue(snapshot.email || "")}`,
    `Phone: ${normalizeValue(snapshot.phone || "")}`,
    `Prepared from the live client record, owned by ${snapshot.ownerLabel}.`,
  ];
}

function buildImportantDatesLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const lines = [`Next planned touch: ${snapshot.followUpCue.dueLabel}`];

  if (snapshot.appointments.length) {
    const nextAppointment = snapshot.appointments[0];
    lines.push(`Next appointment: ${nextAppointment.startsAtLabel}`);
  } else {
    lines.push("Next appointment: Not scheduled yet");
  }

  if (snapshot.leaseReminder.statusLabel !== "No lease reminder") {
    lines.push(`Lease timing: ${snapshot.leaseReminder.reminderAtLabel}`);
  }

  if (snapshot.closing.keyDateLabel !== "No key date captured") {
    lines.push(`Formal milestone date: ${snapshot.closing.keyDateLabel}`);
  }

  return lines;
}

function buildWorkingPlanLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const currentRailItem =
    snapshot.nextStepRail.items.find((item) => item.isCurrent) ??
    snapshot.nextStepRail.items[0] ??
    null;
  const lines = [
    `${snapshot.workflow.nextStepTitle}: ${snapshot.workflow.nextStepDescription}`,
    `Workflow pressure: ${snapshot.workflow.pressureLabel}`,
    `Current execution lane: ${snapshot.nextStepRail.decisionLabel}`,
  ];

  if (currentRailItem) {
    lines.push(
      `Current return point: ${currentRailItem.returnPoint.label} | ${currentRailItem.returnDescription}`,
    );
  }

  if (snapshot.summary.openTaskCount > 0) {
    lines.push(
      `${snapshot.summary.openTaskCount} active follow-up task(s) are already keeping the next move visible.`,
    );
  }

  return lines;
}

function buildWhatHappensNextLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const lines = [
    `${snapshot.workflow.nextStepTitle} | ${snapshot.workflow.nextStepDescription}`,
    `Next touch | ${snapshot.followUpCue.dueLabel}`,
  ];

  if (snapshot.appointments.length) {
    lines.push(
      ...snapshot.appointments
        .slice(0, 2)
        .map((appointment) =>
          [
            "Appointment",
            appointment.title,
            appointment.startsAtLabel,
            appointment.locationLabel,
          ]
            .filter(Boolean)
            .join(" | "),
        ),
    );
  }

  if (snapshot.leaseReminder.statusLabel !== "No lease reminder") {
    lines.push(
      [
        "Lease timing",
        snapshot.leaseReminder.statusLabel,
        snapshot.leaseReminder.reminderAtLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  if (snapshot.sendRecords.length) {
    const latestSend = snapshot.sendRecords[0];
    lines.push(
      [
        "Most recent option set",
        latestSend.title,
        latestSend.sentAtLabel,
        latestSend.engagementLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }

  return lines;
}

function buildUpcomingCoordinationLines(
  snapshot: FrontOfficeClientDetailSnapshot,
) {
  if (!snapshot.appointments.length) {
    return [
      `No appointment is currently booked. The next move is still anchored on ${snapshot.followUpCue.dueLabel.toLowerCase()}.`,
    ];
  }

  return snapshot.appointments
    .slice(0, 4)
    .map((appointment) =>
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
      "No tracked listing share has been recorded yet from this client record.",
    ];
  }

  return snapshot.sendRecords
    .slice(0, 5)
    .map((record) =>
      [
        formatTrackedMaterialTypeLabel(record.materialTypeValue),
        record.title,
        `Shared ${record.sentAtLabel}`,
        record.channelLabel,
        record.engagementLabel,
        record.appointmentLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    );
}

function buildTrackedSharePulseLines(
  snapshot: FrontOfficeClientDetailSnapshot,
) {
  const lines = [
    `Tracked sends: ${snapshot.engagement.sendCount} · opened ${snapshot.engagement.openedSendCount} · revisits ${snapshot.engagement.revisitCount}`,
    `Latest engagement: ${snapshot.engagement.lastEngagementLabel}`,
  ];

  if (snapshot.sendRecords.length) {
    const latestSend = snapshot.sendRecords[0];

    lines.push(
      [
        `Latest share: ${latestSend.title}`,
        latestSend.channelLabel,
        latestSend.sentAtLabel,
        latestSend.engagementLabel,
        latestSend.appointmentLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  } else {
    lines.push(
      "No tracked listing share has been recorded yet from this client record.",
    );
  }

  return lines;
}

function buildRecentTrackedShareLines(
  snapshot: FrontOfficeClientDetailSnapshot,
) {
  if (!snapshot.sendRecords.length) {
    return [
      "No tracked share history has been recorded yet from this client record.",
    ];
  }

  return snapshot.sendRecords
    .slice(0, 4)
    .map((record) =>
      [
        formatTrackedMaterialTypeLabel(record.materialTypeValue),
        record.title,
        record.channelLabel,
        record.sentAtLabel,
        record.engagementLabel,
        record.appointmentLabel,
      ]
        .filter(Boolean)
        .join(" | "),
    );
}

function buildFormalMilestoneLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const formalWorkflow = buildFormalWorkflowSummary(snapshot);
  const negotiationSummary = buildNegotiationSummary(snapshot);
  const inspectionSummary = buildInspectionSummary(snapshot);
  const offerRailItem =
    snapshot.nextStepRail.items.find((item) => item.id === "offer_prep") ??
    null;
  const inspectionRailItem =
    snapshot.nextStepRail.items.find(
      (item) => item.id === "inspection_support",
    ) ?? null;
  const closingRailItem =
    snapshot.nextStepRail.items.find(
      (item) => item.id === "closing_suggestion",
    ) ?? null;
  const lines: Array<string | null> = [
    `${formalWorkflow.title} | ${formalWorkflow.description}`,
    `${negotiationSummary.title} | ${negotiationSummary.description}`,
    `Negotiation next move | ${snapshot.negotiation.nextMoveLabel} | ${snapshot.negotiation.nextMoveDescription}`,
    `Negotiation operator frame | ${snapshot.negotiation.operatorLabel} | ${snapshot.negotiation.operatorDescription}`,
    offerRailItem
      ? `Offer return point | ${offerRailItem.returnPoint.label} | ${offerRailItem.returnDescription}`
      : null,
    `${inspectionSummary.title} | ${inspectionSummary.description}`,
    `Inspection next move | ${snapshot.inspection.nextMoveLabel} | ${snapshot.inspection.nextMoveDescription}`,
    `Inspection operator frame | ${snapshot.inspection.operatorLabel} | ${snapshot.inspection.operatorDescription}`,
    inspectionRailItem
      ? `Inspection return point | ${inspectionRailItem.returnPoint.label} | ${inspectionRailItem.returnDescription}`
      : null,
    `Closing / post-close view | ${snapshot.closing.boundaryLabel} | ${snapshot.closing.boundaryTitle}`,
    `Closing next move | ${snapshot.closing.nextMoveLabel} | ${snapshot.closing.nextMoveDescription}`,
    `Closing operator frame | ${snapshot.closing.operatorLabel} | ${snapshot.closing.operatorDescription}`,
    closingRailItem
      ? `Closing return point | ${closingRailItem.returnPoint.label} | ${closingRailItem.returnDescription}`
      : null,
    `Formal timing | ${snapshot.closing.keyDateLabel} | ${snapshot.closing.nextTouchLabel}`,
  ];

  if (snapshot.negotiation.offers.length) {
    lines.push(
      ...snapshot.negotiation.offers
        .slice(0, 3)
        .map((offer) =>
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

  return lines.filter((line): line is string => Boolean(line));
}

function buildRecentProgressLines(snapshot: FrontOfficeClientDetailSnapshot) {
  const lines = [
    ...snapshot.followUpTasks
      .slice(0, 3)
      .map((task) =>
        [task.timelineAtLabel, task.timelineTitle].filter(Boolean).join(" | "),
      ),
    ...snapshot.stageHistory
      .slice(0, 2)
      .map((entry) =>
        [entry.changedAtLabel, entry.title].filter(Boolean).join(" | "),
      ),
    ...snapshot.sendRecords
      .slice(0, 2)
      .map((record) =>
        [record.sentAtLabel, `Shared ${record.title}`, record.engagementLabel]
          .filter(Boolean)
          .join(" | "),
      ),
    ...snapshot.handoffs
      .slice(0, 2)
      .map((handoff) =>
        [handoff.updatedAtLabel, handoff.stageLabel, handoff.statusLabel]
          .filter(Boolean)
          .join(" | "),
      ),
  ].filter(Boolean);

  return lines.length
    ? lines.slice(0, 7)
    : ["No recent progress has been logged on this client record yet."];
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

function InfoCard(props: { title: string; body: string; fullWidth?: boolean }) {
  return (
    <View
      style={
        props.fullWidth ? [styles.infoCard, styles.fullCard] : styles.infoCard
      }
    >
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
  const formalWorkflow = buildFormalWorkflowSummary(props.snapshot);
  const negotiationSummary = buildNegotiationSummary(props.snapshot);
  const inspectionSummary = buildInspectionSummary(props.snapshot);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{props.organizationLabel}</Text>
          <Text style={styles.eyebrow}>Client coordination summary</Text>
          <Text style={styles.title}>{props.snapshot.fullName}</Text>
          <Text style={styles.subtitle}>
            Prepared {props.generatedAtLabel} by {props.agentLabel}. This recap
            reflects the live Acre client record at the moment it was generated.
          </Text>
        </View>

        <View style={styles.heroGrid}>
          <HeroCard
            label="Current focus"
            value={props.snapshot.workflow.nextStepTitle}
            detail={props.snapshot.workflow.pressureDescription}
          />
          <HeroCard
            label="Search goal"
            value={props.snapshot.intentLabel}
            detail={`Budget ${normalizeValue(props.snapshot.budgetLabel)} · Areas ${normalizeValue(props.snapshot.preferredAreasLabel)}`}
          />
          <HeroCard
            label="Next planned touch"
            value={props.snapshot.followUpCue.dueLabel}
            detail={props.snapshot.followUpCue.description}
          />
          <HeroCard
            label="Formal paperwork"
            value={formalWorkflow.title}
            detail={formalWorkflow.description}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Client goals and working context
          </Text>
          <Text style={styles.sectionIntro}>
            The recap below is organized for active coordination, shortlist
            alignment, and clean follow-through after calls or meetings.
          </Text>
          <View style={styles.cardGrid}>
            <InfoCard
              title="Search or move goals"
              body={buildSearchSummaryLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Contact details on file"
              body={buildContactSummaryLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Important dates"
              body={buildImportantDatesLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Current working plan"
              body={buildWorkingPlanLines(props.snapshot).join("\n")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <BulletList lines={buildWhatHappensNextLines(props.snapshot)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Upcoming appointments and coordination
          </Text>
          <BulletList lines={buildUpcomingCoordinationLines(props.snapshot)} />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.organization}>{props.organizationLabel}</Text>
          <Text style={styles.eyebrow}>Client coordination summary</Text>
          <Text style={styles.title}>Shared materials and milestone view</Text>
          <Text style={styles.subtitle}>
            This page captures what has already been shared, how much tracked
            engagement the client has shown, where formal paperwork stands,
            which return point the dossier should use next, and the most recent
            movement on the client record.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracked share pulse</Text>
          <View style={styles.cardGrid}>
            <InfoCard
              title="Usage pulse"
              body={buildTrackedSharePulseLines(props.snapshot).join("\n")}
            />
            <InfoCard
              title="Recent tracked use"
              body={buildRecentTrackedShareLines(props.snapshot).join("\n")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared options and materials</Text>
          <BulletList lines={buildMaterialsLines(props.snapshot)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Formal paperwork, handoff, and client-ready milestone view
          </Text>
          <View style={styles.cardGrid}>
            <InfoCard
              title={formalWorkflow.title}
              body={formalWorkflow.description}
            />
            <InfoCard
              title={negotiationSummary.title}
              body={negotiationSummary.description}
            />
            <InfoCard
              title={inspectionSummary.title}
              body={inspectionSummary.description}
            />
            <InfoCard
              title="Milestone snapshot"
              body={buildFormalMilestoneLines(props.snapshot).join("\n")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent share history</Text>
          <BulletList lines={buildRecentTrackedShareLines(props.snapshot)} />
        </View>

        <View style={styles.footer}>
          <Text>
            This summary is intended for coordination, recap, and client-facing
            follow-through. Final contracts, signatures, accounting, and archive
            documents continue to live in Acre&apos;s formal Back Office
            transaction record when that paperwork is active.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
