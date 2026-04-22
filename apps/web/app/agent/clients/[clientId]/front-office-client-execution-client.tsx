"use client";

import {
  ClientFollowUpReminderMode,
  ClientFollowUpStatus,
} from "@prisma/client";
import type { OfficeContactDetail } from "@acre/db";
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
import { useEffect, useState, useTransition } from "react";
import { FrontOfficeLink } from "../../_components/front-office-link";

type FrontOfficeClientExecutionClientProps = {
  contact: OfficeContactDetail;
  legacyOpenTaskCount: number;
  linkedBackOfficeHref?: string | null;
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

async function patchClient(
  clientId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`/api/agent/clients/${clientId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error || "Could not save the client update.");
  }
}

export function FrontOfficeClientExecutionClient(
  props: FrontOfficeClientExecutionClientProps,
) {
  const { contact } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fullName, setFullName] = useState(contact.fullName);
  const [wechatDisplayName, setWechatDisplayName] = useState(
    contact.wechatDisplayName,
  );
  const [budgetMax, setBudgetMax] = useState(contact.budgetMax);
  const [areas, setAreas] = useState(contact.areas.join(", "));
  const [followUpStatus, setFollowUpStatus] = useState(contact.followUpStatus);
  const [nextReminderValue, setNextReminderValue] = useState(
    contact.nextFollowUpAt,
  );
  const [notes, setNotes] = useState(contact.notes);

  useEffect(() => {
    setFullName(contact.fullName);
    setWechatDisplayName(contact.wechatDisplayName);
    setBudgetMax(contact.budgetMax);
    setAreas(contact.areas.join(", "));
    setFollowUpStatus(contact.followUpStatus);
    setNextReminderValue(contact.nextFollowUpAt);
    setNotes(contact.notes);
  }, [contact]);

  function runUpdate(
    payload: Record<string, unknown>,
    successLabel: string,
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        await patchClient(contact.id, payload);
        setSuccessMessage(successLabel);
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not save changes.",
        );
      }
    });
  }

  return (
    <>
      <SectionCard
        className="office-list-card"
        subtitle="Keep only the core requirement and contact execution data visible."
        title="Client needs & basics"
      >
        <div className="office-form-grid">
          <FormField
            className="office-form-grid-span-2"
            label="Name"
          >
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
              value={fullName}
            />
          </FormField>

          <FormField label="WeChat name">
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setWechatDisplayName(event.target.value);
              }}
              placeholder="Optional"
              value={wechatDisplayName}
            />
          </FormField>

          <FormField label="Budget">
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setBudgetMax(event.target.value);
              }}
              placeholder="6500"
              value={budgetMax}
            />
          </FormField>

          <FormField className="office-form-grid-span-2" label="Target area">
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setAreas(event.target.value);
              }}
              placeholder="LIC, Astoria"
              value={areas}
            />
          </FormField>
        </div>

        <div className="office-queue-meta">
          <StatusBadge tone="accent">
            Display name: {contact.displayName}
          </StatusBadge>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                {
                  fullName,
                  wechatDisplayName,
                  budgetMax,
                  preferredAreas: areas,
                },
                "Client basics saved.",
              );
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Save basics
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Track current status, last touch, and the next reminder without opening a heavier workflow form."
        title="Follow-up control"
      >
        <div className="office-form-grid">
          <FormField label="Follow-up status">
            <SelectInput
              disabled={isPending}
              onChange={(event) => {
                setFollowUpStatus(event.target.value as ClientFollowUpStatus);
              }}
              value={followUpStatus}
            >
              {followUpStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="Reminder mode">
            <TextInput
              disabled
              value={
                contact.followUpReminderMode ===
                ClientFollowUpReminderMode.manual
                  ? "Manual reminder"
                  : "Auto reminder"
              }
            />
          </FormField>

          <FormField label="Last follow-up">
            <TextInput
              disabled
              value={contact.lastContactAt || "Not followed up yet"}
            />
          </FormField>

          <FormField label="Next reminder">
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setNextReminderValue(event.target.value);
              }}
              type="date"
              value={nextReminderValue}
            />
          </FormField>
        </div>

        <div className="office-queue-meta">
          {props.legacyOpenTaskCount > 0 ? (
            <StatusBadge tone="warning">
              Legacy follow-up tasks still exist ({props.legacyOpenTaskCount})
            </StatusBadge>
          ) : null}
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { followUpStatus },
                "Follow-up status saved.",
              );
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Save status
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { nextFollowUpAt: nextReminderValue || null },
                "Next reminder saved in manual mode.",
              );
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Save reminder
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { followUpReminderMode: ClientFollowUpReminderMode.auto },
                "Auto reminder restored.",
              );
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Use auto
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { markFollowedUpNow: true },
                "Last follow-up updated.",
              );
            }}
            size="sm"
            type="button"
          >
            Mark followed up
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Everything else from AI or manual follow-up lives here and remains editable."
        title="Note"
      >
        <FormField label="Note">
          <TextareaInput
            disabled={isPending}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            rows={10}
            value={notes}
          />
        </FormField>

        <div className="office-queue-meta">
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate({ notes }, "Note saved.");
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Save note
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Heavy workflow modules are no longer embedded here. Open them only when you truly need them."
        title="Other tools"
      >
        <div className="office-queue-meta">
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href="/agent/clients"
          >
            Back to clients queue
          </FrontOfficeLink>
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={`/api/agent/clients/${contact.id}/pdf`}
          >
            Open PDF summary
          </FrontOfficeLink>
          {props.linkedBackOfficeHref ? (
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={props.linkedBackOfficeHref}
            >
              Open Back Office record
            </FrontOfficeLink>
          ) : null}
        </div>
        {errorMessage ? <p>{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </SectionCard>
    </>
  );
}
