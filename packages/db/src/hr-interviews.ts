import { HrInterviewMode, HrInterviewStatus, HrSyncState } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";
import { appendGoogleSheetRow, createGoogleCalendarEvent } from "./google-integration";
import { generateOfflineInterviewConfirmationEmail } from "./hr-ai";

export type HrInterviewRecord = {
  id: string;
  candidateId: string;
  candidateName: string;
  title: string;
  mode: HrInterviewMode;
  status: HrInterviewStatus;
  startsAt: string;
  endsAt: string;
  location: string;
  meetUrl: string;
  aiEmailDraft: string;
  googleSyncState: HrSyncState;
  googleSyncError: string;
  trackerSyncState: HrSyncState;
  trackerSyncError: string;
  href: string;
};

export type CreateHrInterviewInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  candidateId: string;
  title?: string | null;
  mode?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  interviewerNames?: string[];
  attendeeEmails?: string[];
  ccEmails?: string[];
  notes?: string | null;
  timeZone?: string | null;
};

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeArray(values: string[] | null | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parseDate(value: string | null | undefined) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return null;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Interview date is invalid.");
  }
  return date;
}

function parseMode(value: string | null | undefined) {
  return value === HrInterviewMode.offline ? HrInterviewMode.offline : HrInterviewMode.online;
}

function mapInterview(record: {
  id: string;
  candidateId: string;
  title: string;
  mode: HrInterviewMode;
  status: HrInterviewStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  location: string | null;
  meetUrl: string | null;
  aiEmailDraft: string | null;
  googleSyncState: HrSyncState;
  googleSyncError: string | null;
  trackerSyncState: HrSyncState;
  trackerSyncError: string | null;
  candidate: { fullName: string };
}): HrInterviewRecord {
  return {
    id: record.id,
    candidateId: record.candidateId,
    candidateName: record.candidate.fullName,
    title: record.title,
    mode: record.mode,
    status: record.status,
    startsAt: formatDateTimeLabel(record.startsAt),
    endsAt: formatDateTimeLabel(record.endsAt),
    location: record.location ?? "",
    meetUrl: record.meetUrl ?? "",
    aiEmailDraft: record.aiEmailDraft ?? "",
    googleSyncState: record.googleSyncState,
    googleSyncError: record.googleSyncError ?? "",
    trackerSyncState: record.trackerSyncState,
    trackerSyncError: record.trackerSyncError ?? "",
    href: `/office/hr/candidates/${record.candidateId}`,
  };
}

function buildOfficeScope(officeId: string | null | undefined) {
  return officeId ? { OR: [{ officeId }, { officeId: null }] } : {};
}

async function syncInterviewToGoogle(input: {
  interviewId: string;
  organizationId: string;
  actorMembershipId: string;
  timeZone?: string | null;
}) {
  const interview = await prisma.hrInterview.findUnique({
    where: { id: input.interviewId },
    include: { candidate: true },
  });

  if (!interview?.startsAt) {
    return;
  }

  try {
    const event = await createGoogleCalendarEvent({
      organizationId: input.organizationId,
      title: interview.title,
      description: `Candidate: ${interview.candidate.fullName}\n${interview.notes ?? ""}`,
      startsAt: interview.startsAt,
      endsAt: interview.endsAt,
      timeZone: input.timeZone ?? undefined,
      location: interview.location,
      attendeeEmails: interview.attendeeEmails,
      createMeet: interview.mode === HrInterviewMode.online,
    });
    const meetUrl =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ??
      null;

    await prisma.$transaction(async (tx) => {
      await tx.hrInterview.update({
        where: { id: interview.id },
        data: {
          status: HrInterviewStatus.scheduled,
          calendarEventId: event.id,
          meetUrl,
          googleSyncState: HrSyncState.synced,
          googleSyncError: null,
        },
      });

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "hr_interview",
        entityId: interview.id,
        action: activityLogActions.hrGoogleSyncSucceeded,
        payload: {
          officeId: interview.officeId,
          objectLabel: interview.title,
        },
      });
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.hrInterview.update({
        where: { id: interview.id },
        data: {
          googleSyncState: HrSyncState.sync_failed,
          googleSyncError: error instanceof Error ? error.message : "Google Calendar sync failed.",
        },
      });

      await recordActivityLogEvent(tx, {
        organizationId: input.organizationId,
        membershipId: input.actorMembershipId,
        entityType: "hr_interview",
        entityId: interview.id,
        action: activityLogActions.hrGoogleSyncFailed,
        payload: {
          officeId: interview.officeId,
          objectLabel: interview.title,
          details: [error instanceof Error ? error.message : "Google Calendar sync failed."],
        },
      });
    });
  }
}

