"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, EmptyState, FormField, QueueItem, SectionCard, SelectInput, TextInput, TextareaInput } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";
import {
  formatFrontOfficeCount,
  translateFrontOfficeLabel,
} from "../_lib/front-office-language";

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
  recentDocuments: Array<{
    id: string;
    title: string;
    documentType: string;
    buyerName: string;
    buyerEmail: string;
    archivedAtLabel: string;
    contentSha256: string;
  }>;
};

type SessionRow = ProjectRecord["sessions"][number] & {
  projectLabel: string;
};

type ArchivedDocumentRow = ProjectRecord["recentDocuments"][number] & {
  projectId: string;
  projectLabel: string;
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
    status?: string;
    buyerName?: string | null;
    buyerEmail?: string | null;
    recipients?: Array<{ id: string }>;
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
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const step4Ref = useRef<HTMLDivElement | null>(null);
  const [mutation, setMutation] = useState<MutationState>({
    kind: "idle",
    message: "",
  });
  const [remoteDelivery, setRemoteDelivery] = useState<RemoteDeliveryState | null>(null);
  const [createdSessions, setCreatedSessions] = useState<SessionRow[]>([]);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const [pendingNewTemplate, setPendingNewTemplate] = useState(false);
  const [selectedTemplateFileName, setSelectedTemplateFileName] = useState("");
  const firstProjectId = props.projects[0]?.id ?? "";
  const [selectedProjectId, setSelectedProjectId] = useState(firstProjectId);
  const baseSessions = useMemo(
    () =>
      props.projects.flatMap((project) =>
        project.sessions.map((session) => ({
          ...session,
          projectLabel: `${project.code} · ${project.name}`,
        })),
      ),
    [props.projects],
  );
  const baseSessionIds = useMemo(() => new Set(baseSessions.map((session) => session.id)), [baseSessions]);
  const sessions = useMemo(() => {
    const seenSessionIds = new Set<string>();

    return [...createdSessions, ...baseSessions].filter((session) => {
      if (seenSessionIds.has(session.id)) {
        return false;
      }

      seenSessionIds.add(session.id);
      return true;
    });
  }, [baseSessions, createdSessions]);
  const archivedDocuments = useMemo<ArchivedDocumentRow[]>(
    () =>
      props.projects.flatMap((project) =>
        project.recentDocuments.map((document) => ({
          ...document,
          projectId: project.id,
          projectLabel: `${project.code} · ${project.name}`,
        })),
      ),
    [props.projects],
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
      ? isZh
        ? "未选择模板"
        : "No templates selected"
      : selectedSessionTemplates.length === 1
        ? selectedSessionTemplates[0]?.name ?? (isZh ? "已选择 1 个模板" : "1 template selected")
        : isZh
          ? `已选择 ${selectedSessionTemplates.length} 个模板`
          : `${selectedSessionTemplates.length} templates selected`;
  const sessionTemplateMeta =
    selectedSessionTemplates.length === 0
      ? isZh
        ? "至少需要一个已放置签署字段的模板"
        : "At least one template with signing fields is required"
      : selectedSessionTemplates.map((template) => template.name).join(", ");
  const createSessionFormKey = `${firstProjectId}:${firstTemplateId}:${props.projects.length}:${signableTemplates.length}`;

  useEffect(() => {
    setCreatedSessions((current) => current.filter((session) => !baseSessionIds.has(session.id)));
  }, [baseSessionIds]);

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
    setActionMutation("project", "loading", isZh ? "正在保存项目..." : "Saving project...");
    const { response, payload: result } = await postJson("/api/agent/projects", {
      ...payload,
      force,
    });

    if (response.status === 409 && result.similarProjects?.length) {
      setDuplicatePrompt({ payload, similar: result.similarProjects });
      setActionMutation(
        "project",
        "error",
        isZh ? "已存在相似项目。请确认是否仍要创建重复项目。" : "A similar project already exists. Confirm to create a duplicate.",
      );
      return false;
    }

    if (!response.ok) {
      setActionMutation("project", "error", result.error || (isZh ? "无法创建项目。" : "Project could not be created."));
      return false;
    }

    setDuplicatePrompt(null);
    setActionMutation("project", "success", isZh ? "项目已保存，工作区列表正在更新。" : "Project saved. The workspace list is updating.");
    router.refresh();
    return true;
  }

  async function createSigningSession(url: string, body: Record<string, unknown>) {
    setActionMutation("session", "loading", isZh ? "正在创建签署会话..." : "Creating signing session...");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as SigningSessionResponse & {
      error?: string;
    };

    if (!response.ok || !payload.session) {
      throw new Error(payload.error || (isZh ? "无法创建签署会话。" : "Signing session could not be created."));
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
      setActionMutation("template", "error", isZh ? "模板名称为必填项。" : "Template name is required.");
      return;
    }

    if (!file) {
      setActionMutation("template", "error", isZh ? "创建模板前请先选择 PDF 文件。" : "Choose a PDF file before creating the template.");
      return;
    }

    setPendingNewTemplate(true);
    setActionMutation("template", "loading", isZh ? "正在上传模板..." : "Uploading template...");

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
        throw new Error(payload?.error || (isZh ? "上传签署模板失败。" : "Failed to upload signing template."));
      }

      formElement.reset();
      setSelectedTemplateFileName("");
      setSelectedLibraryTemplateId(payload.template.id);
      setActionMutation(
        "template",
        "success",
        isZh
          ? `模板“${payload.template.name}”已上传。请使用“编辑字段”放置签名字段。`
          : `Template "${payload.template.name}" uploaded. Use Edit fields to place signature fields.`,
      );
      router.refresh();
    } catch (error) {
      setActionMutation(
        "template",
        "error",
        error instanceof Error ? error.message : isZh ? "上传签署模板失败。" : "Failed to upload signing template.",
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
      setActionMutation("project", "error", error instanceof Error ? error.message : isZh ? "无法创建项目。" : "Project could not be created.");
    }
  }

  async function handleConfirmDuplicate() {
    if (!duplicatePrompt) return;
    try {
      await submitCreateProject(duplicatePrompt.payload, true);
    } catch (error) {
      setActionMutation("project", "error", error instanceof Error ? error.message : isZh ? "无法创建项目。" : "Project could not be created.");
    }
  }

  async function handleDeleteTemplate(template: TemplateRecord) {
    const action = template.canDelete ? "Delete" : "Deactivate";
    const confirmed = window.confirm(
      template.canDelete
        ? isZh
          ? `删除模板“${template.name}”？只有未被签署历史使用过的模板才允许删除。`
          : `Delete template "${template.name}"? This is only allowed because it has not been used by signing history.`
        : isZh
          ? `停用模板“${template.name}”？已有签署历史会保留，但新会话里不再显示此模板。`
          : `Deactivate template "${template.name}"? Existing signing history stays intact, but the template will disappear from new sessions.`,
    );

    if (!confirmed) return;

    try {
      setActionMutation("templateList", "loading", template.canDelete ? (isZh ? "正在删除模板..." : `${action}ing template...`) : isZh ? "正在停用模板..." : `${action}ing template...`);
      const response = await fetch(`/api/agent/projects/templates/${encodeURIComponent(template.id)}`, {
        method: template.canDelete ? "DELETE" : "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (template.canDelete
              ? isZh
                ? "无法删除模板。"
                : "Template could not be deleted."
              : isZh
                ? "无法停用模板。"
                : "Template could not be deactivated."),
        );
      }

      setActionMutation(
        "templateList",
        "success",
        template.canDelete
          ? isZh
            ? "模板已删除，模板列表正在更新。"
            : "Template deleted. The template list is updating."
          : isZh
            ? "模板已停用，模板列表正在更新。"
            : "Template deactivated. The template list is updating.",
      );
      router.refresh();
    } catch (error) {
      setActionMutation(
        "templateList",
        "error",
        error instanceof Error
          ? error.message
          : template.canDelete
            ? isZh
              ? "无法删除模板。"
              : "Template could not be deleted."
            : isZh
              ? "无法停用模板。"
              : "Template could not be deactivated.",
      );
    }
  }

  async function handleDeleteProject(project: ProjectRecord) {
    const confirmed = window.confirm(
      isZh
        ? `删除项目“${project.code} · ${project.name}”？只有没有会话和归档文件的项目才允许删除。`
        : `Delete project "${project.code} · ${project.name}"? This is only allowed because it has no sessions or archived documents.`,
    );

    if (!confirmed) return;

    try {
      setActionMutation("manage", "loading", isZh ? "正在删除项目..." : "Deleting project...");
      const response = await fetch(`/api/agent/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || (isZh ? "无法删除项目。" : "Project could not be deleted."));
      }

      setActionMutation("manage", "success", isZh ? "项目已删除，项目列表正在更新。" : "Project deleted. The project list is updating.");
      router.refresh();
    } catch (error) {
      setActionMutation("manage", "error", error instanceof Error ? error.message : isZh ? "无法删除项目。" : "Project could not be deleted.");
    }
  }

  async function handleArchiveProject(project: ProjectRecord) {
    const next = project.status === "archived" ? "active" : "archived";
    const verb = next === "archived" ? "Archive" : "Unarchive";
    const confirmed = window.confirm(
      isZh
        ? `${next === "archived" ? "归档" : "取消归档"}项目“${project.code} · ${project.name}”？` +
          (next === "archived"
            ? "会话和签署归档会保留，但项目会从活跃列表中隐藏。"
            : "项目会重新回到活跃列表。")
        : `${verb} project "${project.code} · ${project.name}"? ` +
          (next === "archived"
            ? "Sessions and signed archives stay intact, but the project is hidden from active lists."
            : "The project will return to the active list."),
    );

    if (!confirmed) return;

    setActionMutation(
      "manage",
      "loading",
      next === "archived"
        ? isZh
          ? "正在归档项目..."
          : `${verb}ing project...`
        : isZh
          ? "正在取消归档项目..."
          : `${verb}ing project...`,
    );

    const response = await fetch(`/api/agent/projects/${encodeURIComponent(project.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setActionMutation(
        "manage",
        "error",
        payload.error || (isZh ? `${next === "archived" ? "归档" : "取消归档"}失败。` : `${verb} failed.`),
      );
      return;
    }

    setActionMutation(
      "manage",
      "success",
      next === "archived"
        ? isZh
          ? "已归档，项目列表正在更新。"
          : "Archived. The project list is updating."
        : isZh
          ? "已取消归档，项目列表正在更新。"
          : "Unarchived. The project list is updating.",
    );
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
      setActionMutation("session", "error", isZh ? "请先选择项目和至少一个模板。" : "Choose a project and at least one template first.");
      return;
    }

    if (templateIds.some((templateId) => !signableTemplates.some((template) => template.id === templateId))) {
      setActionMutation("session", "error", isZh ? "请选择已经至少放置一个签署字段的模板。" : "Choose templates that already have at least one signing field.");
      return;
    }

    try {
      const mode = String(formData.get("mode") ?? "remote") === "in_person" ? "in_person" : "remote";
      const buyerName = String(formData.get("buyerName") ?? "").trim();
      const buyerEmail = String(formData.get("buyerEmail") ?? "").trim();
      const buyerPhone = String(formData.get("buyerPhone") ?? "").trim();
      const session = await createSigningSession(`/api/agent/projects/${encodeURIComponent(projectId)}/sessions`, {
        mode,
        templateIds,
        buyerName,
        buyerEmail,
        buyerPhone,
        recipients: [
          {
            name: buyerName,
            email: buyerEmail,
            recipientRole: "buyer",
            routingStep: 1,
            sortOrder: 0,
          },
        ],
      });
      const project = props.projects.find((candidate) => candidate.id === projectId);
      const createdSession: SessionRow = {
        id: session.id,
        mode: session.mode,
        status: session.status ?? "draft",
        buyerName: session.buyerName?.trim() || buyerName || (isZh ? "未命名买方" : "Unnamed buyer"),
        buyerEmail: session.buyerEmail?.trim() || buyerEmail,
        documentCount: templateIds.length,
        recipientCount: session.recipients?.length || 1,
        createdAtLabel: isZh ? "刚刚" : "Just now",
        projectLabel: project ? `${project.code} · ${project.name}` : isZh ? "已选项目" : "Selected project",
      };

      setCreatedSessions((current) => [
        createdSession,
        ...current.filter((currentSession) => currentSession.id !== createdSession.id),
      ]);
      event.currentTarget.reset();
      setSelectedSessionTemplateIds(firstTemplateId ? [firstTemplateId] : []);
      setActionMutation(
        "session",
        "success",
        session.mode === "remote"
          ? isZh
            ? "签署会话已创建。它已在第 4 步准备好；下一步发送远程链接。"
            : "Signing session created. It is ready in Step 4; send the remote link next."
          : isZh
            ? "签署会话已创建。它已在第 4 步准备好；准备好后可开始 iPad 交接。"
            : "Signing session created. It is ready in Step 4; start the iPad handoff when ready.",
      );
      window.requestAnimationFrame(() => {
        step4Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      router.refresh();
    } catch (error) {
      setActionMutation(
        "session",
        "error",
        error instanceof Error ? error.message : isZh ? "无法创建签署会话。" : "Signing session could not be created.",
      );
    }
  }

  async function handleSendRemote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");

    try {
      setRemoteDelivery(null);
      setActionMutation("launch", "loading", isZh ? "正在发送链接..." : "Sending links...");
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
        throw new Error(payload.error || (isZh ? "无法发送远程链接。" : "Remote links could not be sent."));
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
            ? isZh
              ? `远程链接已发送给已保存的会话收件人：${payload.links.map((link) => link.email).join(", ")}`
              : `Remote links sent to saved session recipients: ${payload.links.map((link) => link.email).join(", ")}`
            : isZh
              ? "此会话没有可用的邮件收件人。"
              : "No email recipients were available for this session."),
      );
    } catch (error) {
      setActionMutation("launch", "error", error instanceof Error ? error.message : isZh ? "无法发送远程链接。" : "Remote links could not be sent.");
    }
  }

  async function copyRemoteLink(signingUrl: string) {
    try {
      await navigator.clipboard.writeText(signingUrl);
      setRemoteDelivery((current) => (current ? { ...current, copiedUrl: signingUrl } : current));
    } catch (_error) {
      setActionMutation("remoteLinks", "error", isZh ? "复制失败。请选中链接字段并手动复制。" : "Copy failed. Select the link field and copy it manually.");
    }
  }

  async function handleStartHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRemoteDelivery(null);
    const formData = new FormData(event.currentTarget);
    const sessionId = String(formData.get("sessionId") ?? "");

    try {
      setActionMutation("launch", "loading", isZh ? "正在开始交接..." : "Starting handoff...");
      const response = await fetch(`/api/agent/projects/sessions/${encodeURIComponent(sessionId)}/handoff/start`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        handoffUrl?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || (isZh ? "无法开始交接。" : "Handoff could not be started."));
      }

      if (payload.handoffUrl) {
        setActionMutation("launch", "success", isZh ? "正在打开 iPad 交接..." : "Opening iPad handoff...");
        window.location.assign(payload.handoffUrl);
        return;
      }

      setActionMutation("launch", "success", isZh ? "交接已开始。" : "Handoff started.");
    } catch (error) {
      setActionMutation("launch", "error", error instanceof Error ? error.message : isZh ? "无法开始交接。" : "Handoff could not be started.");
    }
  }

  const selectedLibraryTemplateStatus =
    selectedLibraryTemplate && !selectedLibraryTemplate.hasPdfSource
      ? isZh
        ? "缺少 PDF"
        : "Missing PDF"
      : selectedLibraryTemplate && selectedLibraryTemplate.fieldCount === 0
        ? isZh
          ? "还没有签署字段"
          : "No signing fields yet"
        : selectedLibraryTemplate
          ? isZh
            ? "可创建会话"
            : "Ready for sessions"
          : isZh
            ? "未选择模板"
            : "No template selected";
  const sessionReady = Boolean(selectedProjectId && firstTemplateId);

  return (
    <section className="front-office-projects-actions front-office-projects-workbench">
      {duplicatePrompt ? (
        <SectionCard
          className="office-list-card"
          subtitle={isZh ? "这个办公室里已经有相似项目。只有确认这是有意重复时才继续。" : "A similar project already exists in this office. Confirm only if this is intentional."}
          title={isZh ? "检测到重复项目" : "Duplicate project detected"}
        >
          <div className="office-queue-list">
            {duplicatePrompt.similar.map((similar) => (
              <QueueItem
                badgeLabel={translateFrontOfficeLabel(similar.status, isZh)}
                badgeTone={similar.status === "active" ? "accent" : "neutral"}
                key={similar.id}
                meta={<span>{isZh ? "已有项目 - 创建重复项前请先检查。" : "Existing project - review before creating a duplicate."}</span>}
                title={`${similar.code} · ${similar.name}`}
              />
            ))}
          </div>
          <div className="office-form-actions">
            <Button onClick={handleConfirmDuplicate} type="button" variant="danger">
              {isZh ? "仍然创建" : "Create anyway"}
            </Button>
            <Button onClick={() => setDuplicatePrompt(null)} type="button" variant="secondary">
              {isZh ? "取消" : "Cancel"}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-step-project-card"
        subtitle={isZh ? "先选择项目。如果项目还不存在，请先在这里创建，再处理模板或会话。" : "Choose the project first. If it does not exist yet, create it here before touching templates or sessions."}
        title={isZh ? "第 1 步 · 项目" : "Step 1 · Project"}
      >
        <div className="front-office-step-grid front-office-step-grid-two">
          <div className="front-office-step-panel">
            <div className="front-office-panel-head">
              <h4>{isZh ? "创建项目" : "Create project"}</h4>
              <p>
                {isZh
                  ? "项目名称在这里填写。这是新签署包的第一个必填设置字段。"
                  : "Project name is here. This is the first required setup field for a new signing packet."}
              </p>
            </div>
            {renderFeedback("project")}
            <form className="office-form-grid" onSubmit={handleCreateProject}>
              <FormField className="office-form-field-wide" label={isZh ? "项目名称" : "Project name"}>
                <TextInput name="name" placeholder="Astoria Reserve" required />
              </FormField>
              <FormField label={isZh ? "地址" : "Address"}>
                <TextInput name="address" placeholder="12-34 31st Ave" />
              </FormField>
              <FormField label={isZh ? "城市" : "City"}>
                <TextInput name="city" placeholder="Astoria" />
              </FormField>
              <FormField label={isZh ? "州" : "State"}>
                <TextInput name="state" placeholder="NY" />
              </FormField>
              <FormField label={isZh ? "邮编" : "ZIP"}>
                <TextInput name="zipCode" placeholder="11106" />
              </FormField>
              <FormField className="office-form-field-wide" label={isZh ? "归档收件人" : "Archive recipients"}>
                <TextareaInput
                  className="front-office-compact-textarea"
                  name="archiveSinkEmails"
                  placeholder="archive@company.com, ops@company.com"
                  rows={2}
                />
              </FormField>
              <div className="office-form-actions">
                <Button disabled={mutation.kind === "loading"} type="submit">
                  {isZh ? "创建项目" : "Create project"}
                </Button>
              </div>
            </form>
          </div>

          <div className="front-office-step-panel">
            <div className="front-office-panel-head">
              <h4>{isZh ? "使用已有项目" : "Use an existing project"}</h4>
              <p>{isZh ? "如果项目已经存在，请在这里选择，然后继续第 2 步。" : "If the project already exists, select it here and continue to Step 2."}</p>
            </div>
            <FormField label={isZh ? "项目" : "Project"}>
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
                  <option value="">{isZh ? "还没有项目" : "No project yet"}</option>
                )}
              </SelectInput>
            </FormField>
            {selectedProject ? (
              <QueueItem
                badgeLabel={translateFrontOfficeLabel(selectedProject.status, isZh)}
                badgeTone={selectedProject.status === "active" ? "accent" : "neutral"}
                meta={
                  <>
                    <span>{formatFrontOfficeCount(selectedProject.sessionCount, isZh, "session", "sessions", "个会话")}</span>
                    <span>{formatFrontOfficeCount(selectedProject.archivedDocumentCount, isZh, "archived doc", "archived docs", "份归档文件")}</span>
                  </>
                }
                title={`${selectedProject.code} · ${selectedProject.name}`}
              />
            ) : (
              <EmptyState
                description={isZh ? "创建签署会话前，请先在左侧创建项目。" : "Create a project on the left before building a signing session."}
                title={isZh ? "未选择项目" : "No project selected"}
              />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-step-template-card"
        subtitle={isZh ? "需要时先上传 PDF，然后打开“编辑字段”。0 个字段的模板无法生成真实签署体验。" : "Upload the PDF if needed, then open Edit fields. A template with 0 fields cannot produce a real signer experience."}
        title={isZh ? "第 2 步 · 模板与字段" : "Step 2 · Template & fields"}
      >
        <div className="front-office-step-grid front-office-step-grid-two">
          <div className="front-office-step-panel front-office-template-library-panel">
            <div className="front-office-panel-head">
              <h4>{isZh ? "模板库" : "Template library"}</h4>
              <p>{isZh ? "选择一个 PDF 已就绪的模板，并确认字段后再用于签署会话。" : "Choose a PDF-ready template and confirm fields before it can be used in a signing session."}</p>
            </div>
            {renderFeedback("templateList")}
            {props.templates.length > 0 && selectedLibraryTemplate ? (
              <div className="front-office-template-library">
                <FormField label={isZh ? "模板" : "Template"}>
                  <SelectInput
                    value={selectedLibraryTemplate.id}
                    onChange={(event) => setSelectedLibraryTemplateId(event.currentTarget.value)}
                  >
                    {props.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · v{template.version} · {template.hasPdfSource ? (isZh ? "PDF 已就绪" : "PDF ready") : isZh ? "缺少 PDF" : "Missing PDF"}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                {selectedLibraryTemplate.hasPdfSource && selectedLibraryTemplate.fieldCount === 0 ? (
                  <div className="office-inline-alert office-inline-alert-danger">
                    {isZh ? "还没有签署字段。使用此模板前，请先打开“编辑字段”。" : "No signing fields yet. Open Edit fields before using this template."}
                  </div>
                ) : null}
                <div className="office-queue-list front-office-template-library-detail">
                  <QueueItem
                    action={
                      props.canCreateTemplate ? (
                        <div className="front-office-template-actions">
                          <Link href={`/agent/projects/templates/${encodeURIComponent(selectedLibraryTemplate.id)}/fields`}>
                            <Button size="sm" type="button" variant="secondary">
                              {isZh ? "编辑字段" : "Edit fields"}
                            </Button>
                          </Link>
                          <Button
                            disabled={mutation.kind === "loading"}
                            onClick={() => handleDeleteTemplate(selectedLibraryTemplate)}
                            size="sm"
                            type="button"
                            variant={selectedLibraryTemplate.canDelete ? "danger" : "secondary"}
                          >
                            {selectedLibraryTemplate.canDelete ? (isZh ? "删除" : "Delete") : isZh ? "停用" : "Deactivate"}
                          </Button>
                        </div>
                      ) : null
                    }
                    badgeLabel={selectedLibraryTemplateStatus}
                    badgeTone={selectedLibraryTemplate.fieldCount > 0 ? "success" : "warning"}
                    description={selectedLibraryTemplate.description || selectedLibraryTemplate.pdfFileName || (isZh ? "没有描述" : "No description")}
                    meta={
                      <>
                        <span>v{selectedLibraryTemplate.version}</span>
                        <span>{formatFrontOfficeCount(selectedLibraryTemplate.recipientCount, isZh, "recipient", "recipients", "位收件人")}</span>
                        <span>{formatFrontOfficeCount(selectedLibraryTemplate.fieldCount, isZh, "field", "fields", "个字段")}</span>
                        <span>
                          {selectedLibraryTemplate.usageCount
                            ? formatFrontOfficeCount(selectedLibraryTemplate.usageCount, isZh, "use", "uses", "次使用")
                            : isZh
                              ? "未使用"
                              : "unused"}
                        </span>
                      </>
                    }
                    title={selectedLibraryTemplate.name}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                description={isZh ? "上传项目销售 PDF 模板后，打开“编辑字段”放置买方签署区域。" : "Upload a project-sales PDF template, then open Edit fields to place the buyer signature areas."}
                title={isZh ? "还没有项目模板" : "No project templates"}
              />
            )}
          </div>

          {props.canCreateTemplate ? (
            <div className="front-office-step-panel front-office-upload-panel">
              <div className="front-office-panel-head">
                <h4>{isZh ? "上传模板" : "Upload template"}</h4>
                <p>{isZh ? "添加 PDF 源文件后，请先使用“编辑字段”，再发给签署人。" : "Add a PDF source, then use Edit fields before sending it to a signer."}</p>
              </div>
              {renderFeedback("template")}
              <form className="office-form-grid" onSubmit={handleCreateTemplateWithPdf}>
                <FormField label={isZh ? "模板名称" : "Template name"}>
                  <TextInput name="templateName" placeholder="Astoria Reservation Agreement" required />
                </FormField>
                <FormField className="office-detail-field-wide front-office-file-field" label={isZh ? "源 PDF" : "Source PDF"}>
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
                      <strong>{selectedTemplateFileName || (isZh ? "选择源 PDF" : "Choose source PDF")}</strong>
                      <small>{selectedTemplateFileName ? (isZh ? "可上传" : "Ready to upload") : isZh ? "未选择文件" : "No file selected"}</small>
                    </span>
                    <span className="front-office-file-action">{isZh ? "选择 PDF" : "Choose PDF"}</span>
                  </span>
                </FormField>
                <div className="office-form-actions">
                  <Button disabled={pendingNewTemplate || mutation.kind === "loading"} type="submit">
                    {pendingNewTemplate ? (isZh ? "上传中..." : "Uploading...") : isZh ? "上传模板" : "Upload template"}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-step-card front-office-session-card front-office-primary-session-card"
        subtitle={isZh ? "现在用上面选择的项目和已放置字段的模板创建签署包。" : "Now create the signer packet from the project and the field-ready template selected above."}
        title={isZh ? "第 3 步 · 创建签署会话" : "Step 3 · Create signing session"}
      >
        {renderFeedback("session")}
        {!sessionReady ? (
          <div className="office-inline-alert office-inline-alert-danger">
            {selectedProjectId
              ? isZh
                ? "创建会话前，请选择至少包含一个签署字段的 PDF 模板。"
                : "Choose a PDF template with at least one signing field before creating a session."
              : isZh
                ? "创建签署会话前，请先创建或选择项目。"
                : "Create or select a project before creating a signing session."}
          </div>
        ) : null}
        <form className="office-form-grid front-office-session-form" key={createSessionFormKey} onSubmit={handleCreateSession}>
          <FormField label={isZh ? "项目" : "Project"}>
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
                <option value="">{isZh ? "请先创建项目" : "Create a project first"}</option>
              )}
            </SelectInput>
          </FormField>
          <FormField label={isZh ? "模式" : "Mode"}>
            <SelectInput name="mode">
              <option value="remote">{isZh ? "远程" : "Remote"}</option>
              <option value="in_person">{isZh ? "现场 iPad" : "In-person iPad"}</option>
            </SelectInput>
          </FormField>
          <div className="office-form-field office-form-field-wide">
            <span>{isZh ? "模板" : "Templates"}</span>
            <details className="front-office-template-dropdown">
              <summary>
                <span className="front-office-template-dropdown-summary">
                  <strong>{sessionTemplateSummary}</strong>
                  <small>{sessionTemplateMeta}</small>
                </span>
              </summary>
              <div aria-label={isZh ? "模板" : "Templates"} className="front-office-template-dropdown-panel" role="group">
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
                          v{template.version} · {formatFrontOfficeCount(template.recipientCount, isZh, "recipient", "recipients", "位收件人")} ·{" "}
                          {formatFrontOfficeCount(template.fieldCount, isZh, "field", "fields", "个字段")}
                          {template.fieldCount === 0 ? (isZh ? " · 请先编辑字段" : " · Edit fields first") : ""}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <span className="front-office-template-choice-empty">
                    {isZh ? "创建会话前，请先上传 PDF 模板。" : "Upload a PDF template before creating a session."}
                  </span>
                )}
              </div>
            </details>
          </div>
          <FormField label={isZh ? "买方姓名" : "Buyer name"}>
            <TextInput name="buyerName" required />
          </FormField>
          <FormField label={isZh ? "买方邮箱" : "Buyer email"}>
            <TextInput name="buyerEmail" required type="email" />
          </FormField>
          <FormField label={isZh ? "买方电话" : "Buyer phone"}>
            <TextInput name="buyerPhone" />
          </FormField>
          <div className="office-form-actions front-office-session-submit">
            <Button disabled={!sessionReady || mutation.kind === "loading"} type="submit">
              {isZh ? "创建会话" : "Create session"}
            </Button>
          </div>
        </form>
      </SectionCard>

      <div ref={step4Ref}>
        <SectionCard
          className="office-list-card front-office-compact-card front-office-active-sessions-card"
          subtitle={isZh ? "在同一条会话记录里发送远程链接、复制最新安全链接，或开始 iPad 交接。" : "Send remote links, copy the latest secure link, or start an iPad handoff from the same session row."}
          title={isZh ? "第 4 步 · 发送 / 交接" : "Step 4 · Send / handoff"}
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
                              {isZh ? "发送远程链接" : "Send remote link"}
                            </Button>
                          </form>
                          {firstLink ? (
                            <Button
                              onClick={() => copyRemoteLink(firstLink.signingUrl)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {remoteDelivery?.copiedUrl === firstLink.signingUrl ? (isZh ? "已复制" : "Copied") : isZh ? "复制链接" : "Copy link"}
                            </Button>
                          ) : null}
                          <form onSubmit={handleStartHandoff}>
                            <input name="sessionId" type="hidden" value={session.id} />
                            <Button disabled={mutation.kind === "loading"} size="sm" type="submit">
                              {isZh ? "开始 iPad" : "Start iPad"}
                            </Button>
                          </form>
                        </div>
                      }
                      badgeLabel={translateFrontOfficeLabel(session.status, isZh)}
                      badgeTone={session.status === "completed" ? "success" : "accent"}
                      description={session.buyerEmail || (isZh ? "未保存买方邮箱" : "No buyer email saved")}
                      meta={
                        <>
                          <span>{session.mode === "in_person" ? (isZh ? "iPad 交接" : "iPad handoff") : isZh ? "远程" : "Remote"}</span>
                          <span>{formatFrontOfficeCount(session.documentCount, isZh, "doc", "docs", "份文件")}</span>
                          <span>{formatFrontOfficeCount(session.recipientCount, isZh, "recipient", "recipients", "位收件人")}</span>
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
                                  {copied ? (isZh ? "已复制" : "Copied") : isZh ? "复制链接" : "Copy link"}
                                </Button>
                              </div>
                              {failure ? <small>{isZh ? "邮件发送失败：" : "Email failed: "}{failure.error}</small> : null}
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
              description={isZh ? "先在上方创建签署会话，然后在这里发送远程链接或开始 iPad 交接。" : "Create a signing session above, then send a remote link or start the iPad handoff here."}
              title={isZh ? "还没有可启动的会话" : "No sessions ready to launch"}
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="office-list-card front-office-compact-card front-office-signed-archive-card"
        subtitle={isZh ? "所有必需签署人提交后，完成的 PDF 会归档到项目下。" : "Completed PDFs are archived under the project after all required signers submit."}
        title={isZh ? "签署归档" : "Signed archive"}
      >
        {archivedDocuments.length ? (
          <div className="office-queue-list front-office-compact-list front-office-signed-archive-list">
            {archivedDocuments.map((document) => (
              <QueueItem
                action={
                  <Link
                    href={`/api/agent/projects/${encodeURIComponent(document.projectId)}/documents/${encodeURIComponent(document.id)}/file`}
                    target="_blank"
                  >
                    <Button size="sm" type="button" variant="secondary">
                      {isZh ? "打开 PDF" : "Open PDF"}
                    </Button>
                  </Link>
                }
                badgeLabel={translateFrontOfficeLabel(document.documentType || "signed", isZh)}
                badgeTone="success"
                description={document.buyerEmail || document.buyerName || (isZh ? "没有买方快照" : "No buyer snapshot")}
                key={document.id}
                meta={
                  <>
                    <span>{document.projectLabel}</span>
                    <span>{document.archivedAtLabel}</span>
                    {document.contentSha256 ? <span>SHA {document.contentSha256.slice(0, 8)}</span> : null}
                  </>
                }
                title={document.title}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description={isZh ? "项目签署会话完成后，签署好的 PDF 会显示在这里。" : "Once a project signing session completes, the signed PDFs will be available here."}
            title={isZh ? "还没有已签署的项目文件" : "No signed project files yet"}
          />
        )}
      </SectionCard>

      {props.projects.length || props.archivedProjectCount > 0 ? (
        <SectionCard
          className="office-list-card front-office-compact-card front-office-maintenance-card"
          subtitle={
            props.canManage
              ? isZh
                ? "归档会把项目从活跃列表隐藏；会话和签署归档仍会保留，并可稍后恢复。"
                : "Archive hides a project from active lists; sessions and signed archives stay intact and can be restored later."
              : isZh
                ? "归档和恢复仅限经理、管理员和所有者。如果重复项目需要清理，请联系经理。"
                : "Archive and restore are restricted to managers, admins, and owners. Ask a manager if a duplicate project needs cleanup."
          }
          title={isZh ? "项目维护" : "Project maintenance"}
        >
          {renderFeedback("manage")}
          <div className="office-form-actions">
            {props.includeArchived ? (
              <Link href="/agent/projects">
                <Button size="sm" type="button" variant="secondary">
                  {isZh ? "隐藏已归档" : "Hide archived"}
                </Button>
              </Link>
            ) : props.archivedProjectCount > 0 ? (
              <Link href="/agent/projects?archived=1">
                <Button size="sm" type="button" variant="secondary">
                  {isZh ? `显示 ${props.archivedProjectCount} 个已归档` : `Show ${props.archivedProjectCount} archived`}
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
                        {canDeleteProject
                          ? isZh
                            ? "删除"
                            : "Delete"
                          : project.status === "archived"
                            ? isZh
                              ? "取消归档"
                              : "Unarchive"
                            : isZh
                              ? "归档"
                              : "Archive"}
                      </Button>
                    ) : null
                  }
                  badgeLabel={translateFrontOfficeLabel(project.status, isZh)}
                  badgeTone={project.status === "active" ? "accent" : "neutral"}
                  key={project.id}
                  meta={
                    <>
                      <span>{formatFrontOfficeCount(project.sessionCount, isZh, "session", "sessions", "个会话")}</span>
                      <span>{formatFrontOfficeCount(project.archivedDocumentCount, isZh, "archived doc", "archived docs", "份归档文件")}</span>
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
