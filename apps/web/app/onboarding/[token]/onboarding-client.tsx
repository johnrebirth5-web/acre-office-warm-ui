"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button, TextInput } from "@acre/ui";

type UploadState = {
  error: string;
  message: string;
};

const initialState: UploadState = { error: "", message: "" };

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function PublicOnboardingUploadForm(props: {
  token: string;
  candidateEmail: string;
}) {
  const [state, setState] = useState(initialState);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(initialState);
    const formData = new FormData(event.currentTarget);
    if (!formData.get("email")) {
      formData.set("email", props.candidateEmail);
    }

    try {
      const response = await fetch(`/api/public/onboarding/${encodeURIComponent(props.token)}/documents`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "上传失败。");
      }
      setState({ error: "", message: "已上传。" });
      event.currentTarget.reset();
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : "上传失败。",
        message: "",
      });
    }
  }

  async function handleSubmitCase() {
    setState(initialState);
    try {
      const response = await fetch(`/api/public/onboarding/${encodeURIComponent(props.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedByEmail: props.candidateEmail }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "提交失败。");
      }
      setState({ error: "", message: "已提交。" });
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : "提交失败。",
        message: "",
      });
    }
  }

  return (
    <div className="office-list-page-stack">
      <form className="office-form-section-body" onSubmit={handleUpload}>
        <label className="office-form-field">
          <span>文件类型</span>
          <select name="kind">
            <option value="legal_document">法律文件</option>
            <option value="onboarding_info">入职资料</option>
            <option value="direct_deposit_info">直存资料</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label className="office-form-field">
          <span>标题</span>
          <TextInput name="title" />
        </label>
        <input name="email" type="hidden" value={props.candidateEmail} />
        <label className="office-form-field office-detail-field-wide">
          <span>文件</span>
          <input name="file" required type="file" />
        </label>
        <div className="office-button-row">
          <Button type="submit">上传文件</Button>
          <Button onClick={handleSubmitCase} type="button" variant="secondary">提交</Button>
        </div>
      </form>
      {state.error ? <p className="office-form-error">{state.error}</p> : null}
      {state.message ? <p>{state.message}</p> : null}
    </div>
  );
}
