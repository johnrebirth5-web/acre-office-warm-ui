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
    status: string;
    buyerName: string;
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
  const firstTemplateId = usableTemplates[0]?.id ?? "";
  const [selectedLibraryTemplateId, setSelectedLibraryTemplateId] = useState(firstTemplateId || props.templates[0]?.id || "");
  const [selectedSessionTemplateIds, setSelectedSessionTemplateIds] = useState<string[]>(() =>
    firstTemplateId ? [firstTemplateId] : [],
  );
  const selectedLibraryTemplate =
    props.templates.find((template) => template.id === selectedLibraryTemplateId) ?? props.templates[0] ?? null;
  const selectedSessionTemplates = usableTemplates.filter((template) => selectedSessionTemplateIds.includes(template.id));
  const sessionTemplateSummary =
    selectedSessionTemplates.length === 0
      ? "No templates selected"
      : selectedSessionTemplates.length === 1
        ? selectedSessionTemplates[0]?.name ?? "1 template selected"
        : `${selectedSessionTemplates.length} templates selected`;
  const sessionTemplateMeta =
    selectedSessionTemplates.length === 0
      ? "At least one PDF-ready template is required"
      : selectedSessionTemplates.map((template) => template.name).join(", ");
  const firstSessionId = sessions[0]?.id ?? "";
  const createSessionFormKey = `${firstProjectId}:${firstTemplateId}:${props.projects.length}:${usableTemplates.length}`;
  const launchSessionFormKey = sessions.map((session) => session.id).join(":");

  useEffect(() => {
    setSelectedLibraryTemplateId((current) =>
      props.templates.some((template) => template.id === current) ? current : props.templates[0]?.id ?? "",
    );
    setSelectedSessionTemplateIds((current) => {
      const usableTemplateIds = new Set(usableTemplates.map((template) => template.id));
      const valid = current.filter((templateId) => usableTemplateIds.has(templateId));

      if (valid.length || current.length === 0) {
        return valid;
      }

      return firstTemplateId ? [firstTemplateId] : [];
    });
  }, [firstTemplateId, props.templates, usableTemplates]);

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
      setActionMutation(
        "template",
        "success",
        `Template "${payload.template.name}" uploaded. The template list is updating.`,
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

  return (
    <section className="front-office-projects-actions">
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
                meta={<span>Existing project — review before creating a duplicate.</span>}
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
        className="office-list-card"
        subtitle="Only templates with a stored source PDF can be used for project signing."
        title="Active templates"
      >
        {renderFeedback("templateList")}
        {props.templates.length > 0 && selectedLibraryTemplate ? (
          <div className="front-office-template-library">
            <FormField label="Template">
              <SelectInput value={selectedLibraryTemplate.id} onChange={(event) => setSelectedLibraryTemplateId(event.currentTarget.value)}>
                {props.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · v{template.version} · {template.hasPdfSource ? "PDF ready" : "Missing PDF"}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <div className="office-queue-list front-office-template-library-detail">
              <QueueItem
                action={
                  props.canCreateTemplate ? (
                    <Button
                      disabled={mutation.kind === "loading"}
                      onClick={() => handleDeleteTemplate(selectedLibraryTemplate)}
                      size="sm"
                      type="button"
                      variant={selectedLibraryTemplate.canDelete ? "danger" : "secondary"}
                    >
                      {selectedLibraryTemplate.canDelete ? "Delete" : "Deactivate"}
                    </Button>
                  ) : null
                }
                badgeLabel={selectedLibraryTemplate.hasPdfSource ? "PDF ready" : "Missing PDF"}
                badgeTone={selectedLibraryTemplate.hasPdfSource ? "success" : "warning"}
                description={
                  selectedLibraryTemplate.description || selectedLibraryTemplate.pdfFileName || "No description"
                }
                meta={
                  <>
                    <span>v{selectedLibraryTemplate.version}</span>
                    <span>{selectedLibraryTemplate.recipientCount} recipients</span>
                    <span>{selectedLibraryTemplate.fieldCount} fields</span>
                    <span>
                      {selectedLibraryTemplate.usageCount ? `${selectedLibraryTemplate.usageCount} uses` : "unused"}
                    </span>
                  </>
                }
                title={selectedLibraryTemplate.name}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            description="Create a project_sales signature template with a PDF source before sending sessions."
            title="No project templates"
          />
        )}
      </SectionCard>

      {usableTemplates.length === 0 ? (
        <SectionCard
          className="office-list-card"
          subtitle={
            props.canCreateTemplate
              ? "Upload your first project signing template right here. It will appear in the templates list and become selectable for signing sessions."
              : "Ask a teammate with project signing create access to upload the first signing template."
          }
          title="No PDF-ready templates yet"
        >
          {props.canCreateTemplate ? (
            <p>Use the &quot;Upload template&quot; form below.</p>
          ) : (
            <p>
              Templates can be uploaded by anyone with project signing create permission, or managed in the Back
              Office at <Link href="/office/signatures/templates">/office/signatures/templates</Link>.
            </p>
          )}
        </SectionCard>
      ) : null}

      <div className="front-office-admin-grid office-card-equal-grid">
        {props.canCreateTemplate ? (
          <SectionCard
            className="office-list-card front-office-compact-card front-office-upload-card"
            subtitle="Add a PDF-backed template to the Project Signing library."
            title="Upload template"
          >
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
          </SectionCard>
        ) : null}

        <SectionCard
          className="office-list-card front-office-compact-card"
          subtitle="Set the project-level archive mailbox list once; signed copies distribute there by default."
          title="Create project"
        >
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
        </SectionCard>
      </div>

      {props.projects.length || props.archivedProjectCount > 0 ? (
        <SectionCard
          className="office-list-card front-office-compact-card"
          subtitle={
            props.canManage
              ? "Archive hides a project from active lists; sessions and signed archives stay intact and can be restored later."
              : "Archive and restore are restricted to managers, admins, and owners. Ask a manager if a duplicate project needs cleanup."
          }
          title="Manage projects"
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

      <div className="front-office-session-grid office-card-equal-grid">
        <SectionCard
          className="office-list-card front-office-compact-card front-office-session-card"
          subtitle="Create one bundled signing session. Remote emails send only after you click Send remote link."
          title="Create signing session"
        >
          {renderFeedback("session")}
          <form className="office-form-grid front-office-session-form" key={createSessionFormKey} onSubmit={handleCreateSession}>
            <FormField label="Project">
              <SelectInput defaultValue={firstProjectId} name="projectId" required>
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} · {project.name}
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
                  {usableTemplates.map((template) => (
                    <label className="front-office-template-choice" key={template.id}>
                      <input
                        checked={selectedSessionTemplateIds.includes(template.id)}
                        name="templateIds"
                        onChange={() => toggleSessionTemplate(template.id)}
                        type="checkbox"
                        value={template.id}
                      />
                      <span className="front-office-template-choice-copy">
                        <strong>{template.name}</strong>
                        <small>
                          v{template.version} · {template.recipientCount} recipients · {template.fieldCount} fields
                        </small>
                      </span>
                    </label>
                  ))}
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
              <Button disabled={!firstProjectId || !firstTemplateId || mutation.kind === "loading"} type="submit">
                Create session
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          className="office-list-card front-office-compact-card front-office-launch-card"
          subtitle="Remote links open directly for the saved recipient. iPad handoff links expire in 30 minutes."
          title="Launch existing session"
        >
          {renderFeedback("launch")}
          <div className="front-office-launch-grid">
            <form className="office-form-grid" key={`remote:${launchSessionFormKey}`} onSubmit={handleSendRemote}>
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

            <form className="office-form-grid" key={`handoff:${launchSessionFormKey}`} onSubmit={handleStartHandoff}>
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
                <Button disabled={!firstSessionId || mutation.kind === "loading"} type="submit">
                  Start iPad handoff
                </Button>
              </div>
            </form>
          </div>
        </SectionCard>
      </div>

      {remoteDelivery?.links.length ? (
        <SectionCard
          className="office-list-card"
          subtitle={
            remoteDelivery.failures.length
              ? "Email delivery did not complete for every recipient. Use these secure links while the delivery settings are reviewed."
              : "These are the latest secure links generated for the saved session recipients."
          }
          title="Latest remote links"
        >
          {renderFeedback("remoteLinks")}
          <div className="office-queue-list">
            {remoteDelivery.links.map((link) => {
              const failure = remoteDelivery.failures.find(
                (item) => item.recipientId === link.recipientId || item.email === link.email,
              );
              const copied = remoteDelivery.copiedUrl === link.signingUrl;

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
        </SectionCard>
      ) : null}
    </section>
  );
}
