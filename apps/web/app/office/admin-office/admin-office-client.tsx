"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button, TextInput, TextareaInput } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";

type SubmitState = {
  error: string;
  message: string;
};

const initialState: SubmitState = { error: "", message: "" };

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function sendJson<T>(
  url: string,
  input: {
    method?: string;
    body?: Record<string, unknown>;
    fallbackError?: string;
  } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: input.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | T | null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : null;
    throw new Error(
      errorMessage
        ? errorMessage
        : input.fallbackError ?? "Request failed.",
    );
  }

  return payload as T;
}

function useSubmitState() {
  const [state, setState] = useState(initialState);
  return {
    state,
    setError(error: unknown, fallback: string) {
      setState({
        error: error instanceof Error ? error.message : fallback,
        message: "",
      });
    },
    setMessage(message: string) {
      setState({ error: "", message });
    },
  };
}

export function AdminEmailRequestForm() {
  const router = useRouter();
  const submit = useSubmitState();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const result = await sendJson<{ emailRequest: { id: string } }>(
        "/api/office/admin-office/email-requests",
        {
          body: {
            fullName: readText(formData, "fullName"),
            preferredEmailPrefix: readText(formData, "preferredEmailPrefix"),
            notes: readText(formData, "notes"),
          },
          fallbackError: isZh ? "创建邮箱申请失败。" : "Failed to create email request.",
        },
      );
      router.push(`/office/admin-office/email-requests/${result.emailRequest.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, isZh ? "创建邮箱申请失败。" : "Failed to create email request.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>{isZh ? "姓名" : "Full name"}</span>
        <TextInput name="fullName" required />
      </label>
      <label className="office-form-field">
        <span>{isZh ? "首选前缀" : "Preferred prefix"}</span>
        <TextInput name="preferredEmailPrefix" required />
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>{isZh ? "备注" : "Notes"}</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">{isZh ? "创建申请" : "Create request"}</Button>
      </div>
    </form>
  );
}

export function AdminEmailStatusForm(props: { requestId: string }) {
  const router = useRouter();
  const submit = useSubmitState();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await sendJson(`/api/office/admin-office/email-requests/${props.requestId}`, {
        method: "PATCH",
        body: {
          status: readText(formData, "status"),
          notes: readText(formData, "notes"),
        },
        fallbackError: isZh ? "更新申请失败。" : "Failed to update request.",
      });
      submit.setMessage(isZh ? "状态已更新。" : "Status updated.");
      router.refresh();
    } catch (error) {
      submit.setError(error, isZh ? "更新申请失败。" : "Failed to update request.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>{isZh ? "状态" : "Status"}</span>
        <select name="status">
          <option value="approved">{isZh ? "已批准" : "Approved"}</option>
          <option value="completed">{isZh ? "已完成" : "Completed"}</option>
          <option value="rejected">{isZh ? "已拒绝" : "Rejected"}</option>
          <option value="pending">{isZh ? "待处理" : "Pending"}</option>
        </select>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>{isZh ? "备注" : "Notes"}</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      {submit.state.message ? <p>{submit.state.message}</p> : null}
      <div className="office-button-row">
        <Button type="submit">{isZh ? "更新状态" : "Update status"}</Button>
      </div>
    </form>
  );
}

export function AdminEventForm() {
  const router = useRouter();
  const submit = useSubmitState();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const capacity = readText(formData, "capacity");

    try {
      const result = await sendJson<{ event: { id: string } }>(
        "/api/office/admin-office/events",
        {
          body: {
            title: readText(formData, "title"),
            description: readText(formData, "description"),
            eventType: readText(formData, "eventType"),
            startsAt: readText(formData, "startsAt"),
            endsAt: readText(formData, "endsAt"),
            location: readText(formData, "location"),
            isOnline: formData.get("isOnline") === "on",
            signupRequired: formData.get("signupRequired") === "on",
            signupClosesAt: readText(formData, "signupClosesAt"),
            capacity: capacity ? Number(capacity) : null,
          },
          fallbackError: isZh ? "创建活动失败。" : "Failed to create event.",
        },
      );
      router.push(`/office/admin-office/signups/${result.event.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, isZh ? "创建活动失败。" : "Failed to create event.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>{isZh ? "标题" : "Title"}</span>
        <TextInput name="title" required />
      </label>
      <label className="office-form-field">
        <span>{isZh ? "类型" : "Type"}</span>
        <select name="eventType">
          <option value="activity">{isZh ? "活动" : "Activity"}</option>
          <option value="meeting">{isZh ? "会议" : "Meeting"}</option>
          <option value="training">{isZh ? "培训" : "Training"}</option>
          <option value="broker_tour">{isZh ? "经纪人看房团" : "Broker Tour"}</option>
          <option value="other">{isZh ? "其他" : "Other"}</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>{isZh ? "开始时间" : "Starts at"}</span>
        <TextInput name="startsAt" required type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>{isZh ? "结束时间" : "Ends at"}</span>
        <TextInput name="endsAt" type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>{isZh ? "地点" : "Location"}</span>
        <TextInput name="location" />
      </label>
      <label className="office-form-field">
        <span>{isZh ? "容量" : "Capacity"}</span>
        <TextInput name="capacity" type="number" min="1" />
      </label>
      <label className="office-detail-field-checkbox">
        <input name="signupRequired" type="checkbox" />
        <span>{isZh ? "需要报名" : "Signup required"}</span>
      </label>
      <label className="office-detail-field-checkbox">
        <input name="isOnline" type="checkbox" />
        <span>{isZh ? "线上活动" : "Online event"}</span>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>{isZh ? "说明" : "Description"}</span>
        <TextareaInput name="description" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">{isZh ? "创建活动" : "Create event"}</Button>
      </div>
    </form>
  );
}

export function AdminSignupButton(props: {
  eventId: string;
  isSignedUp?: boolean;
}) {
  const router = useRouter();
  const submit = useSubmitState();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  async function handleClick() {
    try {
      await fetch(`/api/office/admin-office/events/${props.eventId}/signup`, {
        method: props.isSignedUp ? "DELETE" : "POST",
      }).then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? (isZh ? "报名失败。" : "Signup failed."));
        }
      });
      router.refresh();
    } catch (error) {
      submit.setError(error, isZh ? "报名失败。" : "Signup failed.");
    }
  }

  return (
    <span className="office-button-row">
      <Button onClick={handleClick} size="sm" type="button" variant={props.isSignedUp ? "secondary" : "primary"}>
        {props.isSignedUp ? (isZh ? "取消报名" : "Cancel signup") : isZh ? "报名" : "Sign up"}
      </Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
    </span>
  );
}
