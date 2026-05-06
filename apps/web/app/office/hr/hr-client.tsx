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

function readArray(formData: FormData, key: string) {
  return readText(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    headers: {
      "Content-Type": "application/json",
    },
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
    clear() {
      setState(initialState);
    },
  };
}

export function HrCandidateForm() {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.clear();
    const formData = new FormData(event.currentTarget);

    try {
      const result = await sendJson<{ candidate: { id: string } }>(
        "/api/office/hr/candidates",
        {
          body: {
            fullName: readText(formData, "fullName"),
            email: readText(formData, "email"),
            phone: readText(formData, "phone"),
            role: readText(formData, "role"),
            positionTitle: readText(formData, "positionTitle"),
            teamLeadName: readText(formData, "teamLeadName"),
            sourceType: readText(formData, "sourceType"),
            referrerName: readText(formData, "referrerName"),
            identityType: readText(formData, "identityType"),
            resumeDriveFileId: readText(formData, "resumeDriveFileId"),
          },
        },
      );
      router.push(`/office/hr/candidates/${result.candidate.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create candidate.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>Full name</span>
        <TextInput name="fullName" required />
      </label>
      <label className="office-form-field">
        <span>Email</span>
        <TextInput name="email" required type="email" />
      </label>
      <label className="office-form-field">
        <span>Phone</span>
        <TextInput name="phone" />
      </label>
      <label className="office-form-field">
        <span>Position</span>
        <TextInput name="positionTitle" placeholder="Sales Assistant" />
      </label>
      <label className="office-form-field">
        <span>Team lead</span>
        <TextInput name="teamLeadName" />
      </label>
      <label className="office-form-field">
        <span>Source</span>
        <TextInput name="sourceType" />
      </label>
      <label className="office-form-field">
        <span>Referrer</span>
        <TextInput name="referrerName" />
      </label>
      <label className="office-form-field">
        <span>Identity</span>
        <select name="identityType">
          <option value="">Not set</option>
          <option value="f1_student">F1 student</option>
          <option value="f1_opt">F1 OPT</option>
          <option value="green_card">Green card</option>
          <option value="citizen">Citizen</option>
          <option value="d1_cpt">D1 CPT</option>
          <option value="h1b">H1B</option>
          <option value="o1">O1</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>Resume Drive file ID</span>
        <TextInput name="resumeDriveFileId" />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Create candidate</Button>
      </div>
    </form>
  );
}

export function HrCandidateStatusForm(props: {
  candidateId: string;
  status: string;
}) {
  const router = useRouter();
  const submit = useSubmitState();
  const [status, setStatus] = useState(props.status);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await sendJson(`/api/office/hr/candidates/${props.candidateId}`, {
        method: "PATCH",
        body: { status },
      });
      submit.setMessage("Status updated.");
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to update status.");
    }
  }

  return (
    <form className="office-button-row" onSubmit={handleSubmit}>
      <select onChange={(event) => setStatus(event.target.value)} value={status}>
        <option value="applied">Applied</option>
        <option value="screening">Screening</option>
        <option value="interview_1">Interview 1</option>
        <option value="interview_2">Interview 2</option>
        <option value="offered">Offered</option>
        <option value="hired">Hired</option>
        <option value="rejected">Rejected</option>
        <option value="withdrawn">Withdrawn</option>
      </select>
      <Button size="sm" type="submit">Save</Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
      {submit.state.message ? <span>{submit.state.message}</span> : null}
    </form>
  );
}

export function HrInterviewForm(props: { candidateId?: string }) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.clear();
    const formData = new FormData(event.currentTarget);

    try {
      await sendJson("/api/office/hr/interviews", {
        body: {
          candidateId: props.candidateId ?? readText(formData, "candidateId"),
          title: readText(formData, "title"),
          mode: readText(formData, "mode"),
          startsAt: readText(formData, "startsAt"),
          endsAt: readText(formData, "endsAt"),
          location: readText(formData, "location"),
          interviewerNames: readArray(formData, "interviewerNames"),
          attendeeEmails: readArray(formData, "attendeeEmails"),
          ccEmails: readArray(formData, "ccEmails"),
          notes: readText(formData, "notes"),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      submit.setMessage("Interview requested.");
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create interview.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      {!props.candidateId ? (
        <label className="office-form-field">
          <span>Candidate ID</span>
          <TextInput name="candidateId" required />
        </label>
      ) : null}
      <label className="office-form-field">
        <span>Title</span>
        <TextInput name="title" placeholder="Second interview" />
      </label>
      <label className="office-form-field">
        <span>Mode</span>
        <select name="mode">
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>Starts at</span>
        <TextInput name="startsAt" type="datetime-local" />
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
        <span>Interviewers</span>
        <TextInput name="interviewerNames" placeholder="Comma separated" />
      </label>
      <label className="office-form-field">
        <span>Attendees</span>
        <TextInput name="attendeeEmails" placeholder="candidate@example.com" />
      </label>
      <label className="office-form-field">
        <span>CC</span>
        <TextInput name="ccEmails" />
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>Notes</span>
        <TextareaInput name="notes" rows={3} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      {submit.state.message ? <p>{submit.state.message}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Create interview</Button>
      </div>
    </form>
  );
}

export function HrCreateOnboardingButton(props: { candidateId: string }) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleClick() {
    try {
      const result = await sendJson<{ case: { id: string } }>("/api/office/hr/onboarding", {
        body: { candidateId: props.candidateId },
      });
      router.push(`/office/hr/onboarding/${result.case.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create onboarding case.");
    }
  }

  return (
    <>
      <Button onClick={handleClick} type="button">Start onboarding</Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
    </>
  );
}

export function HrIssueOnboardingTokenButton(props: { caseId: string }) {
  const router = useRouter();
  const submit = useSubmitState();
  const [publicUrl, setPublicUrl] = useState("");

  async function handleClick() {
    try {
      const result = await sendJson<{ publicUrl: string }>(
        `/api/office/hr/onboarding/${props.caseId}/token`,
      );
      setPublicUrl(result.publicUrl);
      submit.setMessage("Token issued.");
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to issue token.");
    }
  }

  return (
    <div className="office-button-row">
      <Button onClick={handleClick} type="button">Issue token</Button>
      {publicUrl ? <TextInput readOnly value={publicUrl} /> : null}
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
      {submit.state.message ? <span>{submit.state.message}</span> : null}
    </div>
  );
}

export function HrOffboardingForm(props: { candidateId?: string }) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const result = await sendJson<{ case: { id: string } }>("/api/office/hr/offboarding", {
        body: {
          candidateId: props.candidateId ?? readText(formData, "candidateId"),
          position: readText(formData, "position"),
          directSupervisor: readText(formData, "directSupervisor"),
          lastWorkingDate: readText(formData, "lastWorkingDate"),
          reason: readText(formData, "reason"),
          salespersonLicenseUnlinkRequired: formData.get("salespersonLicenseUnlinkRequired") === "on",
        },
      });
      router.push(`/office/hr/offboarding/${result.case.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to create offboarding case.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      {!props.candidateId ? (
        <label className="office-form-field">
          <span>Candidate ID</span>
          <TextInput name="candidateId" />
        </label>
      ) : null}
      <label className="office-form-field">
        <span>Position</span>
        <TextInput name="position" />
      </label>
      <label className="office-form-field">
        <span>Supervisor</span>
        <TextInput name="directSupervisor" />
      </label>
      <label className="office-form-field">
        <span>Last working date</span>
        <TextInput name="lastWorkingDate" type="date" />
      </label>
      <label className="office-form-field">
        <span>Reason</span>
        <TextInput name="reason" />
      </label>
      <label className="office-detail-field-checkbox">
        <input name="salespersonLicenseUnlinkRequired" type="checkbox" />
        <span>Salesperson license unlink required</span>
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Start offboarding</Button>
      </div>
    </form>
  );
}

export function HrChecklistItemButton(props: {
  itemId: string;
  completed: boolean;
}) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleClick() {
    try {
      await sendJson(`/api/office/hr/checklists/items/${props.itemId}`, {
        method: "PATCH",
        body: { completed: !props.completed },
      });
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to update checklist item.");
    }
  }

  return (
    <span className="office-button-row">
      <Button onClick={handleClick} size="sm" type="button" variant="secondary">
        {props.completed ? "Reopen" : "Complete"}
      </Button>
      {submit.state.error ? <span className="office-form-error">{submit.state.error}</span> : null}
    </span>
  );
}

export function HrTemplateForm(props: {
  template?: {
    id: string;
    type: string;
    name: string;
    company: string;
    position: string;
    body: string;
    variables: string[];
    driveFileId: string;
    driveFolderId: string;
    sourceUrl: string;
  };
}) {
  const router = useRouter();
  const submit = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = props.template
      ? `/api/office/hr/templates/${props.template.id}`
      : "/api/office/hr/templates";

    try {
      const result = await sendJson<{ template: { id: string } }>(url, {
        method: props.template ? "PATCH" : "POST",
        body: {
          type: readText(formData, "type"),
          name: readText(formData, "name"),
          company: readText(formData, "company"),
          position: readText(formData, "position"),
          body: readText(formData, "body"),
          variables: readArray(formData, "variables"),
          driveFileId: readText(formData, "driveFileId"),
          driveFolderId: readText(formData, "driveFolderId"),
          sourceUrl: readText(formData, "sourceUrl"),
        },
      });
      router.push(`/office/hr/templates/${result.template.id}`);
      router.refresh();
    } catch (error) {
      submit.setError(error, "Failed to save template.");
    }
  }

  return (
    <form className="office-form-section-body" onSubmit={handleSubmit}>
      <label className="office-form-field">
        <span>Type</span>
        <select defaultValue={props.template?.type ?? "offer_letter"} name="type">
          <option value="offer_letter">Offer letter</option>
          <option value="nda">NDA</option>
          <option value="employee_handbook">Employee handbook</option>
          <option value="welcome_email">Welcome email</option>
          <option value="termination_letter">Termination letter</option>
          <option value="commission_after_termination">Commission after termination</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="office-form-field">
        <span>Name</span>
        <TextInput defaultValue={props.template?.name} name="name" required />
      </label>
      <label className="office-form-field">
        <span>Company</span>
        <TextInput defaultValue={props.template?.company} name="company" />
      </label>
      <label className="office-form-field">
        <span>Position</span>
        <TextInput defaultValue={props.template?.position} name="position" />
      </label>
      <label className="office-form-field">
        <span>Variables</span>
        <TextInput defaultValue={props.template?.variables.join(", ")} name="variables" />
      </label>
      <label className="office-form-field">
        <span>Drive file ID</span>
        <TextInput defaultValue={props.template?.driveFileId} name="driveFileId" />
      </label>
      <label className="office-form-field">
        <span>Source URL</span>
        <TextInput defaultValue={props.template?.sourceUrl} name="sourceUrl" />
      </label>
      <label className="office-form-field office-detail-field-wide">
        <span>Body</span>
        <TextareaInput defaultValue={props.template?.body} name="body" rows={8} />
      </label>
      {submit.state.error ? <p className="office-form-error">{submit.state.error}</p> : null}
      <div className="office-button-row">
        <Button type="submit">Save template</Button>
      </div>
    </form>
  );
}
