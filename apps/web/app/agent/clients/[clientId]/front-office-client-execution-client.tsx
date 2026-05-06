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
import { useI18n } from "../../../../lib/i18n/client";
import { translateFrontOfficeLabel } from "../../_lib/front-office-language";

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
          error instanceof Error
            ? error.message
            : isZh
              ? "无法保存更改。"
              : "Could not save changes.",
        );
      }
    });
  }

  return (
    <>
      <SectionCard
        className="office-list-card"
        subtitle={isZh ? "只保留核心需求和联系执行信息。" : "Keep only the core requirement and contact execution data visible."}
        title={isZh ? "客户需求与基础信息" : "Client needs & basics"}
      >
        <div className="office-form-grid">
          <FormField
            className="office-form-grid-span-2"
            label={isZh ? "姓名" : "Name"}
          >
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
              value={fullName}
            />
          </FormField>

          <FormField label={isZh ? "微信名" : "WeChat name"}>
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setWechatDisplayName(event.target.value);
              }}
              placeholder={isZh ? "选填" : "Optional"}
              value={wechatDisplayName}
            />
          </FormField>

          <FormField label={isZh ? "预算" : "Budget"}>
            <TextInput
              disabled={isPending}
              onChange={(event) => {
                setBudgetMax(event.target.value);
              }}
              placeholder="6500"
              value={budgetMax}
            />
          </FormField>

          <FormField className="office-form-grid-span-2" label={isZh ? "目标区域" : "Target area"}>
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
            {isZh ? "显示名称：" : "Display name: "}{contact.displayName}
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
                isZh ? "客户基础信息已保存。" : "Client basics saved.",
              );
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isZh ? "保存基础信息" : "Save basics"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={isZh ? "不用打开更重的流程表单，也能维护当前状态、上次跟进和下次提醒。" : "Track current status, last touch, and the next reminder without opening a heavier workflow form."}
        title={isZh ? "跟进控制" : "Follow-up control"}
      >
        <div className="office-form-grid">
          <FormField label={isZh ? "跟进状态" : "Follow-up status"}>
            <SelectInput
              disabled={isPending}
              onChange={(event) => {
                setFollowUpStatus(event.target.value as ClientFollowUpStatus);
              }}
              value={followUpStatus}
            >
              {followUpStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {translateFrontOfficeLabel(option.label, isZh)}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label={isZh ? "提醒模式" : "Reminder mode"}>
            <TextInput
              disabled
              value={
                contact.followUpReminderMode ===
                ClientFollowUpReminderMode.manual
                  ? isZh
                    ? "手动提醒"
                    : "Manual reminder"
                  : isZh
                    ? "自动提醒"
                    : "Auto reminder"
              }
            />
          </FormField>

          <FormField label={isZh ? "上次跟进" : "Last follow-up"}>
            <TextInput
              disabled
              value={contact.lastContactAt || (isZh ? "尚未跟进" : "Not followed up yet")}
            />
          </FormField>

          <FormField label={isZh ? "下次提醒" : "Next reminder"}>
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
              {isZh ? "仍有旧跟进任务" : "Legacy follow-up tasks still exist"} ({props.legacyOpenTaskCount})
            </StatusBadge>
          ) : null}
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { followUpStatus },
                isZh ? "跟进状态已保存。" : "Follow-up status saved.",
              );
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isZh ? "保存状态" : "Save status"}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { nextFollowUpAt: nextReminderValue || null },
                isZh ? "下次提醒已按手动模式保存。" : "Next reminder saved in manual mode.",
              );
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
              runUpdate(
                { followUpReminderMode: ClientFollowUpReminderMode.auto },
                isZh ? "已恢复自动提醒。" : "Auto reminder restored.",
              );
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isZh ? "使用自动" : "Use auto"}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => {
              runUpdate(
                { markFollowedUpNow: true },
                isZh ? "上次跟进已更新。" : "Last follow-up updated.",
              );
            }}
            size="sm"
            type="button"
          >
            {isZh ? "标记已跟进" : "Mark followed up"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={isZh ? "AI 或手动跟进中的其他信息都放在这里，并保持可编辑。" : "Everything else from AI or manual follow-up lives here and remains editable."}
        title={isZh ? "备注" : "Note"}
      >
        <FormField label={isZh ? "备注" : "Note"}>
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
              runUpdate({ notes }, isZh ? "备注已保存。" : "Note saved.");
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isZh ? "保存备注" : "Save note"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle={isZh ? "较重的流程模块不再嵌在这里；只有真正需要时再打开。" : "Heavy workflow modules are no longer embedded here. Open them only when you truly need them."}
        title={isZh ? "其他工具" : "Other tools"}
      >
        <div className="office-queue-meta">
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href="/agent/clients"
          >
            {isZh ? "返回客户队列" : "Back to clients queue"}
          </FrontOfficeLink>
          <FrontOfficeLink
            className="office-inline-link front-office-inline-link"
            href={`/api/agent/clients/${contact.id}/pdf`}
          >
            {isZh ? "打开 PDF 摘要" : "Open PDF summary"}
          </FrontOfficeLink>
          {props.linkedBackOfficeHref ? (
            <FrontOfficeLink
              className="office-inline-link front-office-inline-link"
              href={props.linkedBackOfficeHref}
            >
              {isZh ? "打开后台记录" : "Open Back Office record"}
            </FrontOfficeLink>
          ) : null}
        </div>
        {errorMessage ? <p>{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </SectionCard>
    </>
  );
}
