"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Button, TextInput } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";

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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
        throw new Error(payload?.error ?? (isZh ? "上传失败。" : "Upload failed."));
      }
      setState({ error: "", message: isZh ? "已上传。" : "Uploaded." });
      event.currentTarget.reset();
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : isZh ? "上传失败。" : "Upload failed.",
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
        throw new Error(payload?.error ?? (isZh ? "提交失败。" : "Submission failed."));
      }
      setState({ error: "", message: isZh ? "已提交。" : "Submitted." });
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : isZh ? "提交失败。" : "Submission failed.",
        message: "",
      });
    }
  }

  return (
    <div className="office-list-page-stack">
      <form className="office-form-section-body" onSubmit={handleUpload}>
        <label className="office-form-field">
          <span>{isZh ? "文件类型" : "File type"}</span>
          <select name="kind">
            <option value="legal_document">{isZh ? "法律文件" : "Legal document"}</option>
            <option value="onboarding_info">{isZh ? "入职资料" : "Onboarding information"}</option>
            <option value="direct_deposit_info">{isZh ? "直存资料" : "Direct deposit information"}</option>
            <option value="other">{isZh ? "其他" : "Other"}</option>
          </select>
        </label>
        <label className="office-form-field">
          <span>{isZh ? "标题" : "Title"}</span>
          <TextInput name="title" />
        </label>
        <input name="email" type="hidden" value={props.candidateEmail} />
        <label className="office-form-field office-detail-field-wide">
          <span>{isZh ? "文件" : "File"}</span>
          <input name="file" required type="file" />
        </label>
        <div className="office-button-row">
          <Button type="submit">{isZh ? "上传文件" : "Upload file"}</Button>
          <Button onClick={handleSubmitCase} type="button" variant="secondary">{isZh ? "提交" : "Submit"}</Button>
        </div>
      </form>
      {state.error ? <p className="office-form-error">{state.error}</p> : null}
      {state.message ? <p>{state.message}</p> : null}
    </div>
  );
}
