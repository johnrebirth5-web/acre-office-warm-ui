"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, TextareaInput } from "@acre/ui";

type ActivityCommentComposerProps = {
  officeId: string | null;
  scopeLabel: string;
};

export function ActivityCommentComposer({ officeId, scopeLabel }: ActivityCommentComposerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setError("请输入评论内容。");
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
        throw new Error(payload?.error ?? "添加评论失败。");
      }

      setBody("");
      setIsOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "添加评论失败。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-activity-comment-composer">
      {isOpen ? (
        <div className="office-activity-comment-panel">
          <FormField className="office-activity-comment-field" label="添加评论">
            <TextareaInput
              onChange={(event) => setBody(event.target.value)}
              placeholder={`为 ${scopeLabel} 留一条内部备注`}
              rows={3}
              value={body}
            />
          </FormField>
          <div className="office-activity-comment-actions">
            <Button disabled={isSaving} onClick={handleSubmit} type="button">
              {isSaving ? "保存中..." : "保存评论"}
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
              取消
            </Button>
          </div>
          {error ? <p className="office-form-error">{error}</p> : null}
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} type="button">
          添加评论
        </Button>
      )}
    </div>
  );
}
