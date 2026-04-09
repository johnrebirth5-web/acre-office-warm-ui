"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Button,
  EmptyState,
  FormField,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import {
  extractFrontOfficeLeadIntakeAssist,
  type FrontOfficeLeadIntakeAssistField,
  type FrontOfficeLeadIntakeAssistResult,
} from "./front-office-lead-intake-assist";
import {
  buildFrontOfficeLeadDuplicatePreview,
  type FrontOfficeLeadDuplicatePreviewCandidate,
  type FrontOfficeLeadDuplicatePreviewNeedle,
} from "./front-office-lead-intake-review";
import { FrontOfficeLink } from "./front-office-link";

type FrontOfficeLeadIntakeCardProps = {
  title?: string;
  subtitle?: string;
  density?: "default" | "compact";
  sourceSurface: "dashboard" | "clients";
  initialDuplicatePreviewCandidates?: FrontOfficeLeadDuplicatePreviewCandidate[];
  hydrateDuplicatePreviewCandidates?: boolean;
};

type LeadFormState = {
  fullName: string;
  phone: string;
  email: string;
  source: string;
  stage: string;
  intent: string;
  budgetMax: string;
  preferredAreas: string;
  nextFollowUpAt: string;
  notes: string;
};

type LeadFormFieldKey = keyof LeadFormState;
type LeadFieldErrors = Partial<Record<LeadFormFieldKey, string>>;

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type DuplicateMatch = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  ownerLabel: string;
  detailLabel: string;
  scopeLabel: string;
  confidenceLabel: string;
  matchStrength: number;
  href: string;
  reviewLabel: string;
  recommendedActionLabel: string;
  matchReasons: string[];
};

type CreatedClientState = {
  id: string;
  fullName: string;
};

type AssistFeedbackState = {
  tone: "success" | "error" | "neutral";
  message: string;
} | null;

type IntakeReviewSectionKey =
  | "identity"
  | "qualification"
  | "context"
  | "timing"
  | "notes";

type IntakeReviewSection = {
  key: IntakeReviewSectionKey;
  label: string;
  description: string;
  batchCue: string;
  fieldKeys: LeadFormFieldKey[];
  reviewableCount: number;
  safeApplyCount: number;
  reviewFirstCount: number;
  previewOnlyCount: number;
  pendingCount: number;
  reviewedCount: number;
  fieldSummary: string;
  actionHint: string;
  priorityRank: number;
};

type DuplicatePreviewHydrationState = "idle" | "loading" | "ready" | "error";
type CreateLeadApiErrorCode =
  | "authentication_required"
  | "front_office_create_forbidden"
  | "invalid_request_body"
  | "validation_error"
  | "duplicate_lead"
  | "duplicate_check_failed"
  | "create_failed";

type CreateLeadApiPayload = {
  error?: string;
  errorCode?: CreateLeadApiErrorCode;
  fieldErrors?: LeadFieldErrors;
  duplicateMatches?: DuplicateMatch[];
  contact?: {
    id: string;
    fullName: string;
  };
};

const stageOptions = [
  "Cold Lead",
  "Warm Lead",
  "Contacted",
  "Needs Follow-up",
  "Viewing Scheduled",
  "Viewing Completed",
  "Negotiation",
  "Application / Offer",
  "Won",
  "Lost",
  "Pending",
] as const;

const intentOptions = [
  "Buyer",
  "Rental",
  "Seller",
  "Landlord",
  "Investor",
  "Unknown",
] as const;

const maxAssistImageSizeBytes = 10 * 1024 * 1024;

function buildDefaultNextFollowUpAt() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function buildEmptyFormState(): LeadFormState {
  return {
    fullName: "",
    phone: "",
    email: "",
    source: "Manual entry",
    stage: "Warm Lead",
    intent: "Buyer",
    budgetMax: "",
    preferredAreas: "",
    nextFollowUpAt: buildDefaultNextFollowUpAt(),
    notes: "",
  };
}

function normalizeCompactValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function countMeaningfulAssistChars(value: string) {
  return value.match(/[A-Za-z0-9\u4e00-\u9fff]/g)?.length ?? 0;
}

function getLeadFieldLabel(fieldKey: LeadFormFieldKey) {
  switch (fieldKey) {
    case "fullName":
      return "full name";
    case "phone":
      return "phone";
    case "email":
      return "email";
    case "source":
      return "source";
    case "stage":
      return "stage";
    case "intent":
      return "intent";
    case "budgetMax":
      return "budget";
    case "preferredAreas":
      return "preferred areas";
    case "nextFollowUpAt":
      return "next follow-up";
    case "notes":
      return "notes";
  }
}

function buildFieldErrorSummary(fieldErrors: LeadFieldErrors) {
  const keys = Object.keys(fieldErrors) as LeadFormFieldKey[];

  if (!keys.length) {
    return "";
  }

  if (keys.length === 1) {
    return `Review the ${getLeadFieldLabel(keys[0])} field and try again.`;
  }

  return `Review these fields and try again: ${keys
    .map((key) => getLeadFieldLabel(key))
    .join(", ")}.`;
}

function buildCreateLeadErrorFeedback(
  payload: CreateLeadApiPayload | null,
  responseStatus: number,
) {
  const fieldSummary = buildFieldErrorSummary(payload?.fieldErrors ?? {});

  if (responseStatus === 409 || payload?.errorCode === "duplicate_lead") {
    return (
      payload?.error ??
      "Potential duplicate clients were found inside your visible CRM scope. Open the closest existing record first, compare contact info and stage, then use the duplicate review lane if this is the same lead. Create a separate dossier only if this is truly a different person."
    );
  }

  if (payload?.errorCode === "validation_error") {
    return (
      payload?.error ??
      (fieldSummary
        ? `Lead not created. ${fieldSummary}`
        : "Lead not created. Fix the highlighted field values in the live form, then try again.")
    );
  }

  if (payload?.errorCode === "front_office_create_forbidden") {
    return (
      payload?.error ??
      "You do not have permission to create Front Office leads from this workspace."
    );
  }

  if (payload?.errorCode === "authentication_required") {
    return (
      payload?.error ??
      "Sign in again before creating a Front Office lead."
    );
  }

  if (payload?.errorCode === "duplicate_check_failed") {
    return (
      payload?.error ??
      "Acre could not verify duplicate risk right now, so it stopped before creating anything."
    );
  }

  if (payload?.errorCode === "invalid_request_body") {
    return (
      payload?.error ??
      "Acre needs a valid live intake payload before it can create the dossier."
    );
  }

  return payload?.error ?? "Could not create the Front Office lead.";
}

function omitFieldError(
  fieldErrors: LeadFieldErrors,
  fieldKey: LeadFormFieldKey,
): LeadFieldErrors {
  if (!fieldErrors[fieldKey]) {
    return fieldErrors;
  }

  const nextErrors = {
    ...fieldErrors,
  };

  delete nextErrors[fieldKey];
  return nextErrors;
}

function getAssistFieldReviewKey(field: FrontOfficeLeadIntakeAssistField) {
  return `${field.field}:${normalizeCompactValue(field.value)}`;
}

function getAssistFieldBadge(field: FrontOfficeLeadIntakeAssistField) {
  return field.suggestedActionLabel;
}

function getAssistFieldBadgeTone(field: FrontOfficeLeadIntakeAssistField) {
  if (field.suggestedAction === "safe_apply") {
    return "success" as const;
  }

  if (field.suggestedAction === "review_first") {
    return "warning" as const;
  }

  return "accent" as const;
}

