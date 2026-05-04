"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, EmptyState, FormField, QueueItem, SectionCard, SelectInput, TextInput, TextareaInput } from "@acre/ui";

type ProjectRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  archiveSinkEmails: string[];
  sessionCount: number;
  archivedDocumentCount: number;
  sessions: Array<{
    id: string;
    mode: string;
    status: string;
    buyerName: string;
    buyerEmail: string;
    documentCount: number;
    recipientCount: number;
    createdAtLabel: string;
  }>;
};

type TemplateRecord = {
  id: string;
  name: string;
  version: number;
  description: string;
  hasPdfSource: boolean;
  pdfFileName: string;
  recipientCount: number;
  fieldCount: number;
  usageCount: number;
  canDelete: boolean;
};

type SimilarProject = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type MutationState = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
  scope?: "templateList" | "template" | "project" | "manage" | "session" | "launch" | "remoteLinks";
};

type RemoteSigningLink = {
  recipientId?: string;
  email: string;
  name?: string | null;
  expiresAt?: string;
  signingUrl: string;
};

type RemoteEmailFailure = {
  recipientId?: string;
  email: string;
  name?: string | null;
  error: string;
};

type RemoteDeliveryState = {
  sessionId: string;
  links: RemoteSigningLink[];
  failures: RemoteEmailFailure[];
  copiedUrl: string;
};

type SigningSessionResponse = {
  session?: {
    id: string;
    mode: "remote" | "in_person";
  };
};

type CreateProjectPayload = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  archiveSinkEmails: string[];
};

type DuplicatePrompt = {
  payload: CreateProjectPayload;
  similar: SimilarProject[];
};

