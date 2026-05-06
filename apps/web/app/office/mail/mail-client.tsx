"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FilterBar,
  FilterField,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeMailRecipientOption, OfficeMailWorkspaceSnapshot } from "@acre/db";
import { useI18n } from "../../../lib/i18n/client";

type OfficeMailClientProps = {
  snapshot: OfficeMailWorkspaceSnapshot;
  scopeLabel: string;
};

type ComposeState = {
  subject: string;
  body: string;
  recipientMembershipIds: string[];
};

function buildComposeState(): ComposeState {
  return {
    subject: "",
    body: "",
    recipientMembershipIds: []
  };
}

function getMailViewLabel(view: OfficeMailWorkspaceSnapshot["filters"]["view"], isZh: boolean) {
  switch (view) {
    case "unread":
      return isZh ? "未读" : "unread";
    case "archived":
      return isZh ? "已归档" : "archived";
    default:
      return isZh ? "收件箱" : "inbox";
  }
}

function buildMailHref(input: {
  pathname: string;
  q?: string;
  view?: string;
  mode?: string;
  threadId?: string;
}) {
  const params = new URLSearchParams();

  if (input.q?.trim()) {
    params.set("q", input.q.trim());
  }

  if (input.view && input.view !== "all") {
    params.set("view", input.view);
  }

  if (input.mode && input.mode !== "mine") {
    params.set("mode", input.mode);
  }

  if (input.threadId?.trim()) {
    params.set("threadId", input.threadId.trim());
  }

  const query = params.toString();
  return query ? `${input.pathname}?${query}` : input.pathname;
}

function getMultiSelectValues(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function notifyMailUnreadChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("office-mail-unread-changed"));
}

