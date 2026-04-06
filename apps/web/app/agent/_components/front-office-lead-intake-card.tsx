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

type DuplicatePreviewHydrationState = "idle" | "loading" | "ready" | "error";

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

function getAssistFieldStatus(input: {
  field: FrontOfficeLeadIntakeAssistField;
  formState: LeadFormState;
  appliedFields: Array<keyof LeadFormState>;
  reviewedFieldKeys: string[];
}) {
  const fieldKey = input.field.field as keyof LeadFormState;
  const currentValue = input.formState[fieldKey].trim();
  const suggestedValue = input.field.value.trim();
  const defaultValue = buildEmptyFormState()[fieldKey].trim();
  const isReviewed = input.reviewedFieldKeys.includes(
    getAssistFieldReviewKey(input.field),
  );
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

  if (isReviewed) {
    return !currentValue || currentValue === defaultValue
      ? "Reviewed and ready to apply"
      : "Reviewed, but current typed value still wins";
  }

  if (!currentValue || currentValue === defaultValue) {
    return "Review pending before apply";
  }

  return "Current form keeps your typed value until review";
}

function mergeLeadFormStateWithReviewedAssistFields(
  current: LeadFormState,
  fields: FrontOfficeLeadIntakeAssistField[],
  reviewedFieldKeys: string[],
) {
  const defaults = buildEmptyFormState();
  const nextState = {
    ...current,
  };
  const appliedFields: Array<keyof LeadFormState> = [];
  const skippedFieldLabels: string[] = [];

  for (const assistField of fields) {
    if (
      assistField.suggestedAction === "preview_only" ||
      !reviewedFieldKeys.includes(getAssistFieldReviewKey(assistField))
    ) {
      continue;
    }

    const field = assistField.field as keyof LeadFormState;
    const suggestedValue = assistField.value.trim();

    if (!suggestedValue) {
      continue;
    }

    const currentValue = current[field].trim();
    const defaultValue = defaults[field].trim();

    if (!currentValue || currentValue === defaultValue) {
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
  ) {
    const normalized = normalizeCompactValue(fullName);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    needles.push({
      fullName: fullName.trim(),
      sourceLabel,
      preferredAreas,
      source,
    });
  }

  if (input.formState.fullName.trim()) {
    appendNeedle(
      input.formState.fullName,
      "the current form",
      input.formState.preferredAreas,
      input.formState.source,
    );
  }

  const assistNameField = input.assistResult?.fields.find(
    (field) =>
      field.field === "fullName" && field.suggestedAction !== "preview_only",
  );

  if (assistNameField?.value.trim()) {
    const assistSourceLabel = input.reviewedFieldKeys.includes(
      getAssistFieldReviewKey(assistNameField),
    )
      ? "the reviewed assist suggestion"
      : "the assist suggestion";

    appendNeedle(
      assistNameField.value,
      assistSourceLabel,
      input.assistResult?.draft.preferredAreas,
      input.assistResult?.draft.source,
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
    props.sourceSurface === "clients"
      ? "#duplicate-review"
      : "/agent/clients#duplicate-review";
  const duplicateReviewLabel =
    props.sourceSurface === "clients"
      ? "Open duplicate review lane"
      : "Open duplicate review queue";
  const [formState, setFormState] =
    useState<LeadFormState>(buildEmptyFormState);
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
    Array<keyof LeadFormState>
  >([]);
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

  function clearAssistOutput() {
    assistRunIdRef.current += 1;
    setAssistResult(null);
    setAssistReviewedFieldKeys([]);
    setAssistAppliedFields([]);
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
    const fieldKey = name as keyof LeadFormState;

    setFormState((current) => ({
      ...current,
      [fieldKey]: value,
    }));

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
  }

  function toggleAssistFieldReviewed(field: FrontOfficeLeadIntakeAssistField) {
    const reviewKey = getAssistFieldReviewKey(field);

    setAssistReviewedFieldKeys((current) =>
      current.includes(reviewKey)
        ? current.filter((entry) => entry !== reviewKey)
        : [...current, reviewKey],
    );
  }

  function handleReviewSafeAssistFields() {
    if (!assistResult) {
      return;
    }

    const safeFieldKeys = assistResult.fields
      .filter((field) => field.suggestedAction === "safe_apply")
      .map((field) => getAssistFieldReviewKey(field));

    if (!safeFieldKeys.length) {
      setAssistFeedback({
        tone: "neutral",
        message:
          "There are no safe-after-review fields in this extract yet. Review-first suggestions stay individual.",
      });
      return;
    }

    setAssistReviewedFieldKeys((current) => [
      ...new Set([...current, ...safeFieldKeys]),
    ]);
    setAssistFeedback({
      tone: "success",
      message: `${safeFieldKeys.length} safe suggestion(s) were marked reviewed. Apply them individually or use the reviewed-blank-fields action next.`,
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

    const targetField = field.field as keyof LeadFormState;

    setFormState((current) => ({
      ...current,
      [targetField]: field.value,
    }));
    setAssistAppliedFields((current) =>
      current.includes(targetField) ? current : [...current, targetField],
    );
    setAssistFeedback({
      tone: "success",
      message: `${field.label} was copied into the intake form from a reviewed assist suggestion.`,
    });
  }

  function handleApplyReviewedAssistFields() {
    if (!assistResult) {
      return;
    }

    const mergeOutcome = mergeLeadFormStateWithReviewedAssistFields(
      formState,
      assistResult.fields,
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
    setAssistAppliedFields((current) => [
      ...new Set([...current, ...mergeOutcome.appliedFields]),
    ]);
    setAssistFeedback({
      tone: "success",
      message: `${mergeOutcome.appliedFields.length} reviewed suggestion(s) were copied into blank or default form fields.${mergeOutcome.skippedFieldLabels.length ? ` ${mergeOutcome.skippedFieldLabels.join(", ")} stayed untouched because the live form already has a value.` : ""}`,
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
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      duplicateMatches?: DuplicateMatch[];
      contact?: {
        id: string;
        fullName: string;
      };
    } | null;

    if (response.status === 409 && payload?.duplicateMatches?.length) {
      setDuplicateMatches(payload.duplicateMatches);
      setFeedback({
        tone: "error",
        message:
          payload.error ??
          "Potential duplicate clients were found inside your visible CRM scope. Review the closest existing record first, or create anyway if this is truly a new lead.",
      });
      return false;
    }

    if (!response.ok || !payload?.contact) {
      setFeedback({
        tone: "error",
        message: payload?.error ?? "Could not create the Front Office lead.",
      });
      return false;
    }

    setDuplicateMatches([]);
    setCreatedClient({
      id: payload.contact.id,
      fullName: payload.contact.fullName,
    });
    setFeedback({
      tone: "success",
      message:
        "Lead captured. Front Office will refresh now so the queue and stage counts stay current.",
    });
    setFormState(buildEmptyFormState());
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
  const pendingReviewableAssistCount = useMemo(
    () =>
      assistResult?.fields.filter((field) => {
        if (field.suggestedAction === "preview_only") {
          return false;
        }

        const reviewKey = getAssistFieldReviewKey(field);
        const fieldKey = field.field as keyof LeadFormState;
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

            {assistResult ? (
              <div className="front-office-lead-intake-assist-result">
                <div className="front-office-lead-intake-assist-head">
                  <strong>{assistResult.summaryLabel}</strong>
                  <p>
                    Acre keeps the raw extract as a preview and waits for you to
                    apply suggestions. Identity-sensitive fields stay more
                    conservative when household or multi-person context appears.
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
                    <span>Manual entry always wins</span>
                  </div>
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

                {assistResult.fields.some(
                  (field) => field.suggestedAction !== "preview_only",
                ) ? (
                  <div className="front-office-lead-intake-actions front-office-lead-intake-assist-actions">
                    <Button
                      disabled={isBusy}
                      onClick={handleReviewSafeAssistFields}
                      type="button"
                      variant="secondary"
                    >
                      Review safe suggestions
                    </Button>
                    <Button
                      disabled={isBusy || reviewedReviewableAssistCount === 0}
                      onClick={handleApplyReviewedAssistFields}
                      type="button"
                      variant="secondary"
                    >
                      Apply reviewed blank fields
                    </Button>
                  </div>
                ) : null}

                {pendingReviewableAssistCount > 0 ? (
                  <p className="front-office-calendar-feedback is-neutral">
                    {pendingReviewableAssistCount} reviewable suggestion(s) are
                    still pending. Create uses only the live form values.
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
                            </div>
                          </div>
                          <p>{field.value}</p>
                          <div className="front-office-record-meta">
                            <span>{field.reasonLabel}</span>
                            <span>{field.provenanceLabel}</span>
                            <span>{field.suggestedActionLabel}</span>
                            <span>
                              {getAssistFieldStatus({
                                field,
                                formState,
                                appliedFields: assistAppliedFields,
                                reviewedFieldKeys: assistReviewedFieldKeys,
                              })}
                            </span>
                          </div>
                          <div className="front-office-record-meta">
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
                                {currentValue
                                  ? "Apply reviewed suggestion"
                                  : "Apply reviewed field"}
                              </Button>
                            </div>
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
                    <article className="front-office-lead-intake-assist-field is-empty">
                      <span>Detected fields</span>
                      <strong>Nothing structured yet</strong>
                    </article>
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

          {duplicatePreviewMatches.length ? (
            <div className="front-office-duplicate-surface">
              <div className="front-office-duplicate-head">
                <strong>Early duplicate preview</strong>
                <p>
                  Acre sees visible-scope collisions from your current form or
                  reviewed assist suggestions now, then the formal create-time
                  duplicate gate still runs on save. Suggested phone or email
                  values stay out of that formal gate until you review them into
                  the live form.
                </p>
              </div>

              <div className="office-queue-list">
                {duplicatePreviewMatches.map((match) => (
                  <article
                    className="office-queue-item"
                    key={`preview-${match.id}`}
                  >
                    <div className="office-queue-item-top">
                      <strong>{match.fullName}</strong>
                      <StatusBadge
                        tone={match.matchStrength >= 3 ? "warning" : "accent"}
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

          <div className="office-form-grid front-office-lead-intake-grid">
            <FormField
              className="office-form-grid-span-2"
              helper="Required. Use the best name you have right now."
              label="Full name"
            >
              <TextInput
                name="fullName"
                onChange={handleFieldChange}
                placeholder="Jamie Chen"
                required
                value={formState.fullName}
              />
            </FormField>

            <FormField label="Phone">
              <TextInput
                name="phone"
                onChange={handleFieldChange}
                placeholder="(917) 555-0182"
                value={formState.phone}
              />
            </FormField>

            <FormField label="Email">
              <TextInput
                name="email"
                onChange={handleFieldChange}
                placeholder="jamie@example.com"
                type="email"
                value={formState.email}
              />
            </FormField>

            <FormField label="Stage">
              <SelectInput
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

            <FormField label="Intent">
              <SelectInput
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

            <FormField label="Source">
              <TextInput
                name="source"
                onChange={handleFieldChange}
                placeholder="Referral / WeChat / Open house"
                value={formState.source}
              />
            </FormField>

            <FormField label="Budget up to">
              <TextInput
                name="budgetMax"
                onChange={handleFieldChange}
                placeholder="5500"
                value={formState.budgetMax}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-2"
              helper="Comma-separated is enough for fast capture."
              label="Preferred areas"
            >
              <TextInput
                name="preferredAreas"
                onChange={handleFieldChange}
                placeholder="LIC, Astoria, Greenpoint"
                value={formState.preferredAreas}
              />
            </FormField>

            <FormField
              helper="Default is tomorrow so the next-touch queue stays active."
              label="Next follow-up"
            >
              <TextInput
                name="nextFollowUpAt"
                onChange={handleFieldChange}
                type="date"
                value={formState.nextFollowUpAt}
              />
            </FormField>

            <FormField
              className="office-form-grid-span-3"
              helper="Optional. Capture one concrete detail from the first conversation."
              label="Notes"
            >
              <TextareaInput
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
                setFormState(buildEmptyFormState());
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
                see. Start with the closest match below, then jump into the
                duplicate review lane if this should merge instead of creating a
                second dossier.
              </p>
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
                Create anyway
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
