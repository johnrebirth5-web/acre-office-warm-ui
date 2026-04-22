"use client";

import { ClientFollowUpStatus } from "@prisma/client";
import {
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  extractFrontOfficeLeadIntakeAssist,
  type FrontOfficeLeadIntakeAssistField,
  type FrontOfficeLeadIntakeAssistResult,
} from "./front-office-lead-intake-assist";
import {
  buildFrontOfficeLeadDuplicatePreview,
  type FrontOfficeLeadDuplicatePreviewCandidate,
} from "./front-office-lead-intake-review";
import { FrontOfficeLink } from "./front-office-link";
import type { FrontOfficeLeadIntakeAiExtraction } from "../../../lib/front-office-intake-ai";

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
  wechatDisplayName: string;
  budgetMax: string;
  preferredAreas: string;
  followUpStatus: ClientFollowUpStatus;
  notes: string;
};

type LeadFieldKey = keyof LeadFormState;
type LeadFieldErrors = Partial<Record<LeadFieldKey, string>>;

type DuplicateMatch = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  confidenceLabel: string;
  matchStrength: number;
  href: string;
  matchReasons: string[];
  recommendedActionLabel: string;
};

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

type FrontOfficeLeadIntakeAssistServerResponse = {
  rawText: string;
  sourceMode: "text" | "image" | "hybrid";
  aiExtraction?: FrontOfficeLeadIntakeAiExtraction | null;
};

const followUpStatusOptions = [
  {
    value: ClientFollowUpStatus.new_lead,
    label: "New lead",
  },
  {
    value: ClientFollowUpStatus.active_follow_up,
    label: "Active follow-up",
  },
  {
    value: ClientFollowUpStatus.waiting_reply,
    label: "Waiting reply",
  },
  {
    value: ClientFollowUpStatus.appointment_booked,
    label: "Appointment booked",
  },
  {
    value: ClientFollowUpStatus.paused,
    label: "Paused",
  },
] as const;

const supportedAssistFields = new Set([
  "fullName",
  "budgetMax",
  "preferredAreas",
  "notes",
  "stage",
  "intent",
  "source",
  "phone",
  "email",
  "nextFollowUpAt",
]);

function buildEmptyFormState(): LeadFormState {
  return {
    fullName: "",
    wechatDisplayName: "",
    budgetMax: "",
    preferredAreas: "",
    followUpStatus: ClientFollowUpStatus.new_lead,
    notes: "",
  };
}

function normalizeCompactValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function inferFollowUpStatusFromStage(
  value: string | undefined,
): ClientFollowUpStatus {
  const normalized = value?.trim().toLowerCase() || "";

  if (
    normalized.includes("viewing") ||
    normalized.includes("showing") ||
    normalized.includes("tour") ||
    normalized.includes("appointment")
  ) {
    return ClientFollowUpStatus.appointment_booked;
  }

  if (normalized.includes("pending") || normalized.includes("reply")) {
    return ClientFollowUpStatus.waiting_reply;
  }

  if (normalized.includes("won") || normalized.includes("lost")) {
    return ClientFollowUpStatus.paused;
  }

  if (
    normalized.includes("contacted") ||
    normalized.includes("follow-up") ||
    normalized.includes("warm")
  ) {
    return ClientFollowUpStatus.active_follow_up;
  }

  return ClientFollowUpStatus.new_lead;
}