export function FrontOfficeProjectsClient(props: {
  projects: ProjectRecord[];
  templates: TemplateRecord[];
  canManage: boolean;
  canCreateTemplate: boolean;
  includeArchived: boolean;
  archivedProjectCount: number;
}) {
  const router = useRouter();
  const [mutation, setMutation] = useState<MutationState>({
    kind: "idle",
    message: "",
  });
  const [remoteDelivery, setRemoteDelivery] = useState<RemoteDeliveryState | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const [pendingNewTemplate, setPendingNewTemplate] = useState(false);
  const [selectedTemplateFileName, setSelectedTemplateFileName] = useState("");
  const firstProjectId = props.projects[0]?.id ?? "";
  const [selectedProjectId, setSelectedProjectId] = useState(firstProjectId);
  const sessions = props.projects.flatMap((project) =>
    project.sessions.map((session) => ({
      ...session,
      projectLabel: `${project.code} · ${project.name}`,
    })),
  );
  const usableTemplates = useMemo(
    () => props.templates.filter((template) => template.hasPdfSource),
    [props.templates],
  );
  const signableTemplates = useMemo(
    () => usableTemplates.filter((template) => template.fieldCount > 0),
    [usableTemplates],
  );
  const firstTemplateId = signableTemplates[0]?.id ?? "";
  const [selectedLibraryTemplateId, setSelectedLibraryTemplateId] = useState(firstTemplateId || props.templates[0]?.id || "");
  const [selectedSessionTemplateIds, setSelectedSessionTemplateIds] = useState<string[]>(() =>
    firstTemplateId ? [firstTemplateId] : [],
  );
  const selectedLibraryTemplate =
    props.templates.find((template) => template.id === selectedLibraryTemplateId) ?? props.templates[0] ?? null;
  const selectedProject = props.projects.find((project) => project.id === selectedProjectId) ?? props.projects[0] ?? null;
  const selectedSessionTemplates = signableTemplates.filter((template) => selectedSessionTemplateIds.includes(template.id));
  const sessionTemplateSummary =
    selectedSessionTemplates.length === 0
      ? "No templates selected"
      : selectedSessionTemplates.length === 1
        ? selectedSessionTemplates[0]?.name ?? "1 template selected"
        : `${selectedSessionTemplates.length} templates selected`;
  const sessionTemplateMeta =
    selectedSessionTemplates.length === 0
      ? "At least one template with signing fields is required"
      : selectedSessionTemplates.map((template) => template.name).join(", ");
  const createSessionFormKey = `${firstProjectId}:${firstTemplateId}:${props.projects.length}:${signableTemplates.length}`;

  useEffect(() => {
    setSelectedProjectId((current) =>
      props.projects.some((project) => project.id === current) ? current : firstProjectId,
    );
    setSelectedLibraryTemplateId((current) =>
      props.templates.some((template) => template.id === current) ? current : props.templates[0]?.id ?? "",
    );
    setSelectedSessionTemplateIds((current) => {
      const usableTemplateIds = new Set(signableTemplates.map((template) => template.id));
      const valid = current.filter((templateId) => usableTemplateIds.has(templateId));

      if (valid.length || current.length === 0) {
        return valid;
      }

      return firstTemplateId ? [firstTemplateId] : [];
    });
  }, [firstProjectId, firstTemplateId, props.projects, props.templates, signableTemplates]);

  function toggleSessionTemplate(templateId: string) {
    setSelectedSessionTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((currentTemplateId) => currentTemplateId !== templateId)
        : [...current, templateId],
    );
  }

  function setActionMutation(scope: NonNullable<MutationState["scope"]>, kind: MutationState["kind"], message: string) {
    setMutation({ kind, message, scope });
  }

  function renderFeedback(scope: NonNullable<MutationState["scope"]>) {
    if (!mutation.message || mutation.scope !== scope) {
      return null;
    }

    return (
      <div
        className={`office-inline-alert ${
          mutation.kind === "error" ? "office-inline-alert-danger" : "office-inline-alert-info"
        }`}
      >
        {mutation.message}
      </div>
    );
  }

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      similarProjects?: SimilarProject[];
    };
    return { response, payload };
  }

  async function submitCreateProject(payload: CreateProjectPayload, force: boolean) {
    setActionMutation("project", "loading", "Saving project...");
    const { response, payload: result } = await postJson("/api/agent/projects", {
      ...payload,
      force,
    });

    if (response.status === 409 && result.similarProjects?.length) {
      setDuplicatePrompt({ payload, similar: result.similarProjects });
      setActionMutation("project", "error", "A similar project already exists. Confirm to create a duplicate.");
      return false;
    }

    if (!response.ok) {
      setActionMutation("project", "error", result.error || "Project could not be created.");
      return false;
    }

    setDuplicatePrompt(null);
    setActionMutation("project", "success", "Project saved. The workspace list is updating.");
    router.refresh();
    return true;
  }

  async function createSigningSession(url: string, body: Record<string, unknown>) {
    setActionMutation("session", "loading", "Creating signing session...");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as SigningSessionResponse & {
      error?: string;
    };

    if (!response.ok || !payload.session) {
      throw new Error(payload.error || "Signing session could not be created.");
    }

    return payload.session;
  }

  async function handleCreateTemplateWithPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRemoteDelivery(null);

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const name = String(formData.get("templateName") ?? "").trim();
    const fileInput = formElement.elements.namedItem("templateFile");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] ?? null : null;

    if (!name) {
      setActionMutation("template", "error", "Template name is required.");
      return;
    }

    if (!file) {
      setActionMutation("template", "error", "Choose a PDF file before creating the template.");
      return;
    }

    setPendingNewTemplate(true);
    setActionMutation("template", "loading", "Uploading template...");

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("name", name);
      uploadFormData.append("file", file);

      const response = await fetch("/api/agent/projects/templates", {
        method: "POST",
        body: uploadFormData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { template?: { id: string; name: string }; error?: string }
        | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error || "Failed to upload signing template.");
      }

      formElement.reset();
      setSelectedTemplateFileName("");
      setSelectedLibraryTemplateId(payload.template.id);
      setActionMutation(
        "template",
        "success",
        `Template "${payload.template.name}" uploaded. Use Edit fields to place signature fields.`,
      );
      router.refresh();
    } catch (error) {
      setActionMutation(
        "template",
        "error",
        error instanceof Error ? error.message : "Failed to upload signing template.",
      );
    } finally {
      setPendingNewTemplate(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRemoteDelivery(null);
    const formData = new FormData(event.currentTarget);
    const payload: CreateProjectPayload = {
      name: String(formData.get("name") ?? "").trim(),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
      zipCode: String(formData.get("zipCode") ?? ""),
      archiveSinkEmails: String(formData.get("archiveSinkEmails") ?? "")
        .split(/,|;|\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    };

    setDuplicatePrompt(null);

    try {
      const saved = await submitCreateProject(payload, false);
      if (saved) {
        event.currentTarget.reset();
      }
    } catch (error) {
      setActionMutation("project", "error", error instanceof Error ? error.message : "Project could not be created.");
    }
  }

  async function handleConfirmDuplicate() {
    if (!duplicatePrompt) return;
    try {
      await submitCreateProject(duplicatePrompt.payload, true);
    } catch (error) {
      setActionMutation("project", "error", error instanceof Error ? error.message : "Project could not be created.");
    }
  }

  async function handleDeleteTemplate(template: TemplateRecord) {
    const action = template.canDelete ? "Delete" : "Deactivate";
    const confirmed = window.confirm(
      template.canDelete
        ? `Delete template "${template.name}"? This is only allowed because it has not been used by signing history.`
        : `Deactivate template "${template.name}"? Existing signing history stays intact, but the template will disappear from new sessions.`,
    );

    if (!confirmed) return;

    try {
      setActionMutation("templateList", "loading", `${action}ing template...`);
      const response = await fetch(`/api/agent/projects/templates/${encodeURIComponent(template.id)}`, {
        method: template.canDelete ? "DELETE" : "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || `Template could not be ${template.canDelete ? "deleted" : "deactivated"}.`);
      }

      setActionMutation("templateList", "success", `Template ${template.canDelete ? "deleted" : "deactivated"}. The template list is updating.`);
      router.refresh();
    } catch (error) {
      setActionMutation(
        "templateList",
        "error",
        error instanceof Error ? error.message : `Template could not be ${template.canDelete ? "deleted" : "deactivated"}.`,
      );
    }
  }

  async function handleDeleteProject(project: ProjectRecord) {
    const confirmed = window.confirm(
      `Delete project "${project.code} · ${project.name}"? This is only allowed because it has no sessions or archived documents.`,
    );

    if (!confirmed) return;

    try {
      setActionMutation("manage", "loading", "Deleting project...");
      const response = await fetch(`/api/agent/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Project could not be deleted.");
      }

      setActionMutation("manage", "success", "Project deleted. The project list is updating.");
      router.refresh();
    } catch (error) {
      setActionMutation("manage", "error", error instanceof Error ? error.message : "Project could not be deleted.");
    }
  }

  async function handleArchiveProject(project: ProjectRecord) {
    const next = project.status === "archived" ? "active" : "archived";
    const verb = next === "archived" ? "Archive" : "Unarchive";
    const confirmed = window.confirm(
      `${verb} project "${project.code} · ${project.name}"? ` +
        (next === "archived"
          ? "Sessions and signed archives stay intact, but the project is hidden from active lists."
          : "The project will return to the active list."),
    );

    if (!confirmed) return;

    setActionMutation("manage", "loading", `${verb}ing project...`);

    const response = await fetch(`/api/agent/projects/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setActionMutation("manage", "error", payload.error || `${verb} failed.`);
      return;
    }

    setActionMutation("manage", "success", `${verb}d. The project list is updating.`);
    router.refresh();
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRemoteDelivery(null);
    const formData = new FormData(event.currentTarget);
    const projectId = String(formData.get("projectId") ?? "");
    const templateIds = formData
      .getAll("templateIds")
      .map((value) => String(value))
      .filter(Boolean);

    if (!projectId || !templateIds.length) {
      setActionMutation("session", "error", "Choose a project and at least one template first.");
      return;
    }

    if (templateIds.some((templateId) => !signableTemplates.some((template) => template.id === templateId))) {
      setActionMutation("session", "error", "Choose templates that already have at least one signing field.");
      return;
    }

    try {
      const mode = String(formData.get("mode") ?? "remote") === "in_person" ? "in_person" : "remote";
      const session = await createSigningSession(`/api/agent/projects/${encodeURIComponent(projectId)}/sessions`, {
        mode,
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
      setSelectedSessionTemplateIds(firstTemplateId ? [firstTemplateId] : []);
      setActionMutation(
        "session",
        "success",
        session.mode === "remote"
          ? "Signing session created. The launch list is updating; send the remote link next."
          : "Signing session created. The launch list is updating; start the iPad handoff when ready.",
      );
      router.refresh();
    } catch (error) {
      setActionMutation(
        "session",
        "error",
        error instanceof Error ? error.message : "Signing session could not be created.",
      );
    }
  }

  async function handleSendRemote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");

    try {
      setRemoteDelivery(null);
      setActionMutation("launch", "loading", "Sending links...");
      const response = await fetch(`/api/agent/projects/sessions/${encodeURIComponent(sessionId)}/send-remote`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        links?: RemoteSigningLink[];
        emailDeliveryFailures?: RemoteEmailFailure[];
        emailDeliveryWarning?: string;
      };

      if (!response.ok && !payload.links?.length) {
        throw new Error(payload.error || "Remote links could not be sent.");
      }

      if (payload.links?.length) {
        setRemoteDelivery({
          sessionId,
          links: payload.links,
          failures: payload.emailDeliveryFailures ?? [],
          copiedUrl: "",
        });
      }

      setActionMutation(
        "launch",
        payload.emailDeliveryWarning ? "error" : "success",
        payload.emailDeliveryWarning ??
          (payload.links?.length
            ? `Remote links sent to saved session recipients: ${payload.links.map((link) => link.email).join(", ")}`
            : "No email recipients were available for this session."),
      );
    } catch (error) {
      setActionMutation("launch", "error", error instanceof Error ? error.message : "Remote links could not be sent.");
    }
  }

  async function copyRemoteLink(signingUrl: string) {
    try {
      await navigator.clipboard.writeText(signingUrl);
      setRemoteDelivery((current) => (current ? { ...current, copiedUrl: signingUrl } : current));
    } catch (_error) {
      setActionMutation("remoteLinks", "error", "Copy failed. Select the link field and copy it manually.");
    }
  }

  async function handleStartHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRemoteDelivery(null);
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");

    try {
      setActionMutation("launch", "loading", "Starting handoff...");
      const response = await fetch(`/api/agent/projects/sessions/${encodeURIComponent(sessionId)}/handoff/start`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        handoffUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Handoff could not be started.");
      }

      setActionMutation("launch", "success", payload.handoffUrl ? `Open on iPad: ${payload.handoffUrl}` : "Handoff started.");
    } catch (error) {
      setActionMutation("launch", "error", error instanceof Error ? error.message : "Handoff could not be started.");
    }
  }

  const selectedLibraryTemplateStatus =
    selectedLibraryTemplate && !selectedLibraryTemplate.hasPdfSource
      ? "Missing PDF"
      : selectedLibraryTemplate && selectedLibraryTemplate.fieldCount === 0
        ? "No signing fields yet"
        : selectedLibraryTemplate
          ? "Ready for sessions"
          : "No template selected";
  const sessionReady = Boolean(selectedProjectId && firstTemplateId);

  return (
    <section className="front-office-projects-actions front-office-projects-workbench">
      {duplicatePrompt ? (
        <SectionCard
          className="office-list-card"
          subtitle="A similar project already exists in this office. Confirm only if this is intentional."
          title="Duplicate project detected"
        >
          <div className="office-queue-list">
            {duplicatePrompt.similar.map((similar) => (
              <QueueItem
                badgeLabel={similar.status}
                badgeTone={similar.status === "active" ? "accent" : "neutral"}
                key={similar.id}
                meta={<span>Existing project - review before creating a duplicate.</span>}
                title={`${similar.code} · ${similar.name}`}
              />
            ))}
          </div>
          <div className="office-form-actions">
            <Button onClick={handleConfirmDuplicate} type="button" variant="danger">
              Create anyway
            </Button>
            <Button onClick={() => setDuplicatePrompt(null)} type="button" variant="secondary">
              Cancel
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-step-project-card"
        subtitle="Choose the project first. If it does not exist yet, create it here before touching templates or sessions."
        title="Step 1 · Project"
      >
        <div className="front-office-step-grid front-office-step-grid-two">
          <div className="front-office-step-panel">
            <div className="front-office-panel-head">
              <h4>Create project</h4>
              <p>Project name is here. This is the first required setup field for a new signing packet.</p>
            </div>
            {renderFeedback("project")}
            <form className="office-form-grid" onSubmit={handleCreateProject}>
              <FormField className="office-form-field-wide" label="Project name">
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
                <TextareaInput
                  className="front-office-compact-textarea"
                  name="archiveSinkEmails"
                  placeholder="archive@company.com, ops@company.com"
                  rows={2}
                />
              </FormField>
              <div className="office-form-actions">
                <Button disabled={mutation.kind === "loading"} type="submit">
                  Create project
                </Button>
              </div>
            </form>
          </div>

          <div className="front-office-step-panel">
            <div className="front-office-panel-head">
              <h4>Use an existing project</h4>
              <p>If the project already exists, select it here and continue to Step 2.</p>
            </div>
            <FormField label="Project">
              <SelectInput
                onChange={(event) => setSelectedProjectId(event.currentTarget.value)}
                value={selectedProjectId}
              >
                {props.projects.length ? (
                  props.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} · {project.name}
                    </option>
                  ))
                ) : (
                  <option value="">No project yet</option>
                )}
              </SelectInput>
            </FormField>
            {selectedProject ? (
              <QueueItem
                badgeLabel={selectedProject.status}
                badgeTone={selectedProject.status === "active" ? "accent" : "neutral"}
                meta={
                  <>
                    <span>{selectedProject.sessionCount} sessions</span>
                    <span>{selectedProject.archivedDocumentCount} archived docs</span>
                  </>
                }
                title={`${selectedProject.code} · ${selectedProject.name}`}
              />
            ) : (
              <EmptyState
                description="Create a project on the left before building a signing session."
                title="No project selected"
              />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-step-template-card"
        subtitle="Upload the PDF if needed, then open Edit fields. A template with 0 fields cannot produce a real signer experience."
        title="Step 2 · Template & fields"
      >
        <div className="front-office-step-grid front-office-step-grid-two">
          <div className="front-office-step-panel front-office-template-library-panel">
            <div className="front-office-panel-head">
              <h4>Template library</h4>
              <p>Choose a PDF-ready template and confirm fields before it can be used in a signing session.</p>
            </div>
            {renderFeedback("templateList")}
            {props.templates.length > 0 && selectedLibraryTemplate ? (
              <div className="front-office-template-library">
                <FormField label="Template">
                  <SelectInput
                    value={selectedLibraryTemplate.id}
                    onChange={(event) => setSelectedLibraryTemplateId(event.currentTarget.value)}
                  >
                    {props.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · v{template.version} · {template.hasPdfSource ? "PDF ready" : "Missing PDF"}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                {selectedLibraryTemplate.hasPdfSource && selectedLibraryTemplate.fieldCount === 0 ? (
                  <div className="office-inline-alert office-inline-alert-danger">
                    No signing fields yet. Open Edit fields before using this template.
                  </div>
                ) : null}
                <div className="office-queue-list front-office-template-library-detail">
                  <QueueItem
                    action={
                      props.canCreateTemplate ? (
                        <div className="front-office-template-actions">
                          <Link href={`/agent/projects/templates/${encodeURIComponent(selectedLibraryTemplate.id)}/fields`}>
                            <Button size="sm" type="button" variant="secondary">
                              Edit fields
                            </Button>
                          </Link>
                          <Button
                            disabled={mutation.kind === "loading"}
                            onClick={() => handleDeleteTemplate(selectedLibraryTemplate)}
                            size="sm"
                            type="button"
                            variant={selectedLibraryTemplate.canDelete ? "danger" : "secondary"}
                          >
                            {selectedLibraryTemplate.canDelete ? "Delete" : "Deactivate"}
                          </Button>
                        </div>
                      ) : null
                    }
                    badgeLabel={selectedLibraryTemplateStatus}
                    badgeTone={selectedLibraryTemplate.fieldCount > 0 ? "success" : "warning"}
                    description={selectedLibraryTemplate.description || selectedLibraryTemplate.pdfFileName || "No description"}
                    meta={
                      <>
                        <span>v{selectedLibraryTemplate.version}</span>
                        <span>{selectedLibraryTemplate.recipientCount} recipients</span>
                        <span>{selectedLibraryTemplate.fieldCount} fields</span>
                        <span>{selectedLibraryTemplate.usageCount ? `${selectedLibraryTemplate.usageCount} uses` : "unused"}</span>
                      </>
                    }
                    title={selectedLibraryTemplate.name}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                description="Upload a project-sales PDF template, then open Edit fields to place the buyer signature areas."
                title="No project templates"
              />
            )}
          </div>

          {props.canCreateTemplate ? (
            <div className="front-office-step-panel front-office-upload-panel">
              <div className="front-office-panel-head">
                <h4>Upload template</h4>
                <p>Add a PDF source, then use Edit fields before sending it to a signer.</p>
              </div>
              {renderFeedback("template")}
              <form className="office-form-grid" onSubmit={handleCreateTemplateWithPdf}>
                <FormField label="Template name">
                  <TextInput name="templateName" placeholder="Astoria Reservation Agreement" required />
                </FormField>
                <FormField className="office-detail-field-wide front-office-file-field" label="Source PDF">
                  <input
                    accept="application/pdf,.pdf"
                    className="front-office-file-input"
                    name="templateFile"
                    onChange={(event) => setSelectedTemplateFileName(event.currentTarget.files?.[0]?.name ?? "")}
                    required
                    type="file"
                  />
                  <span className={`front-office-file-picker${selectedTemplateFileName ? " is-selected" : ""}`}>
                    <span className="front-office-file-badge">PDF</span>
                    <span className="front-office-file-copy">
                      <strong>{selectedTemplateFileName || "Choose source PDF"}</strong>
                      <small>{selectedTemplateFileName ? "Ready to upload" : "No file selected"}</small>
                    </span>
                    <span className="front-office-file-action">Choose PDF</span>
                  </span>
                </FormField>
                <div className="office-form-actions">
                  <Button disabled={pendingNewTemplate || mutation.kind === "loading"} type="submit">
                    {pendingNewTemplate ? "Uploading..." : "Upload template"}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-session-card front-office-primary-session-card"
        subtitle="Now create the signer packet from the project and the field-ready template selected above."
        title="Step 3 · Create signing session"
      >
        {renderFeedback("session")}
        {!sessionReady ? (
          <div className="office-inline-alert office-inline-alert-danger">
            {selectedProjectId
              ? "Choose a PDF template with at least one signing field before creating a session."
              : "Create or select a project before creating a signing session."}
          </div>
        ) : null}
        <form className="office-form-grid front-office-session-form" key={createSessionFormKey} onSubmit={handleCreateSession}>
          <FormField label="Project">
            <SelectInput
              name="projectId"
              onChange={(event) => setSelectedProjectId(event.currentTarget.value)}
              required
              value={selectedProjectId}
            >
              {props.projects.length ? (
                props.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} · {project.name}
                  </option>
                ))
              ) : (
                <option value="">Create a project first</option>
              )}
            </SelectInput>
          </FormField>
          <FormField label="Mode">
            <SelectInput name="mode">
              <option value="remote">Remote</option>
              <option value="in_person">In-person iPad</option>
            </SelectInput>
          </FormField>
          <div className="office-form-field office-form-field-wide">
            <span>Templates</span>
            <details className="front-office-template-dropdown">
              <summary>
                <span className="front-office-template-dropdown-summary">
                  <strong>{sessionTemplateSummary}</strong>
                  <small>{sessionTemplateMeta}</small>
                </span>
              </summary>
              <div aria-label="Templates" className="front-office-template-dropdown-panel" role="group">
                {usableTemplates.length ? (
                  usableTemplates.map((template) => (
                    <label className="front-office-template-choice" key={template.id}>
                      <input
                        checked={selectedSessionTemplateIds.includes(template.id)}
                        disabled={template.fieldCount === 0}
                        name="templateIds"
                        onChange={() => toggleSessionTemplate(template.id)}
                        type="checkbox"
                        value={template.id}
                      />
                      <span className="front-office-template-choice-copy">
                        <strong>{template.name}</strong>
                        <small>
                          v{template.version} · {template.recipientCount} recipients · {template.fieldCount} fields
                          {template.fieldCount === 0 ? " · Edit fields first" : ""}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <span className="front-office-template-choice-empty">Upload a PDF template before creating a session.</span>
                )}
              </div>
            </details>
          </div>
          <FormField label="Buyer name">
            <TextInput name="buyerName" required />
          </FormField>
          <FormField label="Buyer email">
            <TextInput name="buyerEmail" required type="email" />
          </FormField>
          <FormField label="Buyer phone">
            <TextInput name="buyerPhone" />
          </FormField>
          <div className="office-form-actions front-office-session-submit">
            <Button disabled={!sessionReady || mutation.kind === "loading"} type="submit">
              Create session
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-active-sessions-card"
        subtitle="Send remote links, copy the latest secure link, or start an iPad handoff from the same session row."
        title="Step 4 · Send / handoff"
      >
        {renderFeedback("launch")}
        {renderFeedback("remoteLinks")}
        {sessions.length ? (
          <div className="office-queue-list front-office-session-list">
            {sessions.map((session) => {
              const sessionLinks = remoteDelivery?.sessionId === session.id ? remoteDelivery.links : [];
              const firstLink = sessionLinks[0];

              return (
                <article className="front-office-session-row" key={session.id}>
                  <QueueItem
                    action={
                      <div className="front-office-session-row-actions">
                        <form onSubmit={handleSendRemote}>
                          <input name="sessionId" type="hidden" value={session.id} />
                          <Button disabled={mutation.kind === "loading"} size="sm" type="submit" variant="secondary">
                            Send remote link
                          </Button>
                        </form>
                        {firstLink ? (
                          <Button
                            onClick={() => copyRemoteLink(firstLink.signingUrl)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            {remoteDelivery?.copiedUrl === firstLink.signingUrl ? "Copied" : "Copy link"}
                          </Button>
                        ) : null}
                        <form onSubmit={handleStartHandoff}>
                          <input name="sessionId" type="hidden" value={session.id} />
                          <Button disabled={mutation.kind === "loading"} size="sm" type="submit">
                            Start iPad
                          </Button>
                        </form>
                      </div>
                    }
                    badgeLabel={session.status}
                    badgeTone={session.status === "completed" ? "success" : "accent"}
                    description={session.buyerEmail || "No buyer email saved"}
                    meta={
                      <>
                        <span>{session.mode === "in_person" ? "iPad handoff" : "Remote"}</span>
                        <span>{session.documentCount} docs</span>
                        <span>{session.recipientCount} recipients</span>
                        <span>{session.createdAtLabel}</span>
                      </>
                    }
                    title={`${session.projectLabel} · ${session.buyerName}`}
                  />
                  {sessionLinks.length ? (
                    <div className="front-office-session-row-links">
                      {sessionLinks.map((link) => {
                        const failure = remoteDelivery?.failures.find(
                          (item) => item.recipientId === link.recipientId || item.email === link.email,
                        );
                        const copied = remoteDelivery?.copiedUrl === link.signingUrl;

                        return (
                          <div className="office-detail-field office-detail-field-wide" key={link.recipientId ?? link.signingUrl}>
                            <span>{link.name ? `${link.name} · ${link.email}` : link.email}</span>
                            <div className="front-office-remote-link-row">
                              <TextInput onFocus={(event) => event.currentTarget.select()} readOnly value={link.signingUrl} />
                              <Button onClick={() => copyRemoteLink(link.signingUrl)} size="sm" type="button" variant="secondary">
                                {copied ? "Copied" : "Copy link"}
                              </Button>
                            </div>
                            {failure ? <small>Email failed: {failure.error}</small> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="Create a signing session above, then send a remote link or start the iPad handoff here."
            title="No sessions ready to launch"
          />
        )}
      </SectionCard>

      {props.projects.length || props.archivedProjectCount > 0 ? (
        <SectionCard
          className="office-list-card front-office-compact-card front-office-maintenance-card"
          subtitle={
            props.canManage
              ? "Archive hides a project from active lists; sessions and signed archives stay intact and can be restored later."
              : "Archive and restore are restricted to managers, admins, and owners. Ask a manager if a duplicate project needs cleanup."
          }
          title="Project maintenance"
        >
          {renderFeedback("manage")}
          <div className="office-form-actions">
            {props.includeArchived ? (
              <Link href="/agent/projects">
                <Button size="sm" type="button" variant="secondary">
                  Hide archived
                </Button>
              </Link>
            ) : props.archivedProjectCount > 0 ? (
              <Link href="/agent/projects?archived=1">
                <Button size="sm" type="button" variant="secondary">
                  Show {props.archivedProjectCount} archived
                </Button>
              </Link>
            ) : null}
          </div>
          <div className="office-queue-list front-office-compact-list front-office-project-manage-list">
            {props.projects.map((project) => {
              const canDeleteProject = project.sessionCount === 0 && project.archivedDocumentCount === 0;

              return (
                <QueueItem
                  action={
                    props.canManage ? (
                      <Button
                        disabled={mutation.kind === "loading"}
                        onClick={() => (canDeleteProject ? handleDeleteProject(project) : handleArchiveProject(project))}
                        size="sm"
                        type="button"
                        variant={canDeleteProject ? "danger" : project.status === "archived" ? "secondary" : "danger"}
                      >
                        {canDeleteProject ? "Delete" : project.status === "archived" ? "Unarchive" : "Archive"}
                      </Button>
                    ) : null
                  }
                  badgeLabel={project.status}
                  badgeTone={project.status === "active" ? "accent" : "neutral"}
                  key={project.id}
                  meta={
                    <>
                      <span>{project.sessionCount} sessions</span>
                      <span>{project.archivedDocumentCount} archived docs</span>
                    </>
                  }
                  title={`${project.code} · ${project.name}`}
                />
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </section>
  );
}
