"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@acre/ui";
import {
  ProjectSigningExperience,
  type ProjectSigningDocument,
  type ProjectSigningSubmitValue,
} from "../../_components/project-signing-experience";

type Recipient = {
  id: string;
  name: string;
  status: string;
  routingStep: number;
  documents: ProjectSigningDocument[];
};

function getAssignedFieldCount(recipient: Recipient) {
  return recipient.documents.reduce((count, document) => count + document.fields.length, 0);
}

function getActiveRecipients(recipients: Recipient[]) {
  const pending = recipients.filter((recipient) => recipient.status !== "acted");
  const activeStep = pending.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), pending[0]?.routingStep ?? 0);

  return pending.filter((recipient) => recipient.routingStep === activeStep);
}

function getAutoSelectedRecipientId(recipients: Recipient[]) {
  const activeRecipients = getActiveRecipients(recipients);

  return activeRecipients.length === 1 ? activeRecipients[0]?.id ?? null : null;
}

export function ProjectHandoffClient(props: {
  token: string;
  projectName: string;
  recipients: Recipient[];
}) {
  const [recipients, setRecipients] = useState(props.recipients);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(() => getAutoSelectedRecipientId(props.recipients));
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const activeRecipients = useMemo(() => getActiveRecipients(recipients), [recipients]);
  const activeRecipientIds = useMemo(() => new Set(activeRecipients.map((recipient) => recipient.id)), [activeRecipients]);
  const allComplete = recipients.every((recipient) => recipient.status === "acted");
  const selectedRecipient = recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

  async function submitForSelectedRecipient(values: ProjectSigningSubmitValue[]) {
    if (!selectedRecipient) {
      throw new Error("Signer was not found.");
    }

    const response = await fetch(`/api/public/project-handoff/${encodeURIComponent(props.token)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: selectedRecipient.id, values }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Signature could not be submitted.");
    }

    const nextRecipients = recipients.map((recipient) =>
      recipient.id === selectedRecipient.id ? { ...recipient, status: "acted" } : recipient,
    );
    const nextSelectedRecipientId = getAutoSelectedRecipientId(nextRecipients);
    setRecipients(nextRecipients);
    setSelectedRecipientId(nextSelectedRecipientId);
    setMessage(nextSelectedRecipientId ? "Signed. Hand the iPad to the next signer." : "Signed. All signers are complete.");
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

  if (!allComplete && selectedRecipient) {
    return (
      <ProjectSigningExperience
        backLabel="Signer list"
        completeMessage="Signed. Hand the iPad to the next signer."
        description="Review the full PDF, complete each highlighted field, save the fields, then confirm this signer."
        documents={selectedRecipient.documents}
        eyebrow="Acre project signing"
        key={selectedRecipient.id}
        onBack={activeRecipients.length > 1 ? () => setSelectedRecipientId(null) : undefined}
        onSubmit={submitForSelectedRecipient}
        recipientName={selectedRecipient.name}
        submitLabel="Confirm signature"
        title={props.projectName}
      />
    );
  }

  return (
    <main className="project-kiosk-shell">
      <section className="project-kiosk-panel">
        <p className="office-eyebrow">Acre Project Signing</p>
        <h1>{props.projectName}</h1>
        <p>
          {allComplete
            ? "All signers are complete. Exit the kiosk when you are ready."
            : "Tap your name to open the full document signing page."}
        </p>
        {message ? <p className="project-public-message">{message}</p> : null}

        {!allComplete ? (
          <div className="project-kiosk-recipient-list">
            {recipients.map((recipient) => {
              const isActive = activeRecipientIds.has(recipient.id);
              const fieldCount = getAssignedFieldCount(recipient);

              return (
                <Button
                  disabled={!isActive || isBusy}
                  key={recipient.id}
                  onClick={() => setSelectedRecipientId(recipient.id)}
                  type="button"
                  variant={recipient.status === "acted" ? "secondary" : "primary"}
                >
                  {recipient.status === "acted" ? `${recipient.name} signed` : `我是 ${recipient.name} (${fieldCount} fields)`}
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
