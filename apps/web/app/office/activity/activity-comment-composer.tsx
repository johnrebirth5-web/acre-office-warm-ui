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
      setError("Comment is required.");
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
        throw new Error(payload?.error ?? "Failed to add comment.");
      }

      setBody("");
      setIsOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add comment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="office-activity-comment-composer">
      {isOpen ? (
        <div className="office-activity-comment-panel">
          <FormField className="office-activity-comment-field" label="Add comment">
            <TextareaInput
              onChange={(event) => setBody(event.target.value)}
              placeholder={`Leave an internal note for ${scopeLabel}`}
              rows={3}
              value={body}
            />
          </FormField>
          <div className="office-activity-comment-actions">
            <Button disabled={isSaving} onClick={handleSubmit} type="button">
              {isSaving ? "Saving..." : "Save comment"}
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
              Cancel
            </Button>
          </div>
          {error ? <p className="office-form-error">{error}</p> : null}
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} type="button">
          Add comment
        </Button>
      )}
    </div>
  );
}