export function OfficeMailClient({ snapshot, scopeLabel }: OfficeMailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeState, setComposeState] = useState<ComposeState>(buildComposeState);
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [recipients, setRecipients] = useState<OfficeMailRecipientOption[]>([]);
  const [recipientLoadError, setRecipientLoadError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fileInputNonce, setFileInputNonce] = useState(0);
  const [replyFileInputNonce, setReplyFileInputNonce] = useState(0);

  const selectedThread = snapshot.selectedThread;
  const selectedThreadId = snapshot.filters.selectedThreadId;
  const canCompose = snapshot.canSend && snapshot.mode === "mine";
  const modeToggleLinks = useMemo(
    () => ({
      mine: buildMailHref({
        pathname,
        q: snapshot.filters.q,
        view: snapshot.filters.view,
        mode: "mine",
        threadId: snapshot.filters.selectedThreadId
      }),
      audit: buildMailHref({
        pathname,
        q: snapshot.filters.q,
        view: snapshot.filters.view,
        mode: "audit",
        threadId: snapshot.filters.selectedThreadId
      })
    }),
    [pathname, snapshot.filters.q, snapshot.filters.selectedThreadId, snapshot.filters.view]
  );

  useEffect(() => {
    setComposeState(buildComposeState());
    setComposeFiles([]);
    setReplyBody("");
    setReplyFiles([]);
    setError("");
    setPendingAction(null);
  }, [snapshot.filters.selectedThreadId, snapshot.filters.view, snapshot.mode]);

  useEffect(() => {
    if (!snapshot.canSend) {
      return;
    }

    let isActive = true;

    async function loadRecipients() {
      try {
        const response = await fetch("/api/office/mail/recipients");

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? (isZh ? "无法加载站内信收件人。" : "Failed to load mail recipients."));
        }

        const body = (await response.json()) as { recipients?: OfficeMailRecipientOption[] };

        if (isActive) {
          setRecipients(body.recipients ?? []);
          setRecipientLoadError("");
        }
      } catch (loadError) {
        if (isActive) {
          setRecipientLoadError(loadError instanceof Error ? loadError.message : isZh ? "无法加载站内信收件人。" : "Failed to load mail recipients.");
        }
      }
    }

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [isZh, snapshot.canSend]);

  async function handleComposeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("compose");
    setError("");

    try {
      const formData = new FormData();
      formData.set("subject", composeState.subject);
      formData.set("body", composeState.body);

      for (const membershipId of composeState.recipientMembershipIds) {
        formData.append("recipientMembershipId", membershipId);
      }

      for (const file of composeFiles) {
        formData.append("attachments", file);
      }

      const response = await fetch("/api/office/mail/threads", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "无法创建站内信线程。" : "Failed to create mail thread."));
      }

      const body = (await response.json()) as { thread?: { id: string } };
      setComposeState(buildComposeState());
      setComposeFiles([]);
      setIsComposeOpen(false);
      setFileInputNonce((value) => value + 1);

      router.push(
        buildMailHref({
          pathname,
          mode: "mine",
          view: "all",
          threadId: body.thread?.id ?? ""
        })
      );
      router.refresh();
    } catch (composeError) {
      setError(composeError instanceof Error ? composeError.message : isZh ? "无法创建站内信线程。" : "Failed to create mail thread.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedThreadId) {
      return;
    }

    setPendingAction("reply");
    setError("");

    try {
      const formData = new FormData();
      formData.set("body", replyBody);

      for (const file of replyFiles) {
        formData.append("attachments", file);
      }

      const response = await fetch(`/api/office/mail/threads/${selectedThreadId}/messages`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "无法发送回复。" : "Failed to send reply."));
      }

      setReplyBody("");
      setReplyFiles([]);
      setReplyFileInputNonce((value) => value + 1);
      router.refresh();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : isZh ? "无法发送回复。" : "Failed to send reply.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleThreadAction(action: "mark_read" | "mark_unread" | "archive" | "unarchive") {
    if (!selectedThreadId) {
      return;
    }

    setPendingAction(action);
    setError("");

    try {
      const response = await fetch(`/api/office/mail/threads/${selectedThreadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? (isZh ? "无法更新站内信线程。" : "Failed to update mail thread."));
      }

      notifyMailUnreadChanged();
      router.refresh();
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : isZh ? "无法更新站内信线程。" : "Failed to update mail thread.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-mail-summary-grid">
        <StatCard hint={isZh ? "仍在收件箱里的未读线程。" : "Unread threads still in the inbox."} label={isZh ? "未读" : "Unread"} value={snapshot.summary.unreadCount} />
        <StatCard hint={isZh ? "归档筛选前的可见活动线程。" : "Visible active threads before archive filtering."} label={isZh ? "活动线程" : "Active threads"} value={snapshot.summary.activeCount} />
        <StatCard hint={isZh ? "当前邮箱视图里的个人归档线程。" : "Personal archived threads in the current mail view."} label={isZh ? "已归档" : "Archived"} value={snapshot.summary.archivedCount} />
        <StatCard hint={isZh ? `当前${getMailViewLabel(snapshot.filters.view, isZh)}视图中统计到的附件。` : `Attachments counted in the current ${getMailViewLabel(snapshot.filters.view, isZh)} view.`} label={isZh ? "当前附件" : "Current attachments"} value={snapshot.summary.attachmentsInView} />
      </section>

      <section className="office-mail-toolbar-row">
        <SectionCard
          className="office-list-card office-mail-toolbar-card"
          subtitle={isZh ? "按主题、参与人姓名和最近消息内容搜索。" : "Search by subject, participant name, and recent message content."}
          title={isZh ? "邮箱控制" : "Mail controls"}
        >
          <FilterBar as="form" className="office-mail-filter-grid office-list-filters" method="get">
            <input name="mode" type="hidden" value={snapshot.mode} />
            <FilterField label={isZh ? "搜索" : "Search"}>
              <TextInput defaultValue={snapshot.filters.q} name="q" placeholder={isZh ? "主题、人员、最近预览..." : "Subject, people, recent preview..."} />
            </FilterField>

            <FilterField label={isZh ? "视图" : "View"}>
              <SelectInput defaultValue={snapshot.filters.view} name="view">
                <option value="all">{isZh ? "收件箱" : "Inbox"}</option>
                <option value="unread">{isZh ? "未读" : "Unread"}</option>
                <option value="archived">{isZh ? "已归档" : "Archived"}</option>
              </SelectInput>
            </FilterField>

            <div className="office-mail-filter-actions">
              <Button type="submit">{isZh ? "应用" : "Apply"}</Button>
              <Link className="office-button-secondary" href={buildMailHref({ pathname, mode: snapshot.mode })}>
                {isZh ? "重置" : "Reset"}
              </Link>
              {snapshot.canAudit ? (
                <div className="office-mail-mode-toggle" role="tablist" aria-label={isZh ? "站内信模式" : "Mail mode"}>
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "mine" ? " is-active" : ""}`}
                    href={modeToggleLinks.mine}
                  >
                    {isZh ? "我的站内信" : "My mail"}
                  </Link>
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "audit" ? " is-active" : ""}`}
                    href={modeToggleLinks.audit}
                  >
                    {isZh ? "审计视图" : "Audit view"}
                  </Link>
                </div>
              ) : null}
            </div>
          </FilterBar>
        </SectionCard>
      </section>

      {error ? <p className="office-form-error">{error}</p> : null}

      <section className="office-mail-layout">
        <div className="office-mail-thread-column">
          {canCompose ? (
            <SectionCard
              className="office-list-card office-mail-compose-card"
              actions={
                <Button onClick={() => setIsComposeOpen((current) => !current)} size="sm" type="button" variant="secondary">
                  {isComposeOpen ? (isZh ? "关闭撰写" : "Close compose") : isZh ? "撰写" : "Compose"}
                </Button>
              }
              subtitle={isZh ? "收件人必须是同一组织内启用的后台成员。" : "Recipients must be active Back Office members in the same organization."}
              title={isZh ? "新消息" : "New message"}
            >
              {isComposeOpen ? (
                <form className="office-mail-compose-form" onSubmit={handleComposeSubmit}>
                  <div className="office-form-grid office-form-grid-2">
                    <FormField className="office-mail-compose-field-wide" label={isZh ? "主题" : "Subject"}>
                      <TextInput
                        onChange={(event) => setComposeState((current) => ({ ...current, subject: event.target.value }))}
                        required
                        value={composeState.subject}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper={isZh ? "按住 Command/Ctrl 可选择多个收件人。" : "Hold Command/Ctrl to choose multiple recipients."} label={isZh ? "收件人" : "Recipients"}>
                      <SelectInput
                        multiple
                        onChange={(event) =>
                          setComposeState((current) => ({
                            ...current,
                            recipientMembershipIds: getMultiSelectValues(event)
                          }))
                        }
                        required
                        size={Math.min(Math.max(recipients.length, 4), 8)}
                        value={composeState.recipientMembershipIds}
                      >
                        {recipients.map((recipient) => (
                          <option key={recipient.membershipId} value={recipient.membershipId}>
                            {recipient.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" label={isZh ? "消息" : "Message"}>
                      <TextareaInput
                        onChange={(event) => setComposeState((current) => ({ ...current, body: event.target.value }))}
                        placeholder={isZh ? "写下这个线程的第一条消息..." : "Write the first message in this thread..."}
                        rows={6}
                        value={composeState.body}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper={isZh ? "单个文件最多 10 MB，每条消息合计最多 25 MB。" : "Each file can be up to 10 MB, with 25 MB total per message."} label={isZh ? "附件" : "Attachments"}>
                      <TextInput
                        className="office-file-input"
                        key={fileInputNonce}
                        multiple
                        onChange={(event) => setComposeFiles(Array.from(event.target.files ?? []))}
                        type="file"
                      />
                    </FormField>
                  </div>

                  {recipientLoadError ? <p className="office-form-error">{recipientLoadError}</p> : null}

                  <div className="office-mail-compose-actions">
                    <Button disabled={pendingAction === "compose"} type="submit">
                      {pendingAction === "compose" ? (isZh ? "发送中..." : "Sending...") : isZh ? "发送消息" : "Send message"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="office-form-helper">{isZh ? "与一位或多位同事开启线程，并把完整对话保留在后台内。" : "Start a thread with one or more teammates and keep the full conversation inside Back Office."}</p>
              )}
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card office-mail-thread-list-card"
            subtitle={isZh ? `当前视图中有 ${snapshot.summary.threadsInView} 个线程` : `${snapshot.summary.threadsInView} threads in the current view`}
            title={snapshot.mode === "audit" ? (isZh ? "组织站内信线程" : "Organization mail threads") : isZh ? "收件箱线程" : "Inbox threads"}
          >
            {snapshot.threads.length ? (
              <div className="office-queue-list office-mail-thread-list">
                {snapshot.threads.map((thread) => {
                  const href = buildMailHref({
                    pathname,
                    q: snapshot.filters.q,
                    view: snapshot.filters.view,
                    mode: snapshot.mode,
                    threadId: thread.id
                  });

                  return (
                    <Link className="office-mail-thread-link" href={href} key={thread.id}>
                      <QueueItem
                        badgeLabel={thread.isUnread ? (isZh ? "未读" : "Unread") : thread.isArchived ? (isZh ? "已归档" : "Archived") : isZh ? "打开" : "Open"}
                        badgeTone={thread.isUnread ? "accent" : thread.isArchived ? "neutral" : "success"}
                        className={`office-mail-thread-item${thread.id === selectedThreadId ? " is-selected" : ""}`}
                        context={`${thread.latestSenderName} · ${thread.latestMessageAtLabel}`}
                        description={
                          <>
                            <span className="office-mail-thread-participants">{thread.participantsLabel}</span>
                            <span className="office-mail-thread-preview">{thread.latestPreview}</span>
                          </>
                        }
                        meta={
                          <>
                            <span>{isZh ? `${thread.messageCount} 条消息` : `${thread.messageCount} ${thread.messageCount === 1 ? "message" : "messages"}`}</span>
                            <span>{isZh ? `${thread.participantCount} 位参与人` : `${thread.participantCount} ${thread.participantCount === 1 ? "participant" : "participants"}`}</span>
                            {thread.hasAttachments ? <span>{isZh ? `${thread.attachmentCount} 个附件` : `${thread.attachmentCount} ${thread.attachmentCount === 1 ? "attachment" : "attachments"}`}</span> : null}
                          </>
                        }
                        title={thread.subject}
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                action={
                  canCompose ? (
                    <Button onClick={() => setIsComposeOpen(true)} type="button">
                      {isZh ? "撰写第一条消息" : "Compose first message"}
                    </Button>
                  ) : undefined
                }
                description={
                  snapshot.mode === "audit"
                    ? isZh ? "当前审计筛选下没有匹配的内部站内信线程。" : "No internal mail threads match the current audit filters."
                    : isZh ? "当前收件箱筛选下没有匹配的内部站内信线程。" : "No internal mail threads match the current inbox filters."
                }
                title={isZh ? "这个邮箱视图里没有内容" : "Nothing in this mail view"}
              />
            )}
          </SectionCard>
        </div>

        <div className="office-mail-detail-column">
          {selectedThread ? (
            <SectionCard
              className="office-list-card office-mail-detail-card"
              subtitle={selectedThread.auditedByAdmin ? (isZh ? "审计模式为只读，会绕过参与人身份检查。" : "Audit mode is read-only and bypasses participant identity checks.") : isZh ? "v1 中线程参与人创建后固定。" : "Thread participants are fixed after creation in v1."}
              title={selectedThread.subject}
            >
              <div className="office-mail-detail-head">
                <div className="office-mail-detail-meta">
                  <StatusBadge tone={selectedThread.isUnread ? "accent" : "neutral"}>
                    {selectedThread.isUnread ? (isZh ? "未读" : "Unread") : isZh ? "已读" : "Read"}
                  </StatusBadge>
                  <StatusBadge tone={selectedThread.isArchived ? "warning" : "success"}>
                    {selectedThread.isArchived ? (isZh ? "已归档" : "Archived") : isZh ? "收件箱" : "Inbox"}
                  </StatusBadge>
                  {selectedThread.auditedByAdmin ? <Badge tone="warning">{isZh ? "审计视图" : "Audit view"}</Badge> : null}
                  <span>{selectedThread.latestMessageAtLabel}</span>
                  <span>{isZh ? `${selectedThread.attachmentCount} 个附件` : `${selectedThread.attachmentCount} ${selectedThread.attachmentCount === 1 ? "attachment" : "attachments"}`}</span>
                </div>

                {snapshot.mode === "mine" ? (
                  <div className="office-mail-detail-actions">
                    {selectedThread.actionUrl ? (
                      <Link className="office-button-secondary office-button-sm" href={selectedThread.actionUrl}>
                        {selectedThread.actionLabel || (isZh ? "打开" : "Open")}
                      </Link>
                    ) : null}
                    <Button
                      disabled={pendingAction === "mark_unread" || pendingAction === "mark_read"}
                      onClick={() => handleThreadAction(selectedThread.isUnread ? "mark_read" : "mark_unread")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isUnread ? (isZh ? "标记已读" : "Mark read") : isZh ? "标记未读" : "Mark unread"}
                    </Button>
                    <Button
                      disabled={pendingAction === "archive" || pendingAction === "unarchive"}
                      onClick={() => handleThreadAction(selectedThread.isArchived ? "unarchive" : "archive")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isArchived ? (isZh ? "取消归档" : "Unarchive") : isZh ? "归档" : "Archive"}
                    </Button>
                  </div>
                ) : selectedThread.actionUrl ? (
                  <div className="office-mail-detail-actions">
                    <Link className="office-button-secondary office-button-sm" href={selectedThread.actionUrl}>
                      {selectedThread.actionLabel || (isZh ? "打开" : "Open")}
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="office-mail-participant-strip">
                <span className="office-mail-participant-label">{isZh ? "参与人" : "Participants"}</span>
                <div className="office-mail-participant-list">
                  {selectedThread.participants.map((participant) => (
                    <span className="office-mail-participant-pill" key={participant.membershipId}>
                      <strong>{participant.fullName}</strong>
                      <span>{participant.title || participant.roleLabel}</span>
                      <span>{participant.officeName}</span>
                    </span>
                  ))}
                </div>
                <p className="office-form-helper">{isZh ? "组织范围：" : "Organization scope: "}{scopeLabel}</p>
              </div>

              <div className="office-mail-message-list">
                {selectedThread.messages.map((message) => (
                  <article className={`office-mail-message${message.isSelf ? " is-self" : ""}`} key={message.id}>
                    <header className="office-mail-message-head">
                      <div>
                        <strong>{message.senderName}</strong>
                        <span>{message.senderRoleLabel}</span>
                      </div>
                      <span>{message.createdAtLabel}</span>
                    </header>

                    <p className="office-mail-message-body">{message.body || (isZh ? "仅附件消息" : "Attachment-only message")}</p>

                    {message.attachments.length ? (
                      <div className="office-mail-attachment-list">
                        {message.attachments.map((attachment) => (
                          <a className="office-mail-attachment-link" href={attachment.downloadHref} key={attachment.id}>
                            <span>{attachment.fileName}</span>
                            <span>{attachment.fileSizeLabel}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {selectedThread.canReply ? (
                <form className="office-mail-reply-form" onSubmit={handleReplySubmit}>
                  <div className="office-mail-reply-head">
                    <div>
                      <strong>{isZh ? "回复线程" : "Reply to thread"}</strong>
                      <p>{isZh ? "回复会发送给这个线程中已有的所有参与人。" : "Replies go to all existing participants in this thread."}</p>
                    </div>
                    <Badge tone="neutral">{isZh ? "回复全部" : "Reply all"}</Badge>
                  </div>

                  <FormField label={isZh ? "消息" : "Message"}>
                    <TextareaInput
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder={isZh ? "写下你的回复..." : "Write your reply..."}
                      rows={5}
                      value={replyBody}
                    />
                  </FormField>

                  <FormField helper={isZh ? "单个文件最多 10 MB，每条回复合计最多 25 MB。" : "Each file can be up to 10 MB, with 25 MB total per reply."} label={isZh ? "附件" : "Attachments"}>
                    <TextInput
                      className="office-file-input"
                      key={replyFileInputNonce}
                      multiple
                      onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                      type="file"
                    />
                  </FormField>

                  <div className="office-mail-compose-actions">
                    <Button disabled={pendingAction === "reply"} type="submit">
                      {pendingAction === "reply" ? (isZh ? "发送中..." : "Sending...") : isZh ? "发送回复" : "Send reply"}
                    </Button>
                  </div>
                </form>
              ) : selectedThread.auditedByAdmin ? (
                <div className="office-mail-audit-note">
                  <Badge tone="warning">{isZh ? "审计视图" : "Audit view"}</Badge>
                  <p>{isZh ? "在审计模式查看组织站内信时，回复功能会被停用。" : "Replies are disabled when viewing organization mail in audit mode."}</p>
                </div>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard className="office-list-card office-mail-detail-card" title={isZh ? "线程详情" : "Thread detail"}>
              <EmptyState
                description={isZh ? "从左侧选择一个线程；如果邮箱为空，也可以新建一个线程。" : "Select a thread from the left, or create a new one if the inbox is empty."}
                title={isZh ? "尚未选择线程" : "No thread selected"}
              />
            </SectionCard>
          )}
        </div>
      </section>
    </>
  );
}
