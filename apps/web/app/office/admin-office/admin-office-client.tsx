"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button, TextInput, TextareaInput } from "@acre/ui";

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
        : "请求失败。",
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
        },
      );
      router.push(`/office/admin-office/email-requests/${result.emailRequest.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "创建邮箱申请失败。");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>姓名</span>
        <TextInput name="fullName" required />
      </label>
      <label className="office-form-field">
        <span>首选前缀</span>
        <TextInput name="preferredEmailPrefix" required />
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>备注</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">创建申请</Button>
      </div>
    </form>
  );
}

export function AdminEmailStatusForm(props: { requestId: string }) {
  const router = useRouter();
  const submit = useSubmitState();

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
      });
      submit.setMessage("状态已更新。");
      router.refresh();
    } catch (error) {
      submit.setError(error, "更新申请失败。");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>状态</span>
        <select name="status">
          <option value="approved">已批准</option>
          <option value="completed">已完成</option>
          <option value="rejected">已拒绝</option>
          <option value="pending">待处理</option>
        </select>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>备注</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      {submit.state.message ? <p>{submit.state.message}</p> : null}
      <div className="office-button-row">
        <Button type="submit">更新状态</Button>
      </div>
    </form>
  );
}

export function AdminEventForm() {
  const router = useRouter();
  const submit = useSubmitState();

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
        },
      );
      router.push(`/office/admin-office/signups/${result.event.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "创建活动失败。");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>标题</span>
        <TextInput name="title" required />
      </label>
      <label className="office-form-field">
        <span>类型</span>
        <select name="eventType">
          <option value="activity">活动</option>
          <option value="meeting">会议</option>
          <option value="training">培训</option>
          <option value="broker_tour">经纪人看房团</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>开始时间</span>
        <TextInput name="startsAt" required type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>结束时间</span>
        <TextInput name="endsAt" type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>地点</span>
        <TextInput name="location" />
      </label>
      <label className="office-form-field">
        <span>容量</span>
        <TextInput name="capacity" type="number" min="1" />
      </label>
      <label className="office-detail-field-checkbox">
        <input name="signupRequired" type="checkbox" />
        <span>需要报名</span>
      </label>
      <label className="office-detail-field-checkbox">
        <input name="isOnline" type="checkbox" />
        <span>线上活动</span>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>说明</span>
        <TextareaInput name="description" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">创建活动</Button>
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

  async function handleClick() {
    try {
      await fetch(`/api/office/admin-office/events/${props.eventId}/signup`, {
        method: props.isSignedUp ? "DELETE" : "POST",
      }).then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "报名失败。");
        }
      });
      router.refresh();
    } catch (error) {
      submit.setError(error, "报名失败。");
    }
  }

  return (
    <span className="office-button-row">
      <Button onClick={handleClick} size="sm" type="button" variant={props.isSignedUp ? "secondary" : "primary"}>
        {props.isSignedUp ? "取消报名" : "报名"}
      </Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
    </span>
  );
}
