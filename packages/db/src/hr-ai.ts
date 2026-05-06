import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

export type HrAiDraft = {
  subject: string;
  body: string;
  draftOnly: true;
};

type AuditInput = {
  organizationId?: string;
  actorMembershipId?: string | null;
  contextId?: string | null;
  label?: string | null;
};

async function recordDraftGenerated(input: AuditInput, objectLabel: string) {
  if (!input.organizationId) {
    return;
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId ?? null,
    entityType: "hr_candidate",
    entityId: input.contextId ?? "hr-ai-draft",
    action: activityLogActions.hrAiDraftGenerated,
    payload: {
      objectLabel,
      details: ["Draft only. No email was sent."],
    },
  });
}

export async function generateOfflineInterviewConfirmationEmail(input: AuditInput & {
  candidateName: string;
  interviewTime: string;
  location: string;
  interviewerNames?: string[];
  ccEmails?: string[];
}): Promise<HrAiDraft> {
  const subject = `Interview confirmation: ${input.candidateName}`;
  const body = [
    `Hi ${input.candidateName},`,
    "",
    `This is to confirm your in-person second interview at ${input.interviewTime}.`,
    `Location: ${input.location}`,
    input.interviewerNames?.length ? `Interview team: ${input.interviewerNames.join(", ")}` : "",
    input.ccEmails?.length ? `CC: ${input.ccEmails.join(", ")}` : "",
    "",
    "Please let us know if you need to adjust the schedule.",
    "",
    "Best,",
    "Acre HR",
  ].filter((line) => line !== "").join("\n");

  await recordDraftGenerated(input, "Offline interview confirmation draft");

  return {
    subject,
    body,
    draftOnly: true,
  };
}

export async function generateWelcomeEmail(input: AuditInput & {
  candidateName: string;
  companyName?: string | null;
  startDate?: string | null;
  attachments?: string[];
}): Promise<HrAiDraft> {
  const subject = `Welcome to ${input.companyName?.trim() || "Acre"}!`;
  const body = [
    `Hi ${input.candidateName},`,
    "",
    `Welcome to ${input.companyName?.trim() || "Acre"}${input.startDate ? ` starting ${input.startDate}` : ""}.`,
    "Please review the attached onboarding guide and finance process before your first day.",
    input.attachments?.length ? `Attachments to include: ${input.attachments.join(", ")}` : "",
    "",
    "Best,",
    "Acre HR",
  ].filter((line) => line !== "").join("\n");

  await recordDraftGenerated(input, "Welcome email draft");

  return {
    subject,
    body,
    draftOnly: true,
  };
}

export async function generateTerminationLetterDraft(input: AuditInput & {
  employeeName: string;
  companyName: string;
  lastWorkingDate: string;
  reason?: string | null;
  returnDueDate?: string | null;
}): Promise<HrAiDraft> {
  const subject = `Termination letter draft: ${input.employeeName}`;
  const body = [
    `${input.companyName}`,
    "",
    "Termination Agreement",
    "",
    `Dear ${input.employeeName},`,
    `This letter is to formally notify you that your employment or engagement with ${input.companyName} will be terminated as of ${input.lastWorkingDate}${input.reason ? `, due to ${input.reason}` : ""}.`,
    `Please return company files, forms, issued devices, and any other company property${input.returnDueDate ? ` no later than ${input.returnDueDate}` : ""}.`,
    "Following the termination date, access to company systems, including company Drive, will be closed or limited.",
    "",
    "You remain bound by all confidentiality, non-solicitation, and non-disparagement obligations.",
    "",
    "Sincerely,",
    "Acre HR",
    "",
    "Employee Signature: _______________________",
    "Date: _______________",
  ].join("\n");

  await recordDraftGenerated(input, "Termination letter draft");

  return {
    subject,
    body,
    draftOnly: true,
  };
}
