"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, FormField, SectionCard, SelectInput, TextInput, TextareaInput } from "@acre/ui";

type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  archiveSinkEmails: string[];
  sessions: Array<{
    id: string;
    status: string;
    buyerName: string;
  }>;
};

type TemplateRecord = {
  id: string;
  name: string;
  hasPdfSource: boolean;
};

type MutationState = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
};

export function FrontOfficeProjectsClient(props: {
  projects: ProjectRecord[];
  templates: TemplateRecord[];
}) {
  const [mutation, setMutation] = useState<MutationState>({
    kind: "idle",
    message: "",
  });
  const firstProjectId = props.projects[0]?.id ?? "";
  const firstTemplateId = props.templates.find((template) => template.hasPdfSource)?.id ?? "";
  const sessions = props.projects.flatMap((project) =>
    project.sessions.map((session) => ({
      ...session,
      projectLabel: `${project.code} · ${project.name}`,
    })),
  );
  const firstSessionId = sessions[0]?.id ?? "";
  const usableTemplates = useMemo(
    () => props.templates.filter((template) => template.hasPdfSource),
    [props.templates],
  );

  async function submitJson(url: string, body: Record<string, unknown>) {
    setMutation({
      kind: "loading",
      message: "Saving...",
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    setMutation({
      kind: "success",
      message: "Saved. Refresh the page to see the latest workspace state.",
    });
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await submitJson("/api/agent/projects", {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        address: String(formData.get("address") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
        zipCode: String(formData.get("zipCode") ?? ""),
        archiveSinkEmails: String(formData.get("archiveSinkEmails") ?? "")
          .split(/,|;|\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      });
      event.currentTarget.reset();
    } catch (error) {
      setMutation({
        kind: "error",
        message: error instanceof Error ? error.message : "Project could not be created.",
      });
    }
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const projectId = String(formData.get("projectId") ?? "");
    const templateIds = formData
      .getAll("templateIds")
      .map((value) => String(value))
      .filter(Boolean);

    if (!projectId || !templateIds.length) {
      setMutation({
        kind: "error",
        message: "Choose a project and at least one template first.",
      });
      return;
    }

    try {
      await submitJson(`/api/agent/projects/${encodeURIComponent(projectId)}/sessions`, {
        mode: String(formData.get("mode") ?? "remote"),
        templateIds,
        buyerName: String(formData.get("buyerName") ?? ""),
        buyerEmail: String(formData.get("buyerEmail") ?? ""),
        buyerPhone: String(formData.get("buyerPhone") ?? ""),
        recipients: [
          {
            name: String(formData.get("buyerName") ?? ""),
            email: String(formData.get("buyerEmail") ?? ""),
            recipientRole: "buyer",
            routingStep: 1,
            sortOrder: 0,
          },
        ],
      });
      event.currentTarget.reset();
    } catch (error) {
      setMutation({
        kind: "error",
        message: error instanceof Error ? error.message : "Signing session could not be created.",
      });
    }
  }

  async function handleSendRemote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");

    try {
      setMutation({ kind: "loading", message: "Sending links..." });
      const response = await fetch(`/api/agent/projects/sessions/${encodeURIComponent(sessionId)}/send-remote`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        links?: Array<{ email: string; signingUrl: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Remote links could not be sent.");
      }

      setMutation({
        kind: "success",
        message: payload.links?.length
          ? `Remote links sent: ${payload.links.map((link) => link.email).join(", ")}`
          : "No email recipients were available for this session.",
      });
    } catch (error) {
      setMutation({
        kind: "error",
        message: error instanceof Error ? error.message : "Remote links could not be sent.",
      });
    }
  }

  async function handleStartHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");
    const pin = String(formData.get("pin") ?? "");

    try {
      setMutation({ kind: "loading", message: "Starting handoff..." });
      const response = await fetch(`/api/agent/projects/sessions/${encodeURIComponent(sessionId)}/handoff/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        handoffUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Handoff could not be started.");
      }

      setMutation({
        kind: "success",
        message: payload.handoffUrl ? `Open on iPad: ${payload.handoffUrl}` : "Handoff started.",
      });
    } catch (error) {
      setMutation({
        kind: "error",
        message: error instanceof Error ? error.message : "Handoff could not be started.",
      });
    }
  }

  return (
    <section className="front-office-projects-actions">
      {mutation.message ? (
        <div
          className={`office-inline-alert ${
            mutation.kind === "error" ? "office-inline-alert-danger" : "office-inline-alert-info"
          }`}
        >
          {mutation.message}
        </div>
      ) : null}

      <SectionCard
        className="office-list-card"
        subtitle="Set the project-level archive mailbox list once; signed copies distribute there by default."
        title="Create project"
      >
        <form className="office-form-grid" onSubmit={handleCreateProject}>
          <FormField label="Project code">
            <TextInput name="code" placeholder="ASTORIA-RES" required />
          </FormField>
          <FormField label="Project name">
            <TextInput name="name" placeholder="Astoria Reserve" required />
          </FormField>
          <FormField label="Address">
            <TextInput name="address" placeholder="12-34 31st Ave" />
          </FormField>
          <FormField label="City">
            <TextInput name="city" placeholder="Astoria" />
          </FormField>
          <FormField label="State">
            <TextInput name="state" placeholder="NY" />
          </FormField>
          <FormField label="ZIP">
            <TextInput name="zipCode" placeholder="11106" />
          </FormField>
          <FormField className="office-form-field-wide" label="Archive recipients">
            <TextareaInput name="archiveSinkEmails" placeholder="archive@company.com, ops@company.com" rows={3} />
          </FormField>
          <div className="office-form-actions">
            <Button disabled={mutation.kind === "loading"} type="submit">
              Create project
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Create one bundled signing session. Start handoff or remote send from the session row after refresh."
        title="Create signing session"
      >
        <form className="office-form-grid" onSubmit={handleCreateSession}>
          <FormField label="Project">
            <SelectInput defaultValue={firstProjectId} name="projectId" required>
              {props.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Templates">
            <SelectInput defaultValue={firstTemplateId ? [firstTemplateId] : []} multiple name="templateIds" required size={Math.min(Math.max(usableTemplates.length, 2), 5)}>
              {usableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Mode">
            <SelectInput name="mode">
              <option value="remote">Remote</option>
              <option value="in_person">In-person iPad</option>
            </SelectInput>
          </FormField>
          <FormField label="Buyer name">
            <TextInput name="buyerName" required />
          </FormField>
          <FormField label="Buyer email">
            <TextInput name="buyerEmail" required type="email" />
          </FormField>
          <FormField label="Buyer phone">
            <TextInput name="buyerPhone" />
          </FormField>
          <div className="office-form-actions">
            <Button disabled={!firstProjectId || !firstTemplateId || mutation.kind === "loading"} type="submit">
              Create session
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        className="office-list-card"
        subtitle="Remote links use email OTP. Handoff links require a fresh PIN and expire in 30 minutes."
        title="Launch existing session"
      >
        <div className="office-form-grid">
          <form className="office-form-grid" onSubmit={handleSendRemote}>
            <FormField label="Session">
              <SelectInput defaultValue={firstSessionId} name="sessionId" required>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.projectLabel} · {session.buyerName} · {session.status}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <div className="office-form-actions">
              <Button disabled={!firstSessionId || mutation.kind === "loading"} type="submit" variant="secondary">
                Send remote link
              </Button>
            </div>
          </form>

          <form className="office-form-grid" onSubmit={handleStartHandoff}>
            <FormField label="Session">
              <SelectInput defaultValue={firstSessionId} name="sessionId" required>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.projectLabel} · {session.buyerName} · {session.status}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Exit PIN">
              <TextInput inputMode="numeric" maxLength={6} minLength={4} name="pin" pattern="[0-9]{4,6}" required />
            </FormField>
            <div className="office-form-actions">
              <Button disabled={!firstSessionId || mutation.kind === "loading"} type="submit">
                Start iPad handoff
              </Button>
            </div>
          </form>
        </div>
      </SectionCard>
    </section>
  );
}
