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
import { useI18n } from "../../../lib/i18n/client";
import { translateFrontOfficeLabel } from "../_lib/front-office-language";

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        setErrorMessage(
          data?.error ||
            (isZh ? "无法保存客户更新。" : "Could not save the client update."),
        );
        return;
      }

      router.refresh();
    });
  }

  return (
    <QueueItem
      badge={
        <StatusBadge tone={client.followUpStatusTone}>
          {translateFrontOfficeLabel(client.followUpStatusLabel, isZh)}
        </StatusBadge>
      }
      context={translateFrontOfficeLabel(client.followUpReminderModeLabel, isZh)}
      title={client.displayName}
      description={`${translateFrontOfficeLabel(client.budgetLabel, isZh)} · ${translateFrontOfficeLabel(client.areasLabel, isZh)}`}
      meta={
        <>
          <span>{translateFrontOfficeLabel(client.lastFollowUpLabel, isZh)}</span>
          <span>{translateFrontOfficeLabel(client.nextReminderLabel, isZh)}</span>
          <span>{client.noteSummary}</span>
          {client.legacyOpenTaskCount > 0 ? (
            <span>
              {isZh ? "仍有旧跟进任务" : "Legacy follow-up tasks still exist"} ({client.legacyOpenTaskCount})
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
            {isZh ? "标记已跟进" : "Mark followed up"}
          </Button>
          <SelectInput
            aria-label={
              isZh
                ? `修改 ${client.displayName} 的跟进状态`
                : `Change follow-up status for ${client.displayName}`
            }
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
                {translateFrontOfficeLabel(option.label, isZh)}
              </option>
            ))}
          </SelectInput>
          <TextInput
            aria-label={
              isZh
                ? `${client.displayName} 的下次提醒`
                : `Next reminder for ${client.displayName}`
            }
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
            {isZh ? "保存提醒" : "Save reminder"}
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
            {isZh ? "使用自动" : "Use auto"}
          </Button>
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={client.href}
          >
            {isZh ? "打开档案" : "Open profile"}
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
