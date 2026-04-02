"use client";

import {
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button, FormField, SectionCard, SelectInput, TextInput, TextareaInput } from "@acre/ui";
import { useRouter } from "next/navigation";
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
  href: string;
  matchReasons: string[];
};

type CreatedClientState = {
  id: string;
  fullName: string;
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

export function FrontOfficeLeadIntakeCard(
  props: FrontOfficeLeadIntakeCardProps,
) {
  const router = useRouter();
  const density = props.density ?? "default";
  const [formState, setFormState] = useState<LeadFormState>(buildEmptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [createdClient, setCreatedClient] = useState<CreatedClientState | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
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
          "Potential duplicate clients were found. Review them first or create anyway if this is a new lead.",
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
                Acre found existing client records in your queue that already
                match this intake. Review them first if this might be the same
                person.
              </p>
            </div>

            <div className="office-queue-list">
              {duplicateMatches.map((match) => (
                <article className="office-queue-item" key={match.id}>
                  <strong>{match.fullName}</strong>
                  <p>
                    {match.stage} · {match.sourceLabel}
                  </p>
                  <div className="front-office-record-meta">
                    <span>{match.matchReasons.join(" · ")}</span>
                    <span>{match.nextTouchLabel}</span>
                  </div>
                  <FrontOfficeLink
                    className="office-inline-link front-office-inline-link"
                    href={match.href}
                  >
                    Review client
                  </FrontOfficeLink>
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
