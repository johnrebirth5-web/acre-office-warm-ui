"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@acre/ui";

type Recipient = {
  id: string;
  name: string;
  status: string;
  routingStep: number;
  signingFields: Array<{
    id: string;
    fieldType: string;
    label: string;
    documentTitle: string;
  }>;
};

export function ProjectHandoffClient(props: {
  token: string;
  projectName: string;
  recipients: Recipient[];
}) {
  const [recipients, setRecipients] = useState(props.recipients);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const activeStep = useMemo(() => {
    const pending = recipients.filter((recipient) => recipient.status !== "acted");
    return pending.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), pending[0]?.routingStep ?? 0);
  }, [recipients]);
  const allComplete = recipients.every((recipient) => recipient.status === "acted");

  function buildValuesForRecipient(recipient: Recipient) {
    const today = new Date().toISOString().slice(0, 10);
    const initials = recipient.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

    return recipient.signingFields
      .map((field) => {
        if (field.fieldType === "signature") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: recipient.name,
            signatureMode: "type",
          };
        }

        if (field.fieldType === "initials") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: initials || recipient.name,
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
  }

  async function submitForRecipient(recipientId: string) {
    const recipient = recipients.find((entry) => entry.id === recipientId);

    if (!recipient) {
      setMessage("Signer was not found.");
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/public/project-handoff/${encodeURIComponent(props.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, values: buildValuesForRecipient(recipient) }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Signature could not be submitted.");
      }

      setRecipients((current) => current.map((recipient) => (recipient.id === recipientId ? { ...recipient, status: "acted" } : recipient)));
      setMessage("Signed. Hand the iPad to the next signer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signature could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  async function exitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);

    try {
      const response = await fetch(`/api/public/project-handoff/${encodeURIComponent(props.token)}/exit`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Handoff could not be exited.");
      }

      window.location.href = payload.redirectTo ?? "/agent/projects";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Handoff could not be exited.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="project-kiosk-shell">
      <section className="project-kiosk-panel">
        <p className="office-eyebrow">Acre Project Signing</p>
        <h1>{props.projectName}</h1>
        <p>{allComplete ? "All signers are complete. Exit the kiosk when you are ready." : "Tap your name when the iPad is handed to you."}</p>
        {message ? <p className="project-public-message">{message}</p> : null}

        {!allComplete ? (
          <div className="project-kiosk-recipient-list">
            {recipients.map((recipient) => {
              const isActive = recipient.status !== "acted" && recipient.routingStep === activeStep;

              return (
                <Button
                  disabled={!isActive || isBusy}
                  key={recipient.id}
                  onClick={() => submitForRecipient(recipient.id)}
                  type="button"
                  variant={recipient.status === "acted" ? "secondary" : "primary"}
                >
                  {recipient.status === "acted" ? `${recipient.name} signed` : `我是 ${recipient.name} (${recipient.signingFields.length} fields)`}
                </Button>
              );
            })}
          </div>
        ) : (
          <form className="project-public-otp" onSubmit={exitHandoff}>
            <Button disabled={isBusy} type="submit">
              Exit kiosk
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