function buildNoteDraft(input: {
  assistResult: FrontOfficeLeadIntakeAssistResult;
  rawText: string;
}) {
  const draft = input.assistResult.draft;
  const labels = [
    draft.source ? `Source: ${draft.source}` : null,
    draft.intent ? `Intent: ${draft.intent}` : null,
    draft.stage ? `Stage signal: ${draft.stage}` : null,
    draft.phone ? `Phone: ${draft.phone}` : null,
    draft.email ? `Email: ${draft.email}` : null,
    draft.nextFollowUpAt
      ? `Suggested next reminder: ${draft.nextFollowUpAt}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const baseNote = draft.notes?.trim() || "";
  const captureSummary = labels.join("\n");

  if (baseNote && captureSummary) {
    return `${baseNote}\n\n${captureSummary}`.trim();
  }

  if (baseNote) {
    return baseNote;
  }

  if (captureSummary) {
    return captureSummary;
  }

  return input.rawText.trim();
}

function getAssistFieldTone(field: FrontOfficeLeadIntakeAssistField) {
  if (field.suggestedAction === "preview_only") {
    return "warning" as const;
  }

  return field.confidence === "high"
    ? ("success" as const)
    : field.confidence === "medium"
      ? ("accent" as const)
      : ("warning" as const);
}

export function FrontOfficeLeadIntakeCard(
  props: FrontOfficeLeadIntakeCardProps,
) {
  const density = props.density ?? "default";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<LeadFormState>(buildEmptyFormState);
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [assistTranscript, setAssistTranscript] = useState("");
  const [assistImage, setAssistImage] = useState<File | null>(null);
  const [assistResult, setAssistResult] =
    useState<FrontOfficeLeadIntakeAssistResult | null>(null);
  const [assistRawText, setAssistRawText] = useState("");
  const [assistServerMeta, setAssistServerMeta] =
    useState<FrontOfficeLeadIntakeAssistServerResponse | null>(null);
  const [assistContactSignals, setAssistContactSignals] = useState({
    email: "",
    phone: "",
    source: "",
  });

  const duplicatePreviewMatches = useMemo(
    () =>
      buildFrontOfficeLeadDuplicatePreview({
        candidates: props.initialDuplicatePreviewCandidates ?? [],
        needles: [
          {
            fullName:
              formState.wechatDisplayName.trim() || formState.fullName.trim(),
            sourceLabel: "Current intake",
            preferredAreas: formState.preferredAreas,
            source: assistContactSignals.source,
            email: assistContactSignals.email,
            phone: assistContactSignals.phone,
          },
        ],
      }),
    [
      assistContactSignals.email,
      assistContactSignals.phone,
      assistContactSignals.source,
      formState.fullName,
      formState.preferredAreas,
      formState.wechatDisplayName,
      props.initialDuplicatePreviewCandidates,
    ],
  );

  function updateField<TKey extends LeadFieldKey>(
    key: TKey,
    value: LeadFormState[TKey],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function resetForm() {
    setFormState(buildEmptyFormState());
    setFieldErrors({});
    setDuplicateMatches([]);
    setFeedback("");
  }

  function resetAssist() {
    setAssistTranscript("");
    setAssistImage(null);
    setAssistResult(null);
    setAssistRawText("");
    setAssistServerMeta(null);
    setAssistContactSignals({
      email: "",
      phone: "",
      source: "",
    });
  }

  async function handleAssistSubmit() {
    if (!assistTranscript.trim() && !assistImage) {
      setFeedback("Add a transcript or one screenshot first.");
      return;
    }

    setFeedback("");

    const formData = new FormData();
    formData.set("transcript", assistTranscript);
    formData.set("sourceSurface", props.sourceSurface);

    if (assistImage) {
      formData.set("image", assistImage);
    }

    startTransition(async () => {
      const response = await fetch("/api/agent/clients/intake-assist", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setFeedback(
          payload?.error ||
            "Could not extract lead details from the current intake source.",
        );
        return;
      }

      const payload =
        (await response.json()) as FrontOfficeLeadIntakeAssistServerResponse;
      const nextAssistResult = extractFrontOfficeLeadIntakeAssist({
        rawText: payload.rawText,
        sourceMode: payload.sourceMode,
        prefilledFields: payload.aiExtraction?.fields,
      });

      setAssistResult(nextAssistResult);
      setAssistRawText(payload.rawText);
      setAssistServerMeta(payload);
      setAssistContactSignals({
        email: nextAssistResult.draft.email?.trim() || "",
        phone: nextAssistResult.draft.phone?.trim() || "",
        source: nextAssistResult.draft.source?.trim() || "",
      });
      setFeedback("AI capture is ready. Review it, then apply the draft.");
    });
  }

  function applyAssistDraft() {
    if (!assistResult) {
      return;
    }

    const nextName = assistResult.draft.fullName?.trim() || "";
    const nextSource = assistResult.draft.source?.trim() || "";
    const nextWechatDisplayName =
      nextSource.toLowerCase().includes("wechat") && nextName ? nextName : "";

    setFormState((current) => ({
      ...current,
      fullName: nextName || current.fullName,
      wechatDisplayName: nextWechatDisplayName || current.wechatDisplayName,
      budgetMax: assistResult.draft.budgetMax?.trim() || current.budgetMax,
      preferredAreas:
        assistResult.draft.preferredAreas?.trim() || current.preferredAreas,
      followUpStatus: inferFollowUpStatusFromStage(assistResult.draft.stage),
      notes: buildNoteDraft({
        assistResult,
        rawText: assistRawText,
      }),
    }));
    setFeedback("AI draft applied. You can edit every field before saving.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setDuplicateMatches([]);

    startTransition(async () => {
      const response = await fetch("/api/agent/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formState.fullName,
          wechatDisplayName: formState.wechatDisplayName,
          budgetMax: formState.budgetMax,
          preferredAreas: formState.preferredAreas,
          followUpStatus: formState.followUpStatus,
          notes: formState.notes,
        }),
      });

      const payload =
        (await response.json().catch(() => null)) as CreateLeadApiPayload | null;

      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors ?? {});
        setDuplicateMatches(payload?.duplicateMatches ?? []);
        setFeedback(payload?.error || "Could not create the client.");
        return;
      }

      resetForm();
      resetAssist();
      router.refresh();
      setFeedback(
        payload?.contact
          ? `Client created: ${payload.contact.fullName}`
          : "Client created.",
      );
    });
  }

  return (
    <SectionCard
      className={`office-list-card ${density === "compact" ? "is-compact" : ""}`}
      subtitle={
        props.subtitle ??
        "Capture the next live lead without opening a heavier backend form."
      }
      title={props.title ?? "Quick intake"}
    >
      <form className="front-office-calendar-form" onSubmit={handleSubmit}>
        <SectionCard
          className="office-list-card"
          subtitle="Paste a short transcript or upload one screenshot. AI will only keep the four structured fields and move everything else into Note."
          title="AI capture"
        >
          <div className="office-form-grid">
            <FormField
              className="office-form-grid-span-2"
              helper={assistImage ? `Selected screenshot: ${assistImage.name}` : undefined}
              label="Screenshot"
            >
              <input
                accept="image/*"
                className="front-office-lead-intake-file-input"
                disabled={isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setAssistImage(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </FormField>

            <FormField
              className="office-form-grid-span-3"
              label="Transcript / chat text"
            >
              <TextareaInput
                disabled={isPending}
                onChange={(event) => {
                  setAssistTranscript(event.target.value);
                }}
                placeholder="Buyer from WeChat. Name Annie Chen. Wants LIC or Astoria. Budget up to 6500..."
                rows={4}
                value={assistTranscript}
              />
            </FormField>
          </div>

          <div className="office-queue-meta">
            <Button
              disabled={isPending || (!assistTranscript.trim() && !assistImage)}
              onClick={() => {
                void handleAssistSubmit();
              }}
              type="button"
            >
              {isPending ? "Analyzing..." : "Run AI capture"}
            </Button>
            <Button
              disabled={isPending}
              onClick={resetAssist}
              type="button"
              variant="secondary"
            >
              Clear source
            </Button>
          </div>

          {assistResult ? (
            <div className="office-queue-list">
              {assistResult.fields
                .filter((field) => supportedAssistFields.has(field.field))
                .slice(0, 6)
                .map((field) => (
                  <QueueAssistField field={field} key={field.field} />
                ))}

              <div className="office-queue-meta">
                <Button
                  disabled={isPending}
                  onClick={applyAssistDraft}
                  type="button"
                  variant="secondary"
                >
                  Apply draft to form
                </Button>
                {assistServerMeta?.rawText ? (
                  <StatusBadge tone="accent">
                    Source mode: {assistServerMeta.sourceMode}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState
              description="AI capture stays optional. You can still type the form directly if that is faster."
              title="No AI draft yet"
            />
          )}
        </SectionCard>

        {(duplicatePreviewMatches.length || duplicateMatches.length) && (
          <SectionCard
            className="office-list-card"
            subtitle="Review these records before saving a second client."
            title="Possible duplicate"
          >
            <div className="office-queue-list">
              {[...duplicateMatches, ...duplicatePreviewMatches]
                .slice(0, 4)
                .map((match) => (
                  <QueueItem
                    badge={
                      <StatusBadge
                        tone={match.matchStrength >= 4 ? "warning" : "accent"}
                      >
                        {match.confidenceLabel}
                      </StatusBadge>
                    }
                    description={`${match.stage} · ${match.sourceLabel}`}
                    key={match.id}
                    meta={
                      <>
                        <span>{match.matchReasons.join(" · ")}</span>
                        <span>{match.nextTouchLabel}</span>
                      </>
                    }
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={match.href}
                      >
                        Review record
                      </FrontOfficeLink>
                    }
                    title={match.fullName}
                  />
                ))}
            </div>
          </SectionCard>
        )}

        <div className="office-form-grid">
          <FormField
            className="office-form-grid-span-2"
            helper={fieldErrors.fullName}
            label="Name"
          >
            <TextInput
              aria-invalid={Boolean(fieldErrors.fullName)}
              onChange={(event) => {
                updateField("fullName", event.target.value);
              }}
              placeholder="Annie Chen"
              required
              value={formState.fullName}
            />
          </FormField>

          <FormField helper={fieldErrors.wechatDisplayName} label="WeChat name">
            <TextInput
              aria-invalid={Boolean(fieldErrors.wechatDisplayName)}
              onChange={(event) => {
                updateField("wechatDisplayName", event.target.value);
              }}
              placeholder="Optional"
              value={formState.wechatDisplayName}
            />
          </FormField>

          <FormField helper={fieldErrors.budgetMax} label="Budget">
            <TextInput
              aria-invalid={Boolean(fieldErrors.budgetMax)}
              onChange={(event) => {
                updateField("budgetMax", event.target.value);
              }}
              placeholder="6500"
              value={formState.budgetMax}
            />
          </FormField>

          <FormField
            className="office-form-grid-span-2"
            helper={fieldErrors.preferredAreas}
            label="Target area"
          >
            <TextInput
              aria-invalid={Boolean(fieldErrors.preferredAreas)}
              onChange={(event) => {
                updateField("preferredAreas", event.target.value);
              }}
              placeholder="LIC, Astoria"
              value={formState.preferredAreas}
            />
          </FormField>

          <FormField helper={fieldErrors.followUpStatus} label="Follow-up status">
            <SelectInput
              aria-invalid={Boolean(fieldErrors.followUpStatus)}
              onChange={(event) => {
                updateField(
                  "followUpStatus",
                  event.target.value as ClientFollowUpStatus,
                );
              }}
              value={formState.followUpStatus}
            >
              {followUpStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField
            className="office-form-grid-span-4"
            helper={fieldErrors.notes}
            label="Note"
          >
            <TextareaInput
              aria-invalid={Boolean(fieldErrors.notes)}
              onChange={(event) => {
                updateField("notes", event.target.value);
              }}
              rows={8}
              value={formState.notes}
            />
          </FormField>
        </div>

        <div className="office-queue-meta">
          <Button disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Create client"}
          </Button>
          <Button
            disabled={isPending}
            onClick={resetForm}
            type="button"
            variant="secondary"
          >
            Reset
          </Button>
        </div>

        {feedback ? <p>{feedback}</p> : null}
      </form>
    </SectionCard>
  );
}

function QueueAssistField(props: {
  field: FrontOfficeLeadIntakeAssistField;
}) {
  return (
    <QueueItem
      badge={
        <StatusBadge tone={getAssistFieldTone(props.field)}>
          {props.field.confidenceLabel}
        </StatusBadge>
      }
      description={props.field.reasonLabel}
      meta={
        <>
          <span>{props.field.value}</span>
          <span>{props.field.evidenceLabel}</span>
        </>
      }
      title={props.field.label}
    />
  );
}
