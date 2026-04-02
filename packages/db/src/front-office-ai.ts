export type FrontOfficeAiFollowUpKind =
  | "reentry"
  | "postclose"
  | "closing"
  | "lease"
  | "appointment"
  | "content_rescue"
  | "warm_engagement"
  | "handoff"
  | "generic";

export type FrontOfficeAiFollowUpAction = {
  title: string;
  dueAt: string;
};

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildSuggestedFollowUpDate(now: Date, daysFromNow: number) {
  const target = new Date(now);
  target.setDate(target.getDate() + daysFromNow);
  return formatDateValue(target);
}

export function buildFrontOfficeAiFollowUpAction(input: {
  kind: FrontOfficeAiFollowUpKind;
  now: Date;
  clientFullName: string;
  appointmentTitle?: string | null;
}): FrontOfficeAiFollowUpAction {
  switch (input.kind) {
    case "reentry":
      return {
        title: `Nurture check-in with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 21),
      };
    case "postclose":
      return {
        title: `Post-close check-in with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 2),
      };
    case "closing":
      return {
        title: `Confirm closing logistics with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "lease":
      return {
        title: `Confirm lease timing with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 0),
      };
    case "appointment":
      return {
        title: `Prep ${input.appointmentTitle?.trim() || "next appointment"} with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 0),
      };
    case "content_rescue":
      return {
        title: `Follow up on sent shortlist with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "warm_engagement":
      return {
        title: `Follow up on viewed listings with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    case "handoff":
      return {
        title: `Confirm formal handoff package with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 1),
      };
    default:
      return {
        title: `Set next touch with ${input.clientFullName}`,
        dueAt: buildSuggestedFollowUpDate(input.now, 2),
      };
  }
}

export function buildFrontOfficeSuggestedFollowUpHref(input: {
  clientId: string;
  title: string;
  dueAt: string;
}) {
  const params = new URLSearchParams({
    followUpTitle: input.title,
    followUpDueAt: input.dueAt,
    followUpSource: "ai",
  });

  return `/agent/clients/${input.clientId}?${params.toString()}#front-office-follow-up-form`;
}
