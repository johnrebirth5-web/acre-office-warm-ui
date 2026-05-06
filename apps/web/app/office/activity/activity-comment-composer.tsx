"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, TextareaInput } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";

type ActivityCommentComposerProps = {
  officeId: string | null;
  scopeLabel: string;
};

export function ActivityCommentComposer({ officeId, scopeLabel }: ActivityCommentComposerProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setError(isZh ? "请输入评论内容。" : "Enter a comment before saving.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/office/activity/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          officeId,
          scopeLabel,
          body: trimmedBody
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? (isZh ? "添加评论失败。" : "Failed to add comment."));
      }

      setBody("");
      setIsOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : isZh ? "添加评论失败。" : "Failed to add comment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-activity-comment-composer">
      {isOpen ? (
        <div className="office-activity-comment-panel">
          <FormField className="office-activity-comment-field" label={isZh ? "添加评论" : "Add comment"}>
            <TextareaInput
              onChange={(event) => setBody(event.target.value)}
              placeholder={isZh ? `为 ${scopeLabel} 留一条内部备注` : `Leave an internal note for ${scopeLabel}`}
              rows={3}
              value={body}
            />
          </FormField>
          <div className="office-activity-comment-actions">
            <Button disabled={isSaving} onClick={handleSubmit} type="button">
              {isSaving ? (isZh ? "保存中..." : "Saving...") : isZh ? "保存评论" : "Save comment"}
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => {
                setIsOpen(false);
                setBody("");
                setError("");
              }}
              type="button"
              variant="secondary"
            >
              {isZh ? "取消" : "Cancel"}
            </Button>
          </div>
          {error ? <p className="office-form-error">{error}</p> : null}
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} type="button">
          {isZh ? "添加评论" : "Add comment"}
        </Button>
      )}
    </div>
  );
}
