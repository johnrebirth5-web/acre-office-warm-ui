"use client";

import { useState, type FormEvent } from "react";
import { Button, TextInput } from "@acre/ui";

export function ProjectRemoteSignClient(props: {
  token: string;
  otpRequired: boolean;
  recipientName: string;
  signingFields: Array<{
    id: string;
    fieldType: string;
    label: string;
    documentTitle: string;
  }>;
}) {
  const [otpVerified, setOtpVerified] = useState(!props.otpRequired);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function requestOtp() {
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/public/project-signatures/${encodeURIComponent(props.token)}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not send OTP.");
      }

      setMessage("Verification code sent. Check your email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/public/project-signatures/${encodeURIComponent(props.token)}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: String(formData.get("code") ?? "") }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "OTP could not be verified.");
      }

      setOtpVerified(true);
      setMessage("Verified. You can complete the signing session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OTP could not be verified.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitSignature() {
    setIsBusy(true);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signature could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="project-public-panel">
      <h1>Project signing</h1>
      <p>{otpVerified ? "Review the documents assigned to you, then complete the signing step." : "Verify your email before signing."}</p>

      {message ? <p className="project-public-message">{message}</p> : null}

      {!otpVerified ? (
        <div className="project-public-actions">
          <Button disabled={isBusy} onClick={requestOtp} type="button" variant="secondary">
            Send code
          </Button>
          <form className="project-public-otp" onSubmit={verifyOtp}>
            <TextInput inputMode="numeric" maxLength={6} minLength={6} name="code" placeholder="6-digit code" required />
            <Button disabled={isBusy} type="submit">
              Verify
            </Button>
          </form>
        </div>
      ) : (
        <div className="project-public-actions">
          <p>{props.signingFields.length} assigned fields will be completed for {props.recipientName}.</p>
          <Button disabled={isBusy} onClick={submitSignature} type="button">
            Complete signing
          </Button>
        </div>
      )}
    </section>
  );
}