async function syncInterviewToTracker(input: {
  interviewId: string;
  organizationId: string;
}) {
  const [interview, integration] = await Promise.all([
    prisma.hrInterview.findUnique({
      where: { id: input.interviewId },
      include: { candidate: true, office: true },
    }),
    prisma.organizationGoogleIntegration.findUnique({
      where: { organizationId: input.organizationId },
    }),
  ]);

  if (!interview) {
    return;
  }

  if (!integration?.hrTrackerSpreadsheetId) {
    await prisma.hrInterview.update({
      where: { id: interview.id },
      data: {
        trackerSyncState: HrSyncState.not_applicable,
        trackerSyncError: null,
      },
    });
    return;
  }

  try {
    await appendGoogleSheetRow({
      organizationId: input.organizationId,
      spreadsheetId: integration.hrTrackerSpreadsheetId,
      range: "Interview!A:Z",
      values: [[
        interview.startsAt?.toISOString() ?? "",
        interview.candidate.positionTitle ?? interview.candidate.role ?? "",
        interview.candidate.fullName,
        interview.interviewerNames.join(", "),
        interview.candidate.fullName,
        interview.candidate.phone ?? "",
        interview.candidate.resumeDriveFileId ?? interview.candidate.resumeFileKey ?? "",
        "",
        "",
        interview.candidate.identityType ?? "",
        "",
        interview.candidate.sourceType ?? "",
        interview.notes ?? "",
        interview.mode === HrInterviewMode.online ? interview.meetUrl ?? "" : interview.location ?? "",
      ]],
    });

    await prisma.hrInterview.update({
      where: { id: interview.id },
      data: {
        trackerSyncState: HrSyncState.synced,
        trackerSyncError: null,
      },
    });
  } catch (error) {
    await prisma.hrInterview.update({
      where: { id: interview.id },
      data: {
        trackerSyncState: HrSyncState.sync_failed,
        trackerSyncError: error instanceof Error ? error.message : "HR Tracker sync failed.",
      },
    });
  }
}

export async function listHrInterviews(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  const interviews = await prisma.hrInterview.findMany({
    where: {
      organizationId: input.organizationId,
      ...buildOfficeScope(input.officeId ?? null),
    },
    include: { candidate: true },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return interviews.map(mapInterview);
}

export async function createHrInterview(input: CreateHrInterviewInput) {
  const candidate = await prisma.hrCandidate.findFirst({
    where: {
      id: input.candidateId,
      organizationId: input.organizationId,
    },
  });

  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  const mode = parseMode(input.mode);
  const title = normalizeOptional(input.title) ?? `Second interview: ${candidate.fullName}`;
  const interviewerNames = normalizeArray(input.interviewerNames);
  const attendeeEmails = normalizeArray(input.attendeeEmails);
  const ccEmails = normalizeArray(input.ccEmails);
  let aiEmailDraft: string | null = null;

  if (mode === HrInterviewMode.offline && startsAt && input.location) {
    const draft = await generateOfflineInterviewConfirmationEmail({
      organizationId: input.organizationId,
      actorMembershipId: input.actorMembershipId,
      contextId: candidate.id,
      candidateName: candidate.fullName,
      interviewTime: startsAt.toLocaleString("en-US", { timeZone: input.timeZone ?? "America/New_York" }),
      location: input.location,
      interviewerNames,
      ccEmails,
    });
    aiEmailDraft = `Subject: ${draft.subject}\n\n${draft.body}`;
  }

  const interview = await prisma.$transaction(async (tx) => {
    const created = await tx.hrInterview.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? candidate.officeId ?? null,
        candidateId: candidate.id,
        createdByMembershipId: input.actorMembershipId,
        title,
        mode,
        status: HrInterviewStatus.requested,
        startsAt,
        endsAt,
        location: normalizeOptional(input.location),
        interviewerNames,
        attendeeEmails,
        ccEmails,
        aiEmailDraft,
        notes: normalizeOptional(input.notes),
      },
      include: { candidate: true },
    });

    await tx.hrCandidate.update({
      where: { id: candidate.id },
      data: { status: "interview_2" },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_interview",
      entityId: created.id,
      action: activityLogActions.hrInterviewCreated,
      payload: {
        officeId: created.officeId,
        objectLabel: created.title,
        contextHref: `/office/hr/candidates/${candidate.id}`,
      },
    });

    return created;
  });

  await syncInterviewToGoogle({
    interviewId: interview.id,
    organizationId: input.organizationId,
    actorMembershipId: input.actorMembershipId,
    timeZone: input.timeZone,
  });
  await syncInterviewToTracker({
    interviewId: interview.id,
    organizationId: input.organizationId,
  });

  const saved = await prisma.hrInterview.findUnique({
    where: { id: interview.id },
    include: { candidate: true },
  });

  return saved ? mapInterview(saved) : mapInterview(interview);
}

export async function retryHrInterviewGoogleSync(input: {
  organizationId: string;
  actorMembershipId: string;
  interviewId: string;
  timeZone?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    const interview = await tx.hrInterview.findFirst({
      where: {
        id: input.interviewId,
        organizationId: input.organizationId,
      },
    });

    if (!interview) {
      throw new Error("Interview not found.");
    }

    await tx.hrInterview.update({
      where: { id: interview.id },
      data: {
        googleSyncState: HrSyncState.pending,
        googleSyncError: null,
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "hr_interview",
      entityId: interview.id,
      action: activityLogActions.hrGoogleSyncRetried,
      payload: {
        officeId: interview.officeId,
        objectLabel: interview.title,
      },
    });
  });

  await syncInterviewToGoogle(input);
}
