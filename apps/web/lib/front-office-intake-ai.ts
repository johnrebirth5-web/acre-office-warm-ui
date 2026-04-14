export const FRONT_OFFICE_LEAD_INTAKE_AI_FIELD_KEYS = [
  "fullName",
  "phone",
  "email",
  "stage",
  "intent",
  "budgetMax",
  "preferredAreas",
  "nextFollowUpAt",
  "notes",
] as const;

export type FrontOfficeLeadIntakeAiFieldKey =
  (typeof FRONT_OFFICE_LEAD_INTAKE_AI_FIELD_KEYS)[number];

export const FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS = [
  "multiple_people",
  "household_context",
  "speaker_switching",
  "contact_owner_unclear",
  "multiple_contact_values",
  "multiple_budget_values",
  "relative_timing",
  "low_signal_extract",
  "ambiguous_stage",
  "ambiguous_intent",
  "preview_summary",
] as const;

export type FrontOfficeLeadIntakeAiRiskFlag =
  (typeof FRONT_OFFICE_LEAD_INTAKE_AI_RISK_FLAGS)[number];

export type FrontOfficeLeadIntakeAiProvenance =
  | "explicit_line"
  | "pattern_match"
  | "conversation_inference"
  | "summary_preview";

export type FrontOfficeLeadIntakeAiFieldSuggestion = {
  field: FrontOfficeLeadIntakeAiFieldKey;
  value: string;
  evidence: string;
  provenance: FrontOfficeLeadIntakeAiProvenance;
  explicit: boolean;
  riskFlags: FrontOfficeLeadIntakeAiRiskFlag[];
};

export type FrontOfficeLeadIntakeAiExtraction = {
  provider: "openai";
  model: string;
  fields: FrontOfficeLeadIntakeAiFieldSuggestion[];
};