function getAssistFieldConfidenceTone(field: FrontOfficeLeadIntakeAssistField) {
  if (field.confidence === "high") {
    return "success" as const;
  }

  if (field.confidence === "medium") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getAssistFieldProvenanceTone(field: FrontOfficeLeadIntakeAssistField) {
  switch (field.provenance) {
    case "explicit_line":
      return "success" as const;
    case "pattern_match":
      return "accent" as const;
    case "conversation_inference":
      return "warning" as const;
    case "assist_mode":
      return "neutral" as const;
    case "summary_preview":
      return "neutral" as const;
  }
}

function summarizeLabelList(labels: string[], emptyLabel: string, limit = 4) {
  if (!labels.length) {
    return emptyLabel;
  }

  if (labels.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit} more`;
}

function buildDuplicateNextStepLabels(reasons: string[]) {
  const hasEmail = reasons.some((reason) => reason.startsWith("Same email"));
  const hasPhone = reasons.some((reason) => reason.startsWith("Same phone"));
  const hasContactInfoMatch = hasEmail || hasPhone;
  const hasNameMatch = reasons.some((reason) => reason.includes("name"));

  if (hasEmail && hasPhone) {
    return [
      "Open the existing record first",
      "Compare stage, next touch, and source",
      "Use duplicate review if this is the same lead",
    ];
  }

  if (hasContactInfoMatch) {
    return [
      "Open the existing record first",
      "Compare contact info, stage, and next touch",
      "Use duplicate review if this is the same person",
    ];
  }

  if (hasNameMatch) {
    return [
      "Open the existing record first",
      "Compare phone, email, and preferred areas",
      "Create a new dossier only if this is truly different",
    ];
  }

  return [
    "Open the existing record first",
    "Compare stage, source, and next touch",
    "Create separately only if the contact is distinct",
  ];
}

function getAssistReviewSectionKey(
  fieldKey: LeadFormFieldKey,
): IntakeReviewSectionKey {
  switch (fieldKey) {
    case "fullName":
    case "phone":
    case "email":
      return "identity";
    case "source":
    case "stage":
    case "intent":
      return "qualification";
    case "budgetMax":
    case "preferredAreas":
      return "context";
    case "nextFollowUpAt":
      return "timing";
    case "notes":
      return "notes";
  }
}

function getAssistReviewSectionMeta(sectionKey: IntakeReviewSectionKey) {
  switch (sectionKey) {
    case "identity":
      return {
        label: "Identity",
        description:
          "Confirm who this lead is before anything else, because duplicate preview and save-time checks lean on these values first.",
      };
    case "qualification":
      return {
        label: "Qualification",
        description:
          "Quickly review source, stage, and intent so the intake lands in the right active work lane without re-reading the full transcript.",
      };
    case "context":
      return {
        label: "Context",
        description:
          "Budget and area clues are usually enough to steer the first real follow-up, so keep these together and apply them in one pass.",
      };
    case "timing":
      return {
        label: "Timing",
        description:
          "The next follow-up date is the fastest way to keep the lead from going cold, so review this before saving the dossier.",
      };
    case "notes":
      return {
        label: "Notes",
        description:
          "Use the notes field for anything worth preserving that should stay manual, previewable, and easy to scan later.",
      };
  }
}

function getAssistReviewSectionBatchCue(input: {
  sectionKey: IntakeReviewSectionKey;
  pendingCount: number;
  reviewFirstCount: number;
  previewOnlyCount: number;
}) {
  if (input.pendingCount > 0) {
    switch (input.sectionKey) {
      case "identity":
        return "Batch first: confirm who the primary lead is before any apply.";
      case "qualification":
        return "Batch first: resolve source, stage, and intent together.";
      case "context":
        return "Batch first: review budget and area together.";
      case "timing":
        return "Batch first: lock the exact next-touch date.";
      case "notes":
        return "Batch last: notes stay manual unless you rewrite them.";
    }
  }

  if (input.reviewFirstCount > 0) {
    return "Batch next: review the extracted values, then apply the blank live fields together.";
  }

  if (input.previewOnlyCount > 0) {
    return "Batch last: preview-only stays manual.";
  }

  return "Batch ready: safe after review.";
}

function buildAssistReviewSections(input: {
  assistResult: FrontOfficeLeadIntakeAssistResult;
  reviewedFieldKeys: string[];
  formState: LeadFormState;
  defaultFormState: LeadFormState;
  manuallyEditedFields: LeadFormFieldKey[];
}) {
  const sectionKeys: IntakeReviewSectionKey[] = [
    "identity",
    "qualification",
    "context",
    "timing",
    "notes",
  ];

  return sectionKeys.map((sectionKey) => {
    const meta = getAssistReviewSectionMeta(sectionKey);
    const fieldKeys = input.assistResult.fields
      .filter(
        (field) =>
          getAssistReviewSectionKey(field.field as LeadFormFieldKey) ===
          sectionKey,
      )
      .map((field) => field.field as LeadFormFieldKey);
    const sectionFields = input.assistResult.fields.filter((field) =>
      fieldKeys.includes(field.field as LeadFormFieldKey),
    );

    const reviewableCount = sectionFields.filter(
      (field) => field.suggestedAction !== "preview_only",
    ).length;
    const safeApplyCount = sectionFields.filter(
      (field) => field.suggestedAction === "safe_apply",
    ).length;
    const reviewFirstCount = sectionFields.filter(
      (field) => field.suggestedAction === "review_first",
    ).length;
    const previewOnlyCount = sectionFields.filter(
      (field) => field.suggestedAction === "preview_only",
    ).length;
    const pendingCount = sectionFields.filter((field) => {
      if (field.suggestedAction === "preview_only") {
        return false;
      }

      const reviewKey = getAssistFieldReviewKey(field);
      const fieldKey = field.field as LeadFormFieldKey;
      const currentValue = input.formState[fieldKey].trim();

      return (
        !input.reviewedFieldKeys.includes(reviewKey) &&
        normalizeCompactValue(currentValue) !== normalizeCompactValue(field.value)
      );
    }).length;
    const reviewedCount = sectionFields.filter((field) =>
      input.reviewedFieldKeys.includes(getAssistFieldReviewKey(field)),
    ).length;
    const unresolvedCount = pendingCount;
    const manualConfirmationCount = sectionFields.filter(
      (field) =>
        field.suggestedAction === "review_first" &&
        !input.reviewedFieldKeys.includes(getAssistFieldReviewKey(field)),
    ).length;

    return {
      key: sectionKey,
      label: meta.label,
      description: meta.description,
      batchCue: getAssistReviewSectionBatchCue({
        sectionKey,
        pendingCount,
        reviewFirstCount,
        previewOnlyCount,
      }),
      fieldKeys,
      reviewableCount,
      safeApplyCount,
      reviewFirstCount,
      previewOnlyCount,
      pendingCount,
      reviewedCount,
      fieldSummary: summarizeLabelList(
        sectionFields.map((field) => field.label),
        "none",
        3,
      ),
      actionHint:
        unresolvedCount > 0
          ? sectionKey === "identity"
            ? "Resolve identity first so duplicate preview and compare decisions stay accurate."
            : sectionKey === "timing"
              ? "Resolve timing early so the next-touch clock stays useful."
              : "Resolve the unresolved fields in this section before moving to safer applied values."
          : manualConfirmationCount > 0
            ? "These fields still need explicit manual confirmation before anything can move into the form."
            : sectionKey === "notes"
              ? "Keep manual notes last because they rarely gate the next save."
              : "Review this section as a batch, then apply the reviewed blank fields together.",
      priorityRank:
        unresolvedCount > 0
          ? 0
          : manualConfirmationCount > 0
            ? 1
            : previewOnlyCount > 0
              ? 2
              : 3,
    } satisfies IntakeReviewSection;
  });
}

function buildAssistReviewOrderLabels(sections: IntakeReviewSection[]) {
  return sections
    .filter((section) => section.reviewableCount > 0)
    .slice(0, 3)
    .map((section) =>
      section.pendingCount > 0
        ? `${section.label} first`
        : section.reviewFirstCount > 0 && section.reviewedCount < section.reviewFirstCount
          ? `${section.label} next`
          : section.label,
    );
}

function buildAssistReviewFocusLabels(sections: IntakeReviewSection[]) {
  return sections
    .filter(
      (section) =>
        section.pendingCount > 0 ||
        (section.reviewFirstCount > 0 &&
          section.reviewedCount < section.reviewFirstCount),
    )
    .slice(0, 3)
    .map((section) =>
      section.pendingCount > 0
        ? `${section.label} unresolved (${section.pendingCount})`
        : `${section.label} manual confirmation (${
            section.reviewFirstCount - section.reviewedCount
          })`,
    );
}

function isBlankOrUntouchedDefaultField(input: {
  fieldKey: LeadFormFieldKey;
  currentValue: string;
  defaultFormState: LeadFormState;
  manuallyEditedFields: LeadFormFieldKey[];
}) {
  if (!input.currentValue.trim()) {
    return true;
  }

  const defaultValue = input.defaultFormState[input.fieldKey].trim();

  return (
    !input.manuallyEditedFields.includes(input.fieldKey) &&
    normalizeCompactValue(input.currentValue) ===
      normalizeCompactValue(defaultValue)
  );
}

function liveFieldNeedsReplaceConfirmation(input: {
  fieldKey: LeadFormFieldKey;
  currentValue: string;
  defaultFormState: LeadFormState;
  manuallyEditedFields: LeadFormFieldKey[];
}) {
  return (
    Boolean(input.currentValue.trim()) &&
    !isBlankOrUntouchedDefaultField(input)
  );
}

function getAssistFieldStatus(input: {
  field: FrontOfficeLeadIntakeAssistField;
  formState: LeadFormState;
  defaultFormState: LeadFormState;
  appliedFields: LeadFormFieldKey[];
  manuallyEditedFields: LeadFormFieldKey[];
  replaceConfirmationFieldKey: string | null;
  reviewedFieldKeys: string[];
}) {
  const fieldKey = input.field.field as LeadFormFieldKey;
  const currentValue = input.formState[fieldKey].trim();
  const suggestedValue = input.field.value.trim();
  const isReviewed = input.reviewedFieldKeys.includes(
    getAssistFieldReviewKey(input.field),
  );
  const needsReplaceConfirmation = liveFieldNeedsReplaceConfirmation({
    fieldKey,
    currentValue,
    defaultFormState: input.defaultFormState,
    manuallyEditedFields: input.manuallyEditedFields,
  });
  const matchesSuggestion =
    normalizeCompactValue(currentValue) ===
    normalizeCompactValue(suggestedValue);

  if (matchesSuggestion && input.appliedFields.includes(fieldKey)) {
    return "Applied from reviewed assist";
  }

  if (matchesSuggestion && isReviewed) {
    return "Reviewed and matches current form";
  }

  if (matchesSuggestion) {
    return "Matches current form";
  }

  if (input.field.suggestedAction === "preview_only") {
    return isReviewed ? "Reviewed preview only" : "Preview stays manual";
  }

  if (
    input.replaceConfirmationFieldKey === getAssistFieldReviewKey(input.field)
  ) {
    return "Awaiting replace confirmation before the live value changes";
  }

  if (isReviewed && currentValue && !matchesSuggestion) {
    return input.manuallyEditedFields.includes(fieldKey)
      ? "Reviewed, but your manual live value stays in control"
      : "Reviewed, but the live form still keeps the current value";
  }

  if (needsReplaceConfirmation) {
    return isReviewed
      ? "Reviewed, but the live form still keeps your current value"
      : "Review pending. The live form still keeps your current value";
  }

  if (isReviewed) {
    return "Reviewed and ready to fill the live form";
  }

  if (
    isBlankOrUntouchedDefaultField({
      fieldKey,
      currentValue,
      defaultFormState: input.defaultFormState,
      manuallyEditedFields: input.manuallyEditedFields,
    })
  ) {
    return "Review pending before apply";
  }

  return "Current form keeps your live value until review";
}

function getAssistFieldLiveValueLabel(input: {
  field: FrontOfficeLeadIntakeAssistField;
  formState: LeadFormState;
  defaultFormState: LeadFormState;
  manuallyEditedFields: LeadFormFieldKey[];
}) {
  const fieldKey = input.field.field as LeadFormFieldKey;
  const currentValue = input.formState[fieldKey].trim();

  if (!currentValue) {
    return "Live form is still blank";
  }

  if (
    normalizeCompactValue(currentValue) ===
    normalizeCompactValue(input.field.value)
  ) {
    return `Live form now matches: ${currentValue}`;
  }

  if (input.manuallyEditedFields.includes(fieldKey)) {
    return `Manual live value stays in control: ${currentValue}`;
  }

  if (
    normalizeCompactValue(currentValue) ===
    normalizeCompactValue(input.defaultFormState[fieldKey].trim())
  ) {
    return `Default live value still in form: ${currentValue}`;
  }

  return `Current live value: ${currentValue}`;
}

function mergeLeadFormStateWithReviewedAssistFields(
  current: LeadFormState,
  fields: FrontOfficeLeadIntakeAssistField[],
  defaultFormState: LeadFormState,
  manuallyEditedFields: LeadFormFieldKey[],
  reviewedFieldKeys: string[],
) {
  const nextState = {
    ...current,
  };
  const appliedFields: LeadFormFieldKey[] = [];
  const skippedFieldLabels: string[] = [];

  for (const assistField of fields) {
    if (
      assistField.suggestedAction === "preview_only" ||
      !reviewedFieldKeys.includes(getAssistFieldReviewKey(assistField))
    ) {
      continue;
    }

    const field = assistField.field as LeadFormFieldKey;
    const suggestedValue = assistField.value.trim();

    if (!suggestedValue) {
      continue;
    }

    const currentValue = current[field].trim();

    if (
      isBlankOrUntouchedDefaultField({
        fieldKey: field,
        currentValue,
        defaultFormState,
        manuallyEditedFields,
      })
    ) {
      nextState[field] = suggestedValue;
      appliedFields.push(field);
      continue;
    }

    skippedFieldLabels.push(assistField.label);
  }

  return {
    nextState,
    appliedFields,
    skippedFieldLabels: [...new Set(skippedFieldLabels)],
  };
}

function getReviewedAssistFieldValue(input: {
  assistResult: FrontOfficeLeadIntakeAssistResult | null;
  reviewedFieldKeys: string[];
  fieldKey: keyof FrontOfficeLeadIntakeAssistResult["draft"];
}) {
  const match = input.assistResult?.fields.find(
    (field) =>
      field.field === input.fieldKey &&
      input.reviewedFieldKeys.includes(getAssistFieldReviewKey(field)),
  );

  return match?.value.trim() ? match.value.trim() : undefined;
}

function buildDuplicatePreviewNeedles(input: {
  formState: LeadFormState;
  assistResult: FrontOfficeLeadIntakeAssistResult | null;
  reviewedFieldKeys: string[];
}) {
  const needles: FrontOfficeLeadDuplicatePreviewNeedle[] = [];
  const seen = new Set<string>();

  function appendNeedle(
    fullName: string,
    sourceLabel: string,
    preferredAreas?: string,
    source?: string,
    email?: string,
    phone?: string,
  ) {
    const normalized = [
      normalizeCompactValue(fullName),
      normalizeCompactValue(email ?? ""),
      normalizeCompactValue(phone ?? ""),
    ]
      .filter(Boolean)
      .join("|");

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    needles.push({
      fullName: fullName.trim(),
      sourceLabel,
      preferredAreas,
      source,
      email,
      phone,
    });
  }

  if (
    input.formState.fullName.trim() ||
    input.formState.email.trim() ||
    input.formState.phone.trim()
  ) {
    appendNeedle(
      input.formState.fullName,
      "the current form",
      input.formState.preferredAreas,
      input.formState.source,
      input.formState.email,
      input.formState.phone,
    );
  }

  const assistNameField = input.assistResult?.fields.find(
    (field) =>
      field.field === "fullName" &&
      field.suggestedAction !== "preview_only" &&
      input.reviewedFieldKeys.includes(getAssistFieldReviewKey(field)),
  );

  const reviewedAssistFullName = assistNameField?.value.trim() ?? "";
  const reviewedAssistEmail =
    getReviewedAssistFieldValue({
      assistResult: input.assistResult,
      reviewedFieldKeys: input.reviewedFieldKeys,
      fieldKey: "email",
    }) ?? "";
  const reviewedAssistPhone =
    getReviewedAssistFieldValue({
      assistResult: input.assistResult,
      reviewedFieldKeys: input.reviewedFieldKeys,
      fieldKey: "phone",
    }) ?? "";

  if (
    reviewedAssistFullName ||
    reviewedAssistEmail.trim() ||
    reviewedAssistPhone.trim()
  ) {
    appendNeedle(
      reviewedAssistFullName,
      "the reviewed assist suggestion",
      getReviewedAssistFieldValue({
        assistResult: input.assistResult,
        reviewedFieldKeys: input.reviewedFieldKeys,
        fieldKey: "preferredAreas",
      }),
      getReviewedAssistFieldValue({
        assistResult: input.assistResult,
        reviewedFieldKeys: input.reviewedFieldKeys,
        fieldKey: "source",
      }),
      reviewedAssistEmail,
      reviewedAssistPhone,
    );
  }

  return needles;
}

function buildDuplicateGateSignals(input: {
  formState: LeadFormState;
  assistResult: FrontOfficeLeadIntakeAssistResult | null;
  reviewedFieldKeys: string[];
}) {
  const signals: string[] = [];
  const seen = new Set<string>();

  function appendSignal(label: string, value: string, detail: string) {
    const normalized = `${label}:${normalizeCompactValue(value)}`;

    if (!normalizeCompactValue(value) || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    signals.push(`${label}: ${value.trim()} · ${detail}`);
  }

  if (input.formState.fullName.trim()) {
    appendSignal("Name", input.formState.fullName, "already in the live form");
  }

  if (input.formState.phone.trim()) {
    appendSignal("Phone", input.formState.phone, "already in the live form");
  }

  if (input.formState.email.trim()) {
    appendSignal("Email", input.formState.email, "already in the live form");
  }

  const identityFields = input.assistResult?.fields.filter(
    (field) =>
      field.field === "fullName" ||
      field.field === "phone" ||
      field.field === "email",
  );

  for (const field of identityFields ?? []) {
    const fieldKey = field.field as keyof LeadFormState;
    const currentValue = input.formState[fieldKey].trim();
    const reviewState = input.reviewedFieldKeys.includes(
      getAssistFieldReviewKey(field),
    )
      ? "reviewed in assist"
      : "still pending review";

    if (
      normalizeCompactValue(currentValue) === normalizeCompactValue(field.value)
    ) {
      continue;
    }

    appendSignal(
      field.label,
      field.value,
      `${field.confidenceLabel.toLowerCase()} suggestion, ${reviewState}`,
    );
  }

  return signals;
}

function mapSnapshotClientsToPreviewCandidates(input: unknown) {
  if (!input || typeof input !== "object") {
    return [] as FrontOfficeLeadDuplicatePreviewCandidate[];
  }

  const snapshot = (input as { snapshot?: { clients?: unknown[] } }).snapshot;
  const clients = Array.isArray(snapshot?.clients) ? snapshot.clients : [];

  return clients.flatMap((client) => {
    if (!client || typeof client !== "object") {
      return [];
    }

    const record = client as Record<string, unknown>;

    if (
      typeof record.id !== "string" ||
      typeof record.fullName !== "string" ||
      typeof record.stage !== "string" ||
      typeof record.sourceLabel !== "string" ||
      typeof record.nextTouchLabel !== "string" ||
      typeof record.href !== "string"
    ) {
      return [];
    }

    return [
      {
        id: record.id,
        fullName: record.fullName,
        stage: record.stage,
        sourceLabel: record.sourceLabel,
        nextTouchLabel: record.nextTouchLabel,
        href: record.href,
        areasLabel:
          typeof record.areasLabel === "string" ? record.areasLabel : undefined,
        email: typeof record.email === "string" ? record.email : undefined,
        phone: typeof record.phone === "string" ? record.phone : undefined,
      },
    ] satisfies FrontOfficeLeadDuplicatePreviewCandidate[];
  });
}

export function FrontOfficeLeadIntakeCard(
  props: FrontOfficeLeadIntakeCardProps,
) {
  const router = useRouter();
  const density = props.density ?? "default";
  const duplicateReviewHref =
    "/agent/clients?clientView=duplicate_review#duplicate-review";
  const duplicateReviewLabel =
    props.sourceSurface === "clients"
      ? "Open duplicate review lane"
      : "Open duplicate review queue";
  const initialFormDefaultsRef = useRef<LeadFormState>(buildEmptyFormState());
  const [formDefaults, setFormDefaults] = useState<LeadFormState>(
    initialFormDefaultsRef.current,
  );
  const [formState, setFormState] = useState<LeadFormState>(
    initialFormDefaultsRef.current,
  );
  const [manuallyEditedFields, setManuallyEditedFields] = useState<
    LeadFormFieldKey[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({});
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>(
    [],
  );
  const [createdClient, setCreatedClient] = useState<CreatedClientState | null>(
    null,
  );
  const [assistTranscript, setAssistTranscript] = useState("");
  const [assistImage, setAssistImage] = useState<File | null>(null);
  const [assistInputResetKey, setAssistInputResetKey] = useState(0);
  const [assistResult, setAssistResult] =
    useState<FrontOfficeLeadIntakeAssistResult | null>(null);
  const [assistReviewedFieldKeys, setAssistReviewedFieldKeys] = useState<
    string[]
  >([]);
  const [assistAppliedFields, setAssistAppliedFields] = useState<
    LeadFormFieldKey[]
  >([]);
  const [assistReplaceConfirmationFieldKey, setAssistReplaceConfirmationFieldKey] =
    useState<string | null>(null);
  const [assistFeedback, setAssistFeedback] =
    useState<AssistFeedbackState>(null);
  const [assistProgressMessage, setAssistProgressMessage] = useState("");
  const [isExtractingAssist, setIsExtractingAssist] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicatePreviewCandidates, setDuplicatePreviewCandidates] = useState<
    FrontOfficeLeadDuplicatePreviewCandidate[]
  >(props.initialDuplicatePreviewCandidates ?? []);
  const [duplicatePreviewHydrationState, setDuplicatePreviewHydrationState] =
    useState<DuplicatePreviewHydrationState>(
      props.hydrateDuplicatePreviewCandidates ? "idle" : "ready",
    );
  const [duplicatePreviewHydrationError, setDuplicatePreviewHydrationError] =
    useState<string | null>(null);
  const assistRunIdRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending || isExtractingAssist;

  function resetLiveForm() {
    const nextDefaults = buildEmptyFormState();
    setFormDefaults(nextDefaults);
    setFormState(nextDefaults);
    setManuallyEditedFields([]);
    setFieldErrors({});
    setAssistReplaceConfirmationFieldKey(null);
  }

  function clearAssistOutput() {
    assistRunIdRef.current += 1;
    setAssistResult(null);
    setAssistReviewedFieldKeys([]);
    setAssistAppliedFields([]);
    setAssistReplaceConfirmationFieldKey(null);
    setAssistFeedback(null);
    setAssistProgressMessage("");
    setIsExtractingAssist(false);
  }

  function resetAssistComposer() {
    clearAssistOutput();
    setAssistTranscript("");
    setAssistImage(null);
    setAssistInputResetKey((current) => current + 1);
  }

  function handleFieldChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;
    const fieldKey = name as LeadFormFieldKey;
    const hadFieldError = Boolean(fieldErrors[fieldKey]);

    setFormState((current) => ({
      ...current,
      [fieldKey]: value,
    }));
    setFieldErrors((current) => omitFieldError(current, fieldKey));
    setManuallyEditedFields((current) =>
      current.includes(fieldKey) ? current : [...current, fieldKey],
    );
    setAssistReplaceConfirmationFieldKey(null);

    setAssistAppliedFields((current) => {
      if (!current.includes(fieldKey)) {
        return current;
      }

      const assistField = assistResult?.fields.find(
        (field) => field.field === fieldKey,
      );

      if (!assistField) {
        return current.filter((entry) => entry !== fieldKey);
      }

      return normalizeCompactValue(value) ===
        normalizeCompactValue(assistField.value)
        ? current
        : current.filter((entry) => entry !== fieldKey);
    });

    if (
      fieldKey === "fullName" ||
      fieldKey === "phone" ||
      fieldKey === "email"
    ) {
      setDuplicateMatches([]);
      setFeedback((current) => (current?.tone === "error" ? null : current));
      return;
    }

    if (hadFieldError) {
      setFeedback((current) => (current?.tone === "error" ? null : current));
    }
  }

  function toggleAssistFieldReviewed(field: FrontOfficeLeadIntakeAssistField) {
    const reviewKey = getAssistFieldReviewKey(field);

    setAssistReplaceConfirmationFieldKey((current) =>
      current === reviewKey ? null : current,
    );
    setAssistReviewedFieldKeys((current) =>
      current.includes(reviewKey)
        ? current.filter((entry) => entry !== reviewKey)
        : [...current, reviewKey],
    );
  }

  function handleReviewUnresolvedAssistSections() {
    if (!assistResult) {
      return;
    }

    const unresolvedSectionFieldKeys = assistReviewSections
      .filter(
        (section) =>
          section.pendingCount > 0 ||
          (section.reviewFirstCount > 0 &&
            section.reviewedCount < section.reviewFirstCount),
      )
      .flatMap((section) => section.fieldKeys);

    const reviewableFieldKeys = assistResult.fields
      .filter(
        (field) =>
          unresolvedSectionFieldKeys.includes(field.field as LeadFormFieldKey) &&
          field.suggestedAction !== "preview_only",
      )
      .map((field) => getAssistFieldReviewKey(field));

    if (!reviewableFieldKeys.length) {
      setAssistFeedback({
        tone: "neutral",
        message:
          "There are no unresolved sections left to batch-review. Safe suggestions and reviewed fields are already separated below.",
      });
      return;
    }

    setAssistReviewedFieldKeys((current) => [
      ...new Set([...current, ...reviewableFieldKeys]),
    ]);
    setAssistFeedback({
      tone: "success",
      message: `${reviewableFieldKeys.length} suggestion(s) from unresolved sections were marked reviewed. ${assistReviewOrderLabels.length ? `Next up: ${assistReviewOrderLabels.join(", ")}.` : "Apply the reviewed-blank-fields action next if you want to copy them into blank live fields."}`,
    });
  }

  function handleApplyAssistField(field: FrontOfficeLeadIntakeAssistField) {
    if (field.suggestedAction === "preview_only") {
      setAssistFeedback({
        tone: "neutral",
        message:
          "Preview-only fields stay out of the live form. Rewrite or paste them manually if you want to keep them.",
      });
      return;
    }

    const reviewKey = getAssistFieldReviewKey(field);

    if (!assistReviewedFieldKeys.includes(reviewKey)) {
      setAssistFeedback({
        tone: "neutral",
        message: `Review ${field.label} first, then apply it into the intake form.`,
      });
      return;
    }

    const targetField = field.field as LeadFormFieldKey;
    const currentValue = formState[targetField].trim();
    const needsReplaceConfirmation = liveFieldNeedsReplaceConfirmation({
      fieldKey: targetField,
      currentValue,
      defaultFormState: formDefaults,
      manuallyEditedFields,
    });

    if (
      needsReplaceConfirmation &&
      assistReplaceConfirmationFieldKey !== reviewKey
    ) {
      setAssistReplaceConfirmationFieldKey(reviewKey);
      setAssistFeedback({
        tone: "neutral",
        message: `${field.label} already has a live form value. Click apply once more only if you want to replace that current value with the reviewed assist suggestion.`,
      });
      return;
    }

    setAssistReplaceConfirmationFieldKey(null);
    setFormState((current) => ({
      ...current,
      [targetField]: field.value,
    }));
    setFieldErrors((current) => omitFieldError(current, targetField));
    setAssistAppliedFields((current) =>
      current.includes(targetField) ? current : [...current, targetField],
    );
    setManuallyEditedFields((current) =>
      current.filter((entry) => entry !== targetField),
    );
    if (
      targetField === "fullName" ||
      targetField === "phone" ||
      targetField === "email"
    ) {
      setDuplicateMatches([]);
      setFeedback((current) => (current?.tone === "error" ? null : current));
    }
    setAssistFeedback({
      tone: "success",
      message: needsReplaceConfirmation
        ? `${field.label} replaced the previous live value after explicit confirmation.`
        : `${field.label} was copied into the intake form from a reviewed assist suggestion.`,
    });
  }

  function handleApplyReviewedAssistFields() {
    if (!assistResult) {
      return;
    }

    const mergeOutcome = mergeLeadFormStateWithReviewedAssistFields(
      formState,
      assistResult.fields,
      formDefaults,
      manuallyEditedFields,
      assistReviewedFieldKeys,
    );

    if (!mergeOutcome.appliedFields.length) {
      setAssistFeedback({
        tone: "neutral",
        message:
          assistReviewedFieldKeys.length > 0
            ? "No reviewed blank fields were waiting. Acre kept your current form values in place."
            : "Review one or more assist fields first, then use the reviewed-blank-fields action.",
      });
      return;
    }

    setFormState(mergeOutcome.nextState);
    setFieldErrors((current) => {
      let nextErrors = current;

      for (const field of mergeOutcome.appliedFields) {
        nextErrors = omitFieldError(nextErrors, field);
      }

      return nextErrors;
    });
    setManuallyEditedFields((current) =>
      current.filter((field) => !mergeOutcome.appliedFields.includes(field)),
    );
    setAssistAppliedFields((current) => [
      ...new Set([...current, ...mergeOutcome.appliedFields]),
    ]);
    setAssistReplaceConfirmationFieldKey(null);
    if (
      mergeOutcome.appliedFields.includes("fullName") ||
      mergeOutcome.appliedFields.includes("phone") ||
      mergeOutcome.appliedFields.includes("email")
    ) {
      setDuplicateMatches([]);
      setFeedback((current) => (current?.tone === "error" ? null : current));
    }
    setAssistFeedback({
      tone: "success",
      message: `${mergeOutcome.appliedFields.length} reviewed suggestion(s) were copied into blank or default form fields.${mergeOutcome.skippedFieldLabels.length ? ` ${mergeOutcome.skippedFieldLabels.join(", ")} stayed untouched because the live form already has a value.` : ""}`,
    });
  }

  function handleReviewAssistSection(fieldKeys: LeadFormFieldKey[]) {
    if (!assistResult) {
      return;
    }

    const reviewedKeys = assistResult.fields
      .filter(
        (field) =>
          fieldKeys.includes(field.field as LeadFormFieldKey) &&
          field.suggestedAction !== "preview_only",
      )
      .map((field) => getAssistFieldReviewKey(field));

    if (!reviewedKeys.length) {
      setAssistFeedback({
        tone: "neutral",
        message:
          "That section only contains preview-only fields right now, so there is nothing batch-reviewable yet.",
      });
      return;
    }

    setAssistReviewedFieldKeys((current) => [
      ...new Set([...current, ...reviewedKeys]),
    ]);
    setAssistReplaceConfirmationFieldKey(null);
    setAssistFeedback({
      tone: "success",
      message: `${reviewedKeys.length} field(s) in this section were marked reviewed. ${assistReviewOrderLabels.length ? `Current review order: ${assistReviewOrderLabels.join(", ")}.` : "Apply the reviewed blank fields when you are ready."}`,
    });
  }

  function handleApplyReviewedAssistSection(fieldKeys: LeadFormFieldKey[]) {
    if (!assistResult) {
      return;
    }

    const filteredFields = assistResult.fields.filter((field) =>
      fieldKeys.includes(field.field as LeadFormFieldKey),
    );

    const mergeOutcome = mergeLeadFormStateWithReviewedAssistFields(
      formState,
      filteredFields,
      formDefaults,
      manuallyEditedFields,
      assistReviewedFieldKeys,
    );

    if (!mergeOutcome.appliedFields.length) {
      setAssistFeedback({
        tone: "neutral",
        message:
          "No reviewed blank fields were waiting in that section. Review the section first or keep the current live values in place.",
      });
      return;
    }

    setFormState(mergeOutcome.nextState);
    setFieldErrors((current) => {
      let nextErrors = current;

      for (const field of mergeOutcome.appliedFields) {
        nextErrors = omitFieldError(nextErrors, field);
      }

      return nextErrors;
    });
    setManuallyEditedFields((current) =>
      current.filter((field) => !mergeOutcome.appliedFields.includes(field)),
    );
    setAssistAppliedFields((current) => [
      ...new Set([...current, ...mergeOutcome.appliedFields]),
    ]);
    setAssistReplaceConfirmationFieldKey(null);
    if (
      mergeOutcome.appliedFields.includes("fullName") ||
      mergeOutcome.appliedFields.includes("phone") ||
      mergeOutcome.appliedFields.includes("email")
    ) {
      setDuplicateMatches([]);
      setFeedback((current) => (current?.tone === "error" ? null : current));
    }
    setAssistFeedback({
      tone: "success",
      message: `${mergeOutcome.appliedFields.length} reviewed field(s) were copied from the section into blank or default form values.${mergeOutcome.skippedFieldLabels.length ? ` ${mergeOutcome.skippedFieldLabels.join(", ")} stayed untouched because the live form already has a value.` : ""}`,
    });
  }

  function handleAssistTranscriptChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    clearAssistOutput();
    setAssistTranscript(event.target.value);
  }

  function handleAssistImageChange(event: ChangeEvent<HTMLInputElement>) {
    clearAssistOutput();
    setAssistImage(event.target.files?.[0] ?? null);
  }

  async function handleExtractAssist() {
    const transcriptText = assistTranscript.trim();

    if (!assistImage && !transcriptText) {
      setAssistFeedback({
        tone: "error",
        message:
          "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
      });
      return;
    }

    if (assistImage && !assistImage.type.startsWith("image/")) {
      setAssistFeedback({
        tone: "error",
        message:
          "Upload a screenshot image file only. PNG or JPG chat crops work best for OCR review.",
      });
      return;
    }

    if (assistImage && assistImage.size > maxAssistImageSizeBytes) {
      setAssistFeedback({
        tone: "error",
        message:
          "That screenshot is too large for quick browser-side OCR. Try a tighter crop under 10 MB.",
      });
      return;
    }

    if (
      transcriptText &&
      !assistImage &&
      countMeaningfulAssistChars(transcriptText) < 12
    ) {
      setAssistFeedback({
        tone: "error",
        message:
          "Paste a little more context first. Three to eight lines with a name, contact clue, area, budget, or next step usually work best.",
      });
      return;
    }

    const assistRunId = assistRunIdRef.current + 1;
    assistRunIdRef.current = assistRunId;
    setAssistResult(null);
    setAssistReviewedFieldKeys([]);
    setAssistAppliedFields([]);
    setAssistFeedback(null);
    setAssistProgressMessage(
      assistImage
        ? "Preparing browser-side OCR for the uploaded screenshot..."
        : "Parsing pasted transcript...",
    );
    setIsExtractingAssist(true);

    const isCurrentRun = () => assistRunIdRef.current === assistRunId;

    try {
      let ocrText = "";
      let ocrFailed = false;

      try {
        if (assistImage) {
          const { recognize } = await import("tesseract.js");
          const { data } = await recognize(assistImage, "eng+chi_sim", {
            logger: (message) => {
              if (!isCurrentRun()) {
                return;
              }

              const progress =
                typeof message.progress === "number"
                  ? ` ${Math.round(message.progress * 100)}%`
                  : "";
              setAssistProgressMessage(`${message.status}${progress}`);
            },
          });

          if (!isCurrentRun()) {
            return;
          }

          ocrText = data.text.trim();
        }
      } catch {
        ocrFailed = true;
      }

      if (!isCurrentRun()) {
        return;
      }

      const combinedText = [transcriptText, ocrText]
        .filter(Boolean)
        .join("\n\n");

      if (!combinedText) {
        setAssistProgressMessage("");
        setAssistFeedback({
          tone: "error",
          message:
            "Acre could not read usable text from that screenshot. Try a tighter crop, better contrast, or paste the chat text directly.",
        });
        return;
      }

      const result = extractFrontOfficeLeadIntakeAssist({
        rawText: combinedText,
        sourceMode:
          assistImage && transcriptText
            ? "hybrid"
            : assistImage
              ? "image"
              : "text",
      });
      const feedbackParts: string[] = [];

      if (assistImage && ocrText) {
        feedbackParts.push("Screenshot text extracted.");
      }

      if (transcriptText) {
        feedbackParts.push("Transcript parsed.");
      }

      if (result.fields.length) {
        feedbackParts.push(`${result.fields.length} lead field(s) detected.`);
        feedbackParts.push("Nothing changed in the live intake form yet.");
      } else {
        feedbackParts.push("No structured lead fields were detected yet.");
      }

      if (result.safeApplyFieldCount > 0) {
        feedbackParts.push(
          `${result.safeApplyFieldCount} suggestion(s) are safe to apply after review.`,
        );
      }

      if (result.reviewFieldCount > 0) {
        feedbackParts.push(
          `${result.reviewFieldCount} field(s) stayed in review-first mode.`,
        );
      }

      if (result.previewOnlyFieldCount > 0) {
        feedbackParts.push(
          `${result.previewOnlyFieldCount} field(s) stayed preview-only.`,
        );
      }

      if (result.safetySummary.tone === "warning") {
        feedbackParts.push(result.safetySummary.label);
      }

      if (result.readinessSummary.tone === "warning") {
        feedbackParts.push(result.readinessSummary.label);
      }

      if (ocrFailed && transcriptText) {
        feedbackParts.push(
          "Screenshot OCR could not finish, so Acre used the pasted transcript only.",
        );
      }

      if (!isCurrentRun()) {
        return;
      }

      setAssistResult(result);
      setAssistProgressMessage("");
      setAssistFeedback({
        tone: result.fields.length ? "success" : "neutral",
        message: feedbackParts.join(" "),
      });
    } catch {
      if (!isCurrentRun()) {
        return;
      }

      setAssistProgressMessage("");
      setAssistFeedback({
        tone: "error",
        message:
          "Acre could not finish intake extraction right now. Retry with a cleaner screenshot or paste the transcript directly.",
      });
    } finally {
      if (isCurrentRun()) {
        setIsExtractingAssist(false);
      }
    }
  }

  async function submitLead(skipDuplicateCheck = false) {
    setFieldErrors({});
    const response = await fetch("/api/agent/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formState,
        skipDuplicateCheck,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | CreateLeadApiPayload
      | null;

    if (response.status === 409 && payload?.duplicateMatches?.length) {
      setFieldErrors(payload.fieldErrors ?? {});
      setDuplicateMatches(payload.duplicateMatches);
      setFeedback({
        tone: "error",
        message: buildCreateLeadErrorFeedback(payload, response.status),
      });
      return false;
    }

    if (payload?.fieldErrors) {
      setFieldErrors(payload.fieldErrors ?? {});
    }

    if (!response.ok || !payload?.contact) {
      setFeedback({
        tone: "error",
        message: buildCreateLeadErrorFeedback(payload, response.status),
      });
      return false;
    }

    setDuplicateMatches([]);
    setFieldErrors({});
    setCreatedClient({
      id: payload.contact.id,
      fullName: payload.contact.fullName,
    });
    setFeedback({
      tone: "success",
      message:
        "Lead captured. Front Office will refresh now so the queue and stage counts stay current.",
    });
    resetLiveForm();
    resetAssistComposer();
    startTransition(() => {
      router.refresh();
      setIsSaving(false);
    });
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setCreatedClient(null);
    setDuplicateMatches([]);
    setIsSaving(true);

    const didCreate = await submitLead(false);

    if (!didCreate) {
      setIsSaving(false);
    }
  }

  async function handleCreateAnyway() {
    setFeedback(null);
    setCreatedClient(null);
    setIsSaving(true);

    const didCreate = await submitLead(true);

    if (!didCreate) {
      setIsSaving(false);
    }
  }

  const duplicatePreviewNeedles = useMemo(
    () =>
      buildDuplicatePreviewNeedles({
        formState,
        assistResult,
        reviewedFieldKeys: assistReviewedFieldKeys,
      }),
    [assistResult, assistReviewedFieldKeys, formState],
  );
  const deferredDuplicatePreviewNeedles = useDeferredValue(
    duplicatePreviewNeedles,
  );
  const duplicateGateSignals = useMemo(
    () =>
      buildDuplicateGateSignals({
        formState,
        assistResult,
        reviewedFieldKeys: assistReviewedFieldKeys,
      }),
    [assistResult, assistReviewedFieldKeys, formState],
  );
  const pendingDuplicateIdentityAssistCount = useMemo(
    () =>
      assistResult?.fields.filter((field) => {
        if (
          field.suggestedAction === "preview_only" ||
          (field.field !== "fullName" &&
            field.field !== "phone" &&
            field.field !== "email")
        ) {
          return false;
        }

        const currentValue = formState[field.field as LeadFormFieldKey].trim();

        if (
          normalizeCompactValue(currentValue) ===
          normalizeCompactValue(field.value)
        ) {
          return false;
        }

        return !assistReviewedFieldKeys.includes(getAssistFieldReviewKey(field));
      }).length ?? 0,
    [assistResult, assistReviewedFieldKeys, formState],
  );
  const duplicatePreviewSourceSummary = useMemo(() => {
    const hasLiveFormNeedle = duplicatePreviewNeedles.some(
      (needle) => needle.sourceLabel === "the current form",
    );
    const hasReviewedAssistNeedle = duplicatePreviewNeedles.some(
      (needle) => needle.sourceLabel === "the reviewed assist suggestion",
    );

    if (hasLiveFormNeedle && hasReviewedAssistNeedle) {
      return "the live form plus reviewed assist values";
    }

    if (hasReviewedAssistNeedle) {
      return "reviewed assist values";
    }

    return "the live form";
  }, [duplicatePreviewNeedles]);
  const pendingReviewableAssistCount = useMemo(
    () =>
      assistResult?.fields.filter((field) => {
        if (field.suggestedAction === "preview_only") {
          return false;
        }

        const reviewKey = getAssistFieldReviewKey(field);
        const fieldKey = field.field as LeadFormFieldKey;
        const currentValue = formState[fieldKey].trim();

        return (
          !assistReviewedFieldKeys.includes(reviewKey) &&
          normalizeCompactValue(currentValue) !==
            normalizeCompactValue(field.value)
        );
      }).length ?? 0,
    [assistResult, assistReviewedFieldKeys, formState],
  );
  const reviewedReviewableAssistCount = useMemo(
    () =>
      assistResult?.fields.filter(
        (field) =>
          field.suggestedAction !== "preview_only" &&
          assistReviewedFieldKeys.includes(getAssistFieldReviewKey(field)),
      ).length ?? 0,
    [assistResult, assistReviewedFieldKeys],
  );
  const assistReviewSections = useMemo(
    () =>
      assistResult
        ? buildAssistReviewSections({
            assistResult,
            reviewedFieldKeys: assistReviewedFieldKeys,
            formState,
            defaultFormState: formDefaults,
            manuallyEditedFields,
          }).sort((left, right) => {
            if (left.priorityRank !== right.priorityRank) {
              return left.priorityRank - right.priorityRank;
            }

            if (left.pendingCount !== right.pendingCount) {
              return right.pendingCount - left.pendingCount;
            }

            if (left.reviewFirstCount !== right.reviewFirstCount) {
              return right.reviewFirstCount - left.reviewFirstCount;
            }

            return left.label.localeCompare(right.label);
          })
        : [],
    [assistResult, assistReviewedFieldKeys, formDefaults, formState, manuallyEditedFields],
  );
  const manualAssistOverrideCount = useMemo(
    () =>
      assistResult?.fields.filter((field) => {
        if (field.suggestedAction === "preview_only") {
          return false;
        }

        const fieldKey = field.field as LeadFormFieldKey;
        const currentValue = formState[fieldKey].trim();

        return (
          Boolean(currentValue) &&
          manuallyEditedFields.includes(fieldKey) &&
          normalizeCompactValue(currentValue) !==
            normalizeCompactValue(field.value)
        );
      }).length ?? 0,
    [assistResult, formState, manuallyEditedFields],
  );
  const shouldShowDuplicatePreviewSurface =
    duplicateGateSignals.length > 0 || pendingDuplicateIdentityAssistCount > 0;
  const unresolvedAssistSectionCount = useMemo(
    () => assistReviewSections.filter((section) => section.pendingCount > 0).length,
    [assistReviewSections],
  );
  const assistReviewOrderLabels = useMemo(
    () => buildAssistReviewOrderLabels(assistReviewSections),
    [assistReviewSections],
  );
  const assistReviewFocusLabels = useMemo(
    () => buildAssistReviewFocusLabels(assistReviewSections),
    [assistReviewSections],
  );
  const manualConfirmationAssistSectionCount = useMemo(
    () =>
      assistReviewSections.filter(
        (section) =>
          section.pendingCount === 0 &&
          section.reviewFirstCount > 0 &&
          section.reviewedCount < section.reviewFirstCount,
      ).length,
    [assistReviewSections],
  );

  useEffect(() => {
    if (
      !props.hydrateDuplicatePreviewCandidates ||
      duplicatePreviewHydrationState !== "idle" ||
      deferredDuplicatePreviewNeedles.length === 0
    ) {
      return;
    }

    const controller = new AbortController();
    setDuplicatePreviewHydrationState("loading");
    setDuplicatePreviewHydrationError(null);

    void fetch("/api/clients", {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            "Could not load visible clients for duplicate preview.",
          );
        }

        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setDuplicatePreviewCandidates(
          mapSnapshotClientsToPreviewCandidates(payload),
        );
        setDuplicatePreviewHydrationState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setDuplicatePreviewHydrationState("error");
        setDuplicatePreviewHydrationError(
          error instanceof Error
            ? error.message
            : "Could not load duplicate preview candidates.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [
    deferredDuplicatePreviewNeedles.length,
    duplicatePreviewHydrationState,
    props.hydrateDuplicatePreviewCandidates,
  ]);

  const duplicatePreviewMatches = useMemo(
    () =>
      buildFrontOfficeLeadDuplicatePreview({
        candidates: duplicatePreviewCandidates,
        needles: deferredDuplicatePreviewNeedles,
      }),
    [deferredDuplicatePreviewNeedles, duplicatePreviewCandidates],
  );

  return (
    <SectionCard
      className={`office-list-card front-office-lead-intake-card ${
        density === "compact" ? "is-compact" : ""
      }`}
      subtitle={
        props.subtitle ??
        "Capture the next live lead without leaving Front Office. This writes into the shared client record, stage timeline, and follow-up clock."
      }
      title={props.title ?? "Quick lead intake"}
    >
      <div className="front-office-lead-intake-shell">
        <div className="front-office-lead-intake-copy">
          <strong>Fast enough for the first call.</strong>
          <p>
            Capture only what the next touch needs now: who the lead is, what
            they want, where they are looking, and when follow-up should happen.
          </p>
          <div className="front-office-record-meta">
            <span>
              {props.sourceSurface === "dashboard"
                ? "Dashboard entry"
                : "Clients workspace entry"}
            </span>
            <span>Creates a real FO dossier</span>
            <span>Keeps BO handoff boundary intact</span>
          </div>
        </div>

        <form
          className="front-office-calendar-form front-office-lead-intake-form"
          onSubmit={handleSubmit}
        >
          <div className="front-office-lead-intake-assist">
            <div className="front-office-lead-intake-assist-copy">
              <strong>OCR / transcript assist beta</strong>
              <p>
                Drop in a WeChat screenshot or paste the chat thread. Acre reads
                it in the browser, keeps field-level confidence and provenance
                on every suggestion, stays safer around household or multi-party
                threads, and waits for review before anything touches the live
                intake form.
              </p>
              <div className="front-office-record-meta">
                <span>Browser-side extraction only</span>
                <span>Field-level confidence + provenance</span>
                <span>Review-then-apply</span>
                <span>Safer household parsing</span>
                <span>No auto-create or auto-send</span>
              </div>
            </div>

            <div className="office-form-grid front-office-lead-intake-assist-grid">
              <FormField
                className="office-form-grid-span-2"
                helper={
                  assistImage
                    ? `Selected screenshot: ${assistImage.name}`
                    : "Optional. PNG / JPG chat screenshots work best."
                }
                label="Screenshot OCR"
              >
                <input
                  accept="image/*"
                  className="front-office-lead-intake-file-input"
                  disabled={isBusy}
                  key={assistInputResetKey}
                  onChange={handleAssistImageChange}
                  type="file"
                />
              </FormField>

              <FormField
                className="office-form-grid-span-3"
                helper="Optional. Paste the live chat, notes, or call transcript to improve extraction."
                label="Transcript or chat text"
              >
                <TextareaInput
                  disabled={isBusy}
                  onChange={handleAssistTranscriptChange}
                  placeholder="Buyer from WeChat. Name: Jamie Chen. Wants LIC or Astoria, budget up to $5,500, tour next week..."
                  rows={4}
                  value={assistTranscript}
                />
              </FormField>
            </div>

            <div className="front-office-lead-intake-actions front-office-lead-intake-assist-actions">
              <Button
                disabled={isBusy || (!assistImage && !assistTranscript.trim())}
                onClick={() => {
                  void handleExtractAssist();
                }}
                type="button"
              >
                {isExtractingAssist ? "Extracting..." : "Extract intake"}
              </Button>
              <Button
                disabled={isBusy}
                onClick={resetAssistComposer}
                type="button"
                variant="secondary"
              >
                Clear assist
              </Button>
            </div>

            {assistProgressMessage ? (
              <p className="front-office-calendar-feedback is-neutral">
                {assistProgressMessage}
              </p>
            ) : null}

            {assistFeedback ? (
              <p
                className={`front-office-calendar-feedback ${
                  assistFeedback.tone === "success"
                    ? "is-success"
                    : assistFeedback.tone === "error"
                      ? "is-error"
                      : "is-neutral"
                }`}
              >
                {assistFeedback.message}
              </p>
            ) : null}

            {!assistResult && !assistImage && !assistTranscript.trim() ? (
              <EmptyState
                description="Best results usually come from one tighter chat screenshot crop or 3-8 transcript lines that include a name plus one contact, area, budget, or next-step clue. Review stays field-by-field, the live form stays under manual control, and assist never auto-creates the lead."
                title="Start with one screenshot or a short chat excerpt"
              />
            ) : null}

            {assistResult ? (
              <div className="front-office-lead-intake-assist-result">
                <div className="front-office-lead-intake-assist-head">
                  <strong>{assistResult.summaryLabel}</strong>
                  <p>
                    Acre keeps the raw extract as a preview and waits for you to
                    review before applying anything. Unresolved sections stay at
                    the top, manual-confirmation sections come next, and safe
                    suggestions are still available once you have checked the
                    source.
                  </p>
                  <div className="front-office-record-meta">
                    <span>
                      Recognized:{" "}
                      {summarizeLabelList(
                        assistResult.recognizedFieldLabels,
                        "none yet",
                      )}
                    </span>
                    <span>
                      Manual confirmation:{" "}
                      {summarizeLabelList(
                        assistResult.manualConfirmationFieldLabels,
                        "none",
                      )}
                    </span>
                    <span>
                      Not extracted:{" "}
                      {summarizeLabelList(
                        assistResult.ignoredFieldLabels,
                        "none",
                      )}
                    </span>
                  </div>
                  <p className="front-office-calendar-feedback is-neutral">
                    <strong>Ignored fields stay out of the live form.</strong>{" "}
                    {assistResult.ignoredFieldReasonLabel} They only move back
                    in when the extract gives them clearer evidence.
                  </p>
                  <div className="front-office-record-meta">
                    <span>
                      {assistResult.safeApplyFieldCount} safe after review
                    </span>
                    <span>{assistResult.reviewFieldCount} review-first</span>
                    <span>
                      {assistResult.previewOnlyFieldCount} preview-only
                    </span>
                    <span>
                      {pendingReviewableAssistCount} still waiting on review
                    </span>
                    <span>{reviewedReviewableAssistCount} reviewed</span>
                    <span>{unresolvedAssistSectionCount} unresolved sections</span>
                    <span>
                      {manualConfirmationAssistSectionCount} manual-confirmation
                      sections
                    </span>
                    <span>
                      Live form values stay in control until replace is
                      confirmed
                    </span>
                    {manualAssistOverrideCount > 0 ? (
                      <span>
                        {manualAssistOverrideCount} manual override(s)
                      </span>
                    ) : null}
                    {assistReviewOrderLabels.length ? (
                      <span>
                        Review order: {assistReviewOrderLabels.join(" · ")}
                      </span>
                    ) : null}
                    {assistReviewFocusLabels.length ? (
                      <span>
                        Focus now: {assistReviewFocusLabels.join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="office-queue-list">
                  {assistReviewSections.map((section) => (
                    <article
                      className="office-queue-item"
                      key={`assist-section-${section.key}`}
                    >
                      <div className="office-queue-item-top">
                        <strong>{section.label}</strong>
                        <StatusBadge
                          tone={
                            section.pendingCount > 0 ? "warning" : "accent"
                          }
                        >
                          {section.reviewableCount} reviewable
                        </StatusBadge>
                      </div>
                      <p>{section.description}</p>
                      <div className="front-office-record-meta">
                        <span>{section.batchCue}</span>
                        <span>{section.fieldSummary}</span>
                        <span>{section.safeApplyCount} safe</span>
                        <span>{section.reviewFirstCount} review-first</span>
                        <span>{section.previewOnlyCount} preview-only</span>
                        <span>{section.pendingCount} still pending</span>
                        <span>{section.reviewedCount} reviewed</span>
                        {section.pendingCount > 0 ? (
                          <span>Unresolved comes first</span>
                        ) : section.reviewFirstCount > 0 &&
                          section.reviewedCount < section.reviewFirstCount ? (
                          <span>Manual confirmation next</span>
                        ) : (
                          <span>Safe apply later</span>
                        )}
                      </div>
                      <p>{section.actionHint}</p>
                      <div className="front-office-merge-actions">
                        <Button
                          disabled={isBusy || section.reviewableCount === 0}
                          onClick={() => {
                            handleReviewAssistSection(section.fieldKeys);
                          }}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Review {section.label.toLowerCase()} batch
                        </Button>
                        <Button
                          disabled={isBusy || section.reviewedCount === 0}
                          onClick={() => {
                            handleApplyReviewedAssistSection(section.fieldKeys);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Apply reviewed {section.label.toLowerCase()} batch
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>

                <p
                  className={`front-office-calendar-feedback ${
                    assistResult.safetySummary.tone === "warning"
                      ? "is-neutral"
                      : "is-success"
                  }`}
                >
                  <strong>{assistResult.safetySummary.label}</strong>{" "}
                  {assistResult.safetySummary.detail}
                </p>

                <p
                  className={`front-office-calendar-feedback ${
                    assistResult.readinessSummary.tone === "warning"
                      ? "is-neutral"
                      : "is-success"
                  }`}
                >
                  <strong>{assistResult.readinessSummary.label}</strong>{" "}
                  {assistResult.readinessSummary.detail}
                </p>

                {assistResult.readinessSummary.nextStepLabels.length ? (
                  <div className="front-office-record-meta">
                    {assistResult.readinessSummary.nextStepLabels.map(
                      (label) => (
                        <span key={label}>{label}</span>
                      ),
                    )}
                  </div>
                ) : null}

                {assistResult.safetySummary.cautionLabels.length ? (
                  <div className="front-office-record-meta">
                    {assistResult.safetySummary.cautionLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                ) : null}

                {duplicateGateSignals.length ? (
                  <div className="front-office-record-meta">
                    {duplicateGateSignals.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                ) : null}

                {pendingDuplicateIdentityAssistCount > 0 ? (
                  <p className="front-office-calendar-feedback is-neutral">
                    {pendingDuplicateIdentityAssistCount} identity suggestion(s)
                    are still pending review, so duplicate preview and save-time
                    duplicate checks ignore them until you move them into the
                    live form.
                  </p>
                ) : null}

                {manualAssistOverrideCount > 0 ? (
                  <p className="front-office-calendar-feedback is-neutral">
                    {manualAssistOverrideCount} reviewed suggestion(s) are
                    currently overridden by your live form edits. Saving still
                    uses the live form values only.
                  </p>
                ) : null}

                {assistResult.fields.some(
                  (field) => field.suggestedAction !== "preview_only",
                ) ? (
                  <div className="front-office-lead-intake-actions front-office-lead-intake-assist-actions">
                    <Button
                      disabled={isBusy}
                      onClick={handleReviewUnresolvedAssistSections}
                      type="button"
                      variant="secondary"
                    >
                      Review unresolved sections first
                    </Button>
                    <Button
                      disabled={isBusy || reviewedReviewableAssistCount === 0}
                      onClick={handleApplyReviewedAssistFields}
                      type="button"
                      variant="secondary"
                    >
                      Apply reviewed unresolved fields
                    </Button>
                  </div>
                ) : null}

                {pendingReviewableAssistCount > 0 ? (
                  <p className="front-office-calendar-feedback is-neutral">
                    {pendingReviewableAssistCount} reviewable suggestion(s) are
                    still pending. Acre keeps unresolved and manual-confirmation
                    fields at the top, and create still uses only the live form
                    values.
                  </p>
                ) : null}

                <div className="front-office-lead-intake-assist-field-list">
                  {assistResult.fields.length ? (
                    assistResult.fields.map((field) => {
                      const currentValue =
                        formState[field.field as keyof LeadFormState].trim();
                      const isReviewed = assistReviewedFieldKeys.includes(
                        getAssistFieldReviewKey(field),
                      );
                      const matchesSuggestion =
                        normalizeCompactValue(currentValue) ===
                        normalizeCompactValue(field.value);

                      return (
                        <article
                          className="front-office-lead-intake-assist-field"
                          key={`${field.field}-${field.value}`}
                        >
                          <div className="office-queue-item-top">
                            <strong>{field.label}</strong>
                            <div className="front-office-record-meta">
                              <StatusBadge
                                tone={getAssistFieldConfidenceTone(field)}
                              >
                                {field.confidenceLabel}
                              </StatusBadge>
                              <StatusBadge
                                tone={getAssistFieldBadgeTone(field)}
                              >
                                {getAssistFieldBadge(field)}
                              </StatusBadge>
                              <StatusBadge
                                tone={getAssistFieldProvenanceTone(field)}
                              >
                                {field.provenanceLabel}
                              </StatusBadge>
                            </div>
                          </div>
                          <p>{field.value}</p>
                          <div className="front-office-record-meta">
                            <span>{field.reasonLabel}</span>
                            <span>{field.suggestedActionLabel}</span>
                            <span>{field.reviewHintLabel}</span>
                            <span>
                              {getAssistFieldStatus({
                                field,
                                formState,
                                defaultFormState: formDefaults,
                                appliedFields: assistAppliedFields,
                                manuallyEditedFields,
                                replaceConfirmationFieldKey:
                                  assistReplaceConfirmationFieldKey,
                                reviewedFieldKeys: assistReviewedFieldKeys,
                              })}
                            </span>
                            <span>
                              {getAssistFieldLiveValueLabel({
                                field,
                                formState,
                                defaultFormState: formDefaults,
                                manuallyEditedFields,
                              })}
                            </span>
                          </div>
                          <div className="front-office-record-meta">
                            <span>{field.sourceDetailLabel}</span>
                            <span>Evidence: {field.evidenceLabel}</span>
                            {field.cautionLabels.map((label) => (
                              <span key={`${field.field}-${label}`}>
                                {label}
                              </span>
                            ))}
                          </div>
                          <label className="front-office-record-meta">
                            <input
                              checked={isReviewed}
                              disabled={isBusy}
                              onChange={() => {
                                toggleAssistFieldReviewed(field);
                              }}
                              type="checkbox"
                            />
                            <span>
                              {field.suggestedAction === "preview_only"
                                ? "I reviewed this preview"
                                : "I reviewed this field"}
                            </span>
                          </label>
                          {!matchesSuggestion &&
                          field.suggestedAction !== "preview_only" ? (
                            <div className="front-office-merge-actions">
                              <Button
                                disabled={isBusy || !isReviewed}
                                onClick={() => {
                                  handleApplyAssistField(field);
                                }}
                                size="sm"
                                type="button"
                                variant={
                                  field.suggestedAction === "safe_apply"
                                    ? "secondary"
                                    : "ghost"
                                }
                              >
                                {liveFieldNeedsReplaceConfirmation({
                                  fieldKey: field.field as LeadFormFieldKey,
                                  currentValue,
                                  defaultFormState: formDefaults,
                                  manuallyEditedFields,
                                })
                                  ? assistReplaceConfirmationFieldKey ===
                                    getAssistFieldReviewKey(field)
                                    ? "Confirm replace live value"
                                    : "Replace current value"
                                  : currentValue
                                    ? "Apply reviewed suggestion"
                                    : "Apply reviewed field"}
                              </Button>
                            </div>
                          ) : null}
                          {!matchesSuggestion &&
                          field.suggestedAction !== "preview_only" &&
                          liveFieldNeedsReplaceConfirmation({
                            fieldKey: field.field as LeadFormFieldKey,
                            currentValue,
                            defaultFormState: formDefaults,
                            manuallyEditedFields,
                          }) ? (
                            <p>
                              {assistReplaceConfirmationFieldKey ===
                              getAssistFieldReviewKey(field)
                                ? "A second click is now required before Acre replaces the current live form value."
                                : "This suggestion is reviewed, but the live form still keeps the current value until you explicitly confirm a replace."}
                            </p>
                          ) : null}
                          {!matchesSuggestion &&
                          field.suggestedAction === "preview_only" ? (
                            <p>
                              Preview-only text stays manual. Rewrite it in your
                              own words or paste the useful part into the notes
                              field yourself.
                            </p>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState
                      className="front-office-lead-intake-assist-field is-empty"
                      description={assistResult.readinessSummary.detail}
                      title={assistResult.readinessSummary.label}
                    />
                  )}
                </div>

                <p className="front-office-lead-intake-assist-preview">
                  {assistResult.rawText.length > 280
                    ? `${assistResult.rawText.slice(0, 280)}...`
                    : assistResult.rawText}
                </p>
              </div>
            ) : null}
          </div>

          {shouldShowDuplicatePreviewSurface ? (
            <div className="front-office-duplicate-surface">
              <div className="front-office-duplicate-head">
                <strong>Early duplicate warning</strong>
                <p>
                  Acre checks visible-scope collisions from{" "}
                  {duplicatePreviewSourceSummary} before you submit. Open the
                  closest existing record first, compare contact info and
                  stage, and only create a separate dossier if this is truly a
                  different lead.
                </p>
              </div>

              <div className="front-office-record-meta">
                <span>Open the existing record first</span>
                <span>Compare contact info, stage, and next touch</span>
                <span>Use duplicate review if this is the same lead</span>
                <span>Save-time gate still checks live name, phone, and email</span>
              </div>

              {duplicatePreviewMatches.length ? (
                <div className="office-queue-list">
                  {duplicatePreviewMatches.map((match) => (
                    <article
                      className="office-queue-item"
                      key={`preview-${match.id}`}
                    >
                      <div className="office-queue-item-top">
                        <strong>{match.fullName}</strong>
                        <StatusBadge
                          tone={match.matchStrength >= 4 ? "warning" : "accent"}
                        >
                          {match.confidenceLabel}
                        </StatusBadge>
                      </div>
                      <p>
                        {match.stage} · {match.sourceLabel}
                      </p>
                      <div className="front-office-record-meta">
                        <span>{match.matchReasons.join(" · ")}</span>
                        <span>{match.nextTouchLabel}</span>
                        <span>Visible Front Office scope</span>
                      </div>
                      <p>{match.recommendedActionLabel}</p>
                      <div className="front-office-record-meta">
                        {buildDuplicateNextStepLabels(match.matchReasons).map(
                          (label) => (
                            <span key={`${match.id}-${label}`}>{label}</span>
                          ),
                        )}
                      </div>
                      <div className="front-office-merge-actions">
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={match.href}
                        >
                          Review visible record
                        </FrontOfficeLink>
                        <FrontOfficeLink
                          className="office-inline-link front-office-inline-link"
                          href={duplicateReviewHref}
                        >
                          {duplicateReviewLabel}
                        </FrontOfficeLink>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description={
                    pendingDuplicateIdentityAssistCount > 0
                      ? "Identity suggestions are still pending review, so Acre is intentionally holding back duplicate preview until those values enter the live form. Review the name, phone, or email first, then compare the closest visible record."
                      : "No visible collision is showing yet. That does not bypass the final duplicate gate: save-time checks still verify the live name, phone, and email before create. Compare the closest visible record first if this lead already exists."
                  }
                  title={
                    pendingDuplicateIdentityAssistCount > 0
                      ? "Duplicate preview is waiting on reviewed identity fields"
                      : "No visible duplicate warning yet"
                  }
                />
              )}
            </div>
          ) : null}

          {duplicatePreviewHydrationState === "loading" &&
          deferredDuplicatePreviewNeedles.length ? (
            <p className="front-office-calendar-feedback is-neutral">
              Loading visible clients for an early duplicate preview...
            </p>
          ) : null}

          {duplicatePreviewHydrationState === "error" &&
          deferredDuplicatePreviewNeedles.length ? (
            <p className="front-office-calendar-feedback is-neutral">
              {duplicatePreviewHydrationError ??
                "Could not load the visible duplicate preview right now."}
            </p>
          ) : null}

          <p className="front-office-calendar-feedback is-neutral">
            Create uses the live form only. OCR / transcript assist remains
            review-then-apply, and nothing auto-creates or auto-sends.
          </p>

          <div className="office-form-grid front-office-lead-intake-grid">
            <FormField
              className="office-form-grid-span-2"
              helper={
                fieldErrors.fullName ??
                "Required. Use the best name you have right now."
              }
              label="Full name"
            >
              <TextInput
                aria-invalid={Boolean(fieldErrors.fullName)}
                name="fullName"
                onChange={handleFieldChange}
                placeholder="Jamie Chen"
                required
                value={formState.fullName}
              />
            </FormField>

            <FormField
              helper={fieldErrors.phone}
              label="Phone"
            >
              <TextInput
                aria-invalid={Boolean(fieldErrors.phone)}
                inputMode="tel"
                name="phone"
                onChange={handleFieldChange}
                placeholder="(917) 555-0182"
                value={formState.phone}
              />
            </FormField>

            <FormField
              helper={fieldErrors.email}
              label="Email"
            >
              <TextInput
                aria-invalid={Boolean(fieldErrors.email)}
                name="email"
                onChange={handleFieldChange}
                placeholder="jamie@example.com"
                type="email"
                value={formState.email}
              />
            </FormField>

            <FormField helper={fieldErrors.stage} label="Stage">
              <SelectInput
                aria-invalid={Boolean(fieldErrors.stage)}
                name="stage"
                onChange={handleFieldChange}
                value={formState.stage}
              >
                {stageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField helper={fieldErrors.intent} label="Intent">
              <SelectInput
                aria-invalid={Boolean(fieldErrors.intent)}
                name="intent"
                onChange={handleFieldChange}
                value={formState.intent}
              >
                {intentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField helper={fieldErrors.source} label="Source">
              <TextInput
                aria-invalid={Boolean(fieldErrors.source)}
                name="source"
                onChange={handleFieldChange}
                placeholder="Referral / WeChat / Open house"
                value={formState.source}
              />
            </FormField>

            <FormField helper={fieldErrors.budgetMax} label="Budget up to">
              <TextInput
                aria-invalid={Boolean(fieldErrors.budgetMax)}
                inputMode="decimal"
                name="budgetMax"
                onChange={handleFieldChange}
                placeholder="5500 or 5.5k"
                value={formState.budgetMax}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-2"
              helper={
                fieldErrors.preferredAreas ??
                "Comma-separated is enough for fast capture."
              }
              label="Preferred areas"
            >
              <TextInput
                aria-invalid={Boolean(fieldErrors.preferredAreas)}
                name="preferredAreas"
                onChange={handleFieldChange}
                placeholder="LIC, Astoria, Greenpoint"
                value={formState.preferredAreas}
              />
            </FormField>

            <FormField
              helper={
                fieldErrors.nextFollowUpAt ??
                "Default is tomorrow so the next-touch queue stays active."
              }
              label="Next follow-up"
            >
              <TextInput
                aria-invalid={Boolean(fieldErrors.nextFollowUpAt)}
                name="nextFollowUpAt"
                onChange={handleFieldChange}
                type="date"
                value={formState.nextFollowUpAt}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-3"
              helper={
                fieldErrors.notes ??
                "Optional. Capture one concrete detail from the first conversation."
              }
              label="Notes"
            >
              <TextareaInput
                aria-invalid={Boolean(fieldErrors.notes)}
                name="notes"
                onChange={handleFieldChange}
                placeholder="Budget is flexible for the right building. Wants Saturday showings only."
                rows={3}
                value={formState.notes}
              />
            </FormField>
          </div>

          <div className="front-office-lead-intake-actions">
            <Button disabled={isBusy} type="submit">
              {isBusy ? "Saving lead..." : "Capture lead"}
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => {
                resetLiveForm();
                setFeedback(null);
                setDuplicateMatches([]);
                setCreatedClient(null);
                resetAssistComposer();
              }}
              type="button"
              variant="secondary"
            >
              Reset
            </Button>
          </div>
        </form>

        {feedback ? (
          <p
            className={`front-office-calendar-feedback ${
              feedback.tone === "success" ? "is-success" : "is-error"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}

        {createdClient ? (
          <div className="front-office-lead-created">
            <strong>{createdClient.fullName}</strong>
            <p>The new lead is now in the shared Front Office queue.</p>
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={`/agent/clients/${createdClient.id}`}
            >
              Open client workspace
            </FrontOfficeLink>
          </div>
        ) : null}

        {duplicateMatches.length ? (
          <div className="front-office-duplicate-surface">
            <div className="front-office-duplicate-head">
              <strong>Potential duplicate leads</strong>
              <p>
                Acre found existing records in the CRM scope you can currently
                see. Open the closest match first, compare contact info,
                stage, and next touch, then jump into the duplicate review lane
                if this is the same lead. Nothing has been merged or created
                yet.
              </p>
            </div>

            <div className="front-office-record-meta">
              <span>Open the closest match first</span>
              <span>Compare contact info, stage, and next touch</span>
              <span>Use duplicate review if it is the same lead</span>
              <span>Create separately only if the person is distinct</span>
            </div>

            <div className="office-queue-list">
              {duplicateMatches.map((match) => (
                <article className="office-queue-item" key={match.id}>
                  <div className="office-queue-item-top">
                    <strong>{match.fullName}</strong>
                    <StatusBadge
                      tone={match.matchStrength >= 2 ? "warning" : "accent"}
                    >
                      {match.confidenceLabel}
                    </StatusBadge>
                  </div>
                  <p>
                    {match.stage} · {match.sourceLabel} · {match.detailLabel}
                  </p>
                  <div className="front-office-record-meta">
                    <span>{match.matchReasons.join(" · ")}</span>
                    <span>{match.nextTouchLabel}</span>
                    <span>{match.ownerLabel}</span>
                    <span>{match.scopeLabel}</span>
                  </div>
                  <div className="front-office-record-meta">
                    {buildDuplicateNextStepLabels(match.matchReasons).map(
                      (label) => (
                        <span key={`${match.id}-${label}`}>{label}</span>
                      ),
                    )}
                  </div>
                  <div className="front-office-merge-actions">
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={match.href}
                    >
                      {match.reviewLabel}
                    </FrontOfficeLink>
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={duplicateReviewHref}
                    >
                      {duplicateReviewLabel}
                    </FrontOfficeLink>
                  </div>
                  <p>{match.recommendedActionLabel}</p>
                </article>
              ))}
            </div>

            <div className="front-office-lead-intake-actions">
              <Button
                disabled={isBusy}
                onClick={handleCreateAnyway}
                type="button"
                variant="secondary"
              >
                Create separate dossier anyway
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => {
                  setDuplicateMatches([]);
                  setFeedback(null);
                }}
                type="button"
                variant="ghost"
              >
                Clear warning
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
