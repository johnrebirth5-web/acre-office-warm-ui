"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button, TextInput, TextareaInput } from "@acre/ui";

type SubmitState = {
  error: string;
  message: string;
};

const initialState: SubmitState = { error: "", message: "" };

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function sendJson<T>(
  url: string,
  input: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: input.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | T | null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : null;
    throw new Error(
      errorMessage
        ? errorMessage
        : "Request failed.",
    );
  }

  return payload as T;
}

function useSubmitState() {
  const [state, setState] = useState(initialState);
  return {
    state,
    setError(error: unknown, fallback: string) {
      setState({
        error: error instanceof Error ? error.message : fallback,
        message: "",
      });
    },
    setMessage(message: string) {
      setState({ error: "", message });
    },
  };
}

export function AdminEmailRequestForm() {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const result = await sendJson<{ emailRequest: { id: string } }>(
        "/api/office/admin-office/email-requests",
        {
          body: {
            fullName: readText(formData, "fullName"),
            preferredEmailPrefix: readText(formData, "preferredEmailPrefix"),
            notes: readText(formData, "notes"),
          },
        },
      );
      router.push(`/office/admin-office/email-requests/${result.emailRequest.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create email request.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>Full name</span>
        <TextInput name="fullName" required />
      </label>
      <label className="office-form-field">
        <span>Preferred prefix</span>
        <TextInput name="preferredEmailPrefix" required />
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>Notes</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Create request</Button>
      </div>
    </form>
  );
}

export function AdminEmailStatusForm(props: { requestId: string }) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await sendJson(`/api/office/admin-office/email-requests/${props.requestId}`, {
        method: "PATCH",
        body: {
          status: readText(formData, "status"),
          notes: readText(formData, "notes"),
        },
      });
      submit.setMessage("Status updated.");
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to update request.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>Status</span>
        <select name="status">
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending</option>
        </select>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>Notes</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      {submit.state.message ? <p>{submit.state.message}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Update status</Button>
      </div>
    </form>
  );
}

export function AdminEventForm() {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const capacity = readText(formData, "capacity");

    try {
      const result = await sendJson<{ event: { id: string } }>(
        "/api/office/admin-office/events",
        {
          body: {
            title: readText(formData, "title"),
            description: readText(formData, "description"),
            eventType: readText(formData, "eventType"),
            startsAt: readText(formData, "startsAt"),
            endsAt: readText(formData, "endsAt"),
            location: readText(formData, "location"),
            isOnline: formData.get("isOnline") === "on",
            signupRequired: formData.get("signupRequired") === "on",
            signupClosesAt: readText(formData, "signupClosesAt"),
            capacity: capacity ? Number(capacity) : null,
          },
        },
      );
      router.push(`/office/admin-office/signups/${result.event.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create event.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>Title</span>
        <TextInput name="title" required />
      </label>
      <label className="office-form-field">
        <span>Type</span>
        <select name="eventType">
          <option value="activity">Activity</option>
          <option value="meeting">Meeting</option>
          <option value="training">Training</option>
          <option value="broker_tour">Broker Tour</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>Starts at</span>
        <TextInput name="startsAt" required type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>Ends at</span>
        <TextInput name="endsAt" type="datetime-local" />
      </label>
      <label className="office-form-field">
        <span>Location</span>
        <TextInput name="location" />
      </label>
      <label className="office-form-field">
        <span>Capacity</span>
        <TextInput name="capacity" type="number" min="1" />
      </label>
      <label className="office-detail-field-checkbox">
        <input name="signupRequired" type="checkbox" />
        <span>Signup required</span>
      </label>
      <label className="office-detail-field-checkbox">
        <input name="isOnline" type="checkbox" />
        <span>Online event</span>
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>Description</span>
        <TextareaInput name="description" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Create event</Button>
      </div>
    </form>
  );
}

export function AdminSignupButton(props: {
  eventId: string;
  isSignedUp?: boolean;
}) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleClick() {
    try {
      await fetch(`/api/office/admin-office/events/${props.eventId}/signup`, {
        method: props.isSignedUp ? "DELETE" : "POST",
      }).then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Signup failed.");
        }
      });
      router.refresh();
    } catch (error) {
      submit.setError(error, "Signup failed.");
    }
  }

  return (
    <span className="office-button-row">
      <Button onClick={handleClick} size="sm" type="button" variant={props.isSignedUp ? "secondary" : "primary"}>
        {props.isSignedUp ? "Cancel signup" : "Sign up"}
      </Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
    </span>
  );
}
