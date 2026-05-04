"use client";

import { useState } from "react";
import { Button } from "@acre/ui";

export function ProjectRemoteSignClient(props: {
  token: string;
  recipientName: string;
  signingFields: Array<{
    id: string;
    fieldType: string;
    label: string;
    documentTitle: string;
  }>;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function submitSignature() {
    setIsBusy(true);
    setMessage("");
    const today = new Date().toISOString().slice(0, 10);
    const initials = props.recipientName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    const values = props.signingFields
      .map((field) => {
        if (field.fieldType === "signature") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: props.recipientName,
            signatureMode: "type",
          };
        }

        if (field.fieldType === "initials") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: initials || props.recipientName,
          };
        }

        if (field.fieldType === "date") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: today,
          };
        }

        return null;
      })
      .filter((value): value is { fieldId: string; fieldType: string; textValue: string; signatureMode?: "type" } => Boolean(value));

    try {
      const response = await fetch(`/api/public/project-signatures/${encodeURIComponent(props.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Signature could not be submitted.");
      }

      setMessage("Signed. Acre is finalizing and distributing your secure copies.");
      setIsComplete(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signature could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="project-public-panel">
      <h1>Project signing</h1>
      <p>{isComplete ? "Your signing step is complete." : "Review the documents assigned to you, then complete the signing step."}</p>

      {message ? <p className="project-public-message">{message}</p> : null}

      <div className="project-public-actions">
        <p>{props.signingFields.length} assigned fields will be completed for {props.recipientName}.</p>
        <Button disabled={isBusy || isComplete} onClick={submitSignature} type="button">
          {isComplete ? "Signed" : "Complete signing"}
        </Button>
      </div>
    </section>
  );
}
