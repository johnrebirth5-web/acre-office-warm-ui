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
    defaultValue: string;
  }>;
};

type SigningValueMap = Record<string, string>;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function buildInitialValues(recipient: Recipient): SigningValueMap {
  const today = new Date().toISOString().slice(0, 10);
  const values: SigningValueMap = {};

  for (const field of recipient.signingFields) {
    if (field.fieldType === "date") {
      values[field.id] = field.defaultValue || today;
    } else {
      values[field.id] = field.defaultValue;
    }
  }

  return values;
}

function getFieldLabel(field: Recipient["signingFields"][number]) {
  return field.label || field.fieldType;
}

export function ProjectHandoffClient(props: {
  token: string;
  projectName: string;
  recipients: Recipient[];
}) {
  const [recipients, setRecipients] = useState(props.recipients);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [values, setValues] = useState<SigningValueMap>({});
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const activeStep = useMemo(() => {
    const pending = recipients.filter((recipient) => recipient.status !== "acted");
    return pending.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), pending[0]?.routingStep ?? 0);
  }, [recipients]);
  const allComplete = recipients.every((recipient) => recipient.status === "acted");
  const selectedRecipient = recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

  function buildValuesForRecipient(recipient: Recipient) {
    const initials = getInitials(recipient.name);

    return recipient.signingFields
      .map((field) => {
        const textValue = (values[field.id] ?? "").trim();

        if (field.fieldType === "signature") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue,
            signatureMode: "type",
          };
        }

        if (field.fieldType === "initials") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue: textValue || initials || recipient.name,
          };
        }

        if (field.fieldType === "date") {
          return {
            fieldId: field.id,
            fieldType: field.fieldType,
            textValue,
          };
        }

        return {
          fieldId: field.id,
          fieldType: field.fieldType,
          textValue,
        };
      })
      .filter((value): value is { fieldId: string; fieldType: string; textValue: string; signatureMode?: "type" } =>
        Boolean(value.textValue),
      );
  }

  function selectRecipient(recipient: Recipient) {
    setSelectedRecipientId(recipient.id);
    setValues(buildInitialValues(recipient));
    setMessage("");
  }

  function updateFieldValue(fieldId: string, textValue: string) {
    setValues((current) => ({
      ...current,
      [fieldId]: textValue,
    }));
  }

  function validateSelectedRecipient(recipient: Recipient) {
    if (!recipient.signingFields.length) {
      return "This signer has no fields assigned. Ask Acre to update the template before completing handoff.";
    }

    const missingField = recipient.signingFields.find((field) => !(values[field.id] ?? "").trim());

    if (missingField) {
      return `Complete ${getFieldLabel(missingField)} before submitting.`;
    }

    return null;
  }

  async function submitForRecipient(recipientId: string) {
    const recipient = recipients.find((entry) => entry.id === recipientId);

    if (!recipient) {
      setMessage("Signer was not found.");
      return;
    }

    const validationError = validateSelectedRecipient(recipient);

    if (validationError) {
      setMessage(validationError);
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
      setSelectedRecipientId(null);
      setValues({});
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
        <p>
          {allComplete
            ? "All signers are complete. Exit the kiosk when you are ready."
            : selectedRecipient
              ? "Review and complete the fields for the selected signer."
              : "Tap your name when the iPad is handed to you."}
        </p>
        {message ? <p className="project-public-message">{message}</p> : null}

        {!allComplete && selectedRecipient ? (
          <form
            className="project-kiosk-signature-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitForRecipient(selectedRecipient.id);
            }}
          >
            <div className="project-kiosk-signature-heading">
              <strong>{selectedRecipient.name}</strong>
              <span>{selectedRecipient.signingFields.length} fields assigned</span>
            </div>
            <div className="project-kiosk-field-list">
              {selectedRecipient.signingFields.map((field) => {
                const isSignature = field.fieldType === "signature";

                return (
                  <label className="project-kiosk-field" key={field.id}>
                    <span>
                      {field.documentTitle} · {getFieldLabel(field)}
                    </span>
                    <input
                      autoComplete="off"
                      className={isSignature ? "office-input public-signature-typed-preview" : "office-input"}
                      disabled={isBusy}
                      onChange={(event) => updateFieldValue(field.id, event.target.value)}
                      placeholder={isSignature ? `Type ${selectedRecipient.name} to sign` : getFieldLabel(field)}
                      value={values[field.id] ?? ""}
                    />
                  </label>
                );
              })}
            </div>
            <div className="project-public-actions">
              <Button disabled={isBusy} type="submit">
                {isBusy ? "Submitting..." : "Complete signature"}
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => {
                  setSelectedRecipientId(null);
                  setValues({});
                  setMessage("");
                }}
                type="button"
                variant="secondary"
              >
                Back
              </Button>
            </div>
          </form>
        ) : !allComplete ? (
          <div className="project-kiosk-recipient-list">
            {recipients.map((recipient) => {
              const isActive = recipient.status !== "acted" && recipient.routingStep === activeStep;

              return (
                <Button
                  disabled={!isActive || isBusy}
                  key={recipient.id}
                  onClick={() => selectRecipient(recipient)}
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
