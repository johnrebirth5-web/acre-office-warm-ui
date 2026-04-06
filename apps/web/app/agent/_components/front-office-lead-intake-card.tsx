"use client";

import {
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
import { FrontOfficeLink } from "./front-office-link";

type FrontOfficeLeadIntakeCardProps = {
  title?: string;
  subtitle?: string;
  density?: "default" | "compact";
  sourceSurface: "dashboard" | "clients";
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

function mergeLeadFormStateWithAssistFields(
  current: LeadFormState,
  fields: FrontOfficeLeadIntakeAssistField[],
) {
  const defaults = buildEmptyFormState();
  const nextState = {
    ...current,
  };
  const appliedFields: Array<keyof LeadFormState> = [];

  for (const assistField of fields) {
    if (!assistField.autoApply) {
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
    }
  }

  return {
    nextState,
    appliedFields,
  };
}

function getAssistFieldBadge(field: FrontOfficeLeadIntakeAssistField) {
  if (field.confidence === "high") {
    return "High confidence";
  }

  if (field.confidence === "medium") {
    return "Review suggestion";
  }

  return "Preview only";
}

function getAssistFieldStatus(input: {
  field: FrontOfficeLeadIntakeAssistField;
  formState: LeadFormState;
  autoAppliedFields: Array<keyof LeadFormState>;
}) {
  const currentValue = input.formState[input.field.field as keyof LeadFormState].trim();
  const suggestedValue = input.field.value.trim();
  const defaultValue =
    buildEmptyFormState()[input.field.field as keyof LeadFormState].trim();
  const matchesSuggestion = currentValue === suggestedValue;
  const wasAutoApplied =
    matchesSuggestion &&
    input.autoAppliedFields.includes(input.field.field as keyof LeadFormState);

  if (wasAutoApplied) {
    return "Applied into form";
  }

  if (matchesSuggestion) {
    return "Using this suggestion";
  }

  if (!currentValue || currentValue === defaultValue) {
    return input.field.autoApply ? "Ready if needed" : "Review before using";
  }

  return "Kept your typed value";
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
  const [formState, setFormState] = useState<LeadFormState>(buildEmptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [createdClient, setCreatedClient] = useState<CreatedClientState | null>(
    null,
  );
  const [assistTranscript, setAssistTranscript] = useState("");
  const [assistImage, setAssistImage] = useState<File | null>(null);
  const [assistInputResetKey, setAssistInputResetKey] = useState(0);
  const [assistResult, setAssistResult] =
    useState<FrontOfficeLeadIntakeAssistResult | null>(null);
  const [assistAutoAppliedFields, setAssistAutoAppliedFields] = useState<
    Array<keyof LeadFormState>
  >([]);
  const [assistFeedback, setAssistFeedback] =
    useState<AssistFeedbackState>(null);
  const [assistProgressMessage, setAssistProgressMessage] = useState("");
  const [isExtractingAssist, setIsExtractingAssist] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending || isExtractingAssist;

  function clearAssistOutput() {
    setAssistResult(null);
    setAssistAutoAppliedFields([]);
    setAssistFeedback(null);
    setAssistProgressMessage("");
  }

  function resetAssistComposer() {
    clearAssistOutput();
    setAssistTranscript("");
    setAssistImage(null);
    setAssistInputResetKey((current) => current + 1);
  }

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleApplyAssistField(field: FrontOfficeLeadIntakeAssistField) {
    const targetField = field.field as keyof LeadFormState;

    setFormState((current) => ({
      ...current,
      [targetField]: field.value,
    }));
    setAssistAutoAppliedFields((current) =>
      current.includes(targetField) ? current : [...current, targetField],
    );
    setAssistFeedback({
      tone: field.confidence === "high" ? "success" : "neutral",
      message: `${field.label} was placed into the intake form. Keep reviewing before you capture the lead.`,
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

    setAssistResult(null);
    setAssistFeedback(null);
    setAssistProgressMessage(
      assistImage
        ? "Preparing browser-side OCR for the uploaded screenshot..."
        : "Parsing pasted transcript...",
    );
    setIsExtractingAssist(true);
    try {
      let ocrText = "";
      let ocrFailed = false;

      try {
        if (assistImage) {
          const { recognize } = await import("tesseract.js");
          const { data } = await recognize(assistImage, "eng+chi_sim", {
            logger: (message) => {
              const progress =
                typeof message.progress === "number"
                  ? ` ${Math.round(message.progress * 100)}%`
                  : "";
              setAssistProgressMessage(`${message.status}${progress}`);
            },
          });
          ocrText = data.text.trim();
        }
      } catch {
        ocrFailed = true;
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
        sourceMode: assistImage ? "image" : "text",
      });
      const mergeOutcome = mergeLeadFormStateWithAssistFields(
        formState,
        result.fields,
      );
      const feedbackParts: string[] = [];

      if (assistImage && ocrText) {
        feedbackParts.push("Screenshot text extracted.");
      }

      if (transcriptText) {
        feedbackParts.push("Transcript parsed.");
      }

      if (result.fields.length) {
        feedbackParts.push(`${result.fields.length} lead field(s) detected.`);
      } else {
        feedbackParts.push("No structured lead fields were detected yet.");
      }

      if (mergeOutcome.appliedFields.length) {
        feedbackParts.push(
          `${mergeOutcome.appliedFields.length} high-confidence empty/default field(s) were filled into the live intake form.`,
        );
      } else if (result.autoApplyFieldCount > 0) {
        feedbackParts.push(
          "High-confidence suggestions were found, but Acre kept your typed values in place.",
        );
      }

      if (result.reviewFieldCount > 0) {
        feedbackParts.push(
          `${result.reviewFieldCount} suggestion(s) stayed in preview so you can review them manually.`,
        );
      } else if (result.fields.length) {
        feedbackParts.push(
          "Current form values were preserved where you had already typed something more specific.",
        );
      }

      if (ocrFailed && transcriptText) {
        feedbackParts.push(
          "Screenshot OCR could not finish, so Acre used the pasted transcript only.",
        );
      }

      setAssistResult(result);
      setAssistAutoAppliedFields(mergeOutcome.appliedFields);
      setFormState(mergeOutcome.nextState);
      setAssistProgressMessage("");
      setAssistFeedback({
        tone: result.fields.length ? "success" : "neutral",
        message: feedbackParts.join(" "),
      });
    } catch {
      setAssistProgressMessage("");
      setAssistFeedback({
        tone: "error",
        message:
          "Acre could not finish intake extraction right now. Retry with a cleaner screenshot or paste the transcript directly.",
      });
    } finally {
      setIsExtractingAssist(false);
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
            <span>{props.sourceSurface === "dashboard" ? "Dashboard entry" : "Clients workspace entry"}</span>
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
                it in the browser, keeps low-confidence guesses in preview, and
                only fills empty/default intake fields when the signal looks
                strong enough.
              </p>
              <div className="front-office-record-meta">
                <span>Browser-side extraction only</span>
                <span>High-confidence assist only</span>
                <span>No auto-create or auto-send</span>
                <span>Review before capture</span>
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
                    Acre keeps the raw extract as a preview. Safe suggestions
                    can land in the form, while softer guesses stay here until
                    you choose to use them.
                  </p>
                  <div className="front-office-record-meta">
                    <span>{assistResult.autoApplyFieldCount} ready-to-use</span>
                    <span>{assistResult.reviewFieldCount} review-only</span>
                    <span>Manual entry always wins</span>
                  </div>
                </div>

                <div className="front-office-lead-intake-assist-field-list">
                  {assistResult.fields.length ? (
                    assistResult.fields.map((field) => {
                      const currentValue =
                        formState[field.field as keyof LeadFormState].trim();
                      const matchesSuggestion =
                        currentValue === field.value.trim();
                      const canApplySuggestion =
                        field.confidence !== "low" && !matchesSuggestion;

                      return (
                        <article
                          className="front-office-lead-intake-assist-field"
                          key={`${field.field}-${field.value}`}
                        >
                          <span>
                            {field.label} · {getAssistFieldBadge(field)}
                          </span>
                          <strong>{field.value}</strong>
                          <div className="front-office-record-meta">
                            <span>{field.reasonLabel}</span>
                            <span>
                              {getAssistFieldStatus({
                                field,
                                formState,
                                autoAppliedFields: assistAutoAppliedFields,
                              })}
                            </span>
                          </div>
                          {canApplySuggestion ? (
                            <div className="front-office-merge-actions">
                              <Button
                                onClick={() => {
                                  handleApplyAssistField(field);
                                }}
                                size="sm"
                                type="button"
                                variant={
                                  field.autoApply ? "secondary" : "ghost"
                                }
                              >
                                {currentValue
                                  ? "Use suggestion instead"
                                  : "Use suggestion"}
                              </Button>
                            </div>
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
