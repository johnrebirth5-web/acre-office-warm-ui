"use client";

import { ClientFollowUpStatus } from "@prisma/client";
import type { FrontOfficeClientRecord } from "@acre/db";
import {
  Button,
  QueueItem,
  SelectInput,
  StatusBadge,
  TextInput,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FrontOfficeLink } from "../_components/front-office-link";

type FrontOfficeClientsWorkbenchClientProps = {
  clients: FrontOfficeClientRecord[];
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

function ClientQueueRow(props: { client: FrontOfficeClientRecord }) {
  const { client } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(client.followUpStatus);
  const [nextReminderValue, setNextReminderValue] = useState(
    client.nextReminderValue,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setStatus(client.followUpStatus);
    setNextReminderValue(client.nextReminderValue);
  }, [client.followUpStatus, client.nextReminderValue]);

  async function updateClient(payload: Record<string, unknown>) {
    setErrorMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/agent/clients/${client.id}`, {
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
        setErrorMessage(data?.error || "Could not save the client update.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <QueueItem
      badge={
        <StatusBadge tone={client.followUpStatusTone}>
          {client.followUpStatusLabel}
        </StatusBadge>
      }
      context={client.followUpReminderModeLabel}
      title={client.displayName}
      description={`${client.budgetLabel} · ${client.areasLabel}`}
      meta={
        <>
          <span>{client.lastFollowUpLabel}</span>
          <span>{client.nextReminderLabel}</span>
          <span>{client.noteSummary}</span>
          {client.legacyOpenTaskCount > 0 ? (
            <span>
              Legacy follow-up tasks still exist ({client.legacyOpenTaskCount})
            </span>
          ) : null}
        </>
      }
      action={
        <>
          <Button
            disabled={isPending}
            onClick={() => {
              void updateClient({ markFollowedUpNow: true });
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Mark followed up
          </Button>
          <SelectInput
            aria-label={`Change follow-up status for ${client.displayName}`}
            disabled={isPending}
            onChange={(event) => {
              const nextStatus = event.target.value as ClientFollowUpStatus;
              setStatus(nextStatus);
              void updateClient({ followUpStatus: nextStatus });
            }}
            value={status}
          >
            {followUpStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <TextInput
            aria-label={`Next reminder for ${client.displayName}`}
            disabled={isPending}
            onChange={(event) => {
              setNextReminderValue(event.target.value);
            }}
            type="date"
            value={nextReminderValue}
          />
          <Button
            disabled={isPending}
            onClick={() => {
              void updateClient({
                nextFollowUpAt: nextReminderValue || null,
              });
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
              void updateClient({ followUpReminderMode: "auto" });
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Use auto
          </Button>
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={client.href}
          >
            Open profile
          </FrontOfficeLink>
          {errorMessage ? <span>{errorMessage}</span> : null}
        </>
      }
    />
  );
}

export function FrontOfficeClientsWorkbenchClient(
  props: FrontOfficeClientsWorkbenchClientProps,
) {
  if (!props.clients.length) {
    return null;
  }

  return (
    <div className="office-queue-list">
      {props.clients.map((client) => (
        <ClientQueueRow client={client} key={client.id} />
      ))}
    </div>
  );
}
