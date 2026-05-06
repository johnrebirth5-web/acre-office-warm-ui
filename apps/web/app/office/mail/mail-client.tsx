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

function getMailViewLabel(view: OfficeMailWorkspaceSnapshot["filters"]["view"]) {
  switch (view) {
    case "unread":
      return "未读";
    case "archived":
      return "已归档";
    default:
      return "收件箱";
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
          throw new Error(body?.error ?? "无法加载站内信收件人。");
        }

        const body = (await response.json()) as { recipients?: OfficeMailRecipientOption[] };

        if (isActive) {
          setRecipients(body.recipients ?? []);
          setRecipientLoadError("");
        }
      } catch (loadError) {
        if (isActive) {
          setRecipientLoadError(loadError instanceof Error ? loadError.message : "无法加载站内信收件人。");
        }
      }
    }

    void loadRecipients();

    return () => {
      isActive = false;
    };
  }, [snapshot.canSend]);

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
        throw new Error(body?.error ?? "无法创建站内信线程。");
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
      setError(composeError instanceof Error ? composeError.message : "无法创建站内信线程。");
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
        throw new Error(body?.error ?? "无法发送回复。");
      }

      setReplyBody("");
      setReplyFiles([]);
      setReplyFileInputNonce((value) => value + 1);
      router.refresh();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "无法发送回复。");
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
        throw new Error(body?.error ?? "无法更新站内信线程。");
      }

      notifyMailUnreadChanged();
      router.refresh();
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "无法更新站内信线程。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-mail-summary-grid">
        <StatCard hint="仍在收件箱里的未读线程。" label="未读" value={snapshot.summary.unreadCount} />
        <StatCard hint="归档筛选前的可见活动线程。" label="活动线程" value={snapshot.summary.activeCount} />
        <StatCard hint="当前邮箱视图里的个人归档线程。" label="已归档" value={snapshot.summary.archivedCount} />
        <StatCard hint={`当前${getMailViewLabel(snapshot.filters.view)}视图中统计到的附件。`} label="当前附件" value={snapshot.summary.attachmentsInView} />
      </section>

      <section className="office-mail-toolbar-row">
        <SectionCard
          className="office-list-card office-mail-toolbar-card"
          subtitle="按主题、参与人姓名和最近消息内容搜索。"
          title="邮箱控制"
        >
          <FilterBar as="form" className="office-mail-filter-grid office-list-filters" method="get">
            <input name="mode" type="hidden" value={snapshot.mode} />
            <FilterField label="搜索">
              <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="主题、人员、最近预览..." />
            </FilterField>

            <FilterField label="视图">
              <SelectInput defaultValue={snapshot.filters.view} name="view">
                <option value="all">收件箱</option>
                <option value="unread">未读</option>
                <option value="archived">已归档</option>
              </SelectInput>
            </FilterField>

            <div className="office-mail-filter-actions">
              <Button type="submit">应用</Button>
              <Link className="office-button-secondary" href={buildMailHref({ pathname, mode: snapshot.mode })}>
                重置
              </Link>
              {snapshot.canAudit ? (
                <div className="office-mail-mode-toggle" role="tablist" aria-label="站内信模式">
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "mine" ? " is-active" : ""}`}
                    href={modeToggleLinks.mine}
                  >
                    我的站内信
                  </Link>
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "audit" ? " is-active" : ""}`}
                    href={modeToggleLinks.audit}
                  >
                    审计视图
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
                  {isComposeOpen ? "关闭撰写" : "撰写"}
                </Button>
              }
              subtitle="收件人必须是同一组织内启用的后台成员。"
              title="新消息"
            >
              {isComposeOpen ? (
                <form className="office-mail-compose-form" onSubmit={handleComposeSubmit}>
                  <div className="office-form-grid office-form-grid-2">
                    <FormField className="office-mail-compose-field-wide" label="主题">
                      <TextInput
                        onChange={(event) => setComposeState((current) => ({ ...current, subject: event.target.value }))}
                        required
                        value={composeState.subject}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper="按住 Command/Ctrl 可选择多个收件人。" label="收件人">
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

                    <FormField className="office-mail-compose-field-wide" label="消息">
                      <TextareaInput
                        onChange={(event) => setComposeState((current) => ({ ...current, body: event.target.value }))}
                        placeholder="写下这个线程的第一条消息..."
                        rows={6}
                        value={composeState.body}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper="单个文件最多 10 MB，每条消息合计最多 25 MB。" label="附件">
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
                      {pendingAction === "compose" ? "发送中..." : "发送消息"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="office-form-helper">与一位或多位同事开启线程，并把完整对话保留在后台内。</p>
              )}
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card office-mail-thread-list-card"
            subtitle={`当前视图中有 ${snapshot.summary.threadsInView} 个线程`}
            title={snapshot.mode === "audit" ? "组织站内信线程" : "收件箱线程"}
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
                        badgeLabel={thread.isUnread ? "未读" : thread.isArchived ? "已归档" : "打开"}
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
                            <span>{thread.messageCount} 条消息</span>
                            <span>{thread.participantCount} 位参与人</span>
                            {thread.hasAttachments ? <span>{thread.attachmentCount} 个附件</span> : null}
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
                      撰写第一条消息
                    </Button>
                  ) : undefined
                }
                description={
                  snapshot.mode === "audit"
                    ? "当前审计筛选下没有匹配的内部站内信线程。"
                    : "当前收件箱筛选下没有匹配的内部站内信线程。"
                }
                title="这个邮箱视图里没有内容"
              />
            )}
          </SectionCard>
        </div>

        <div className="office-mail-detail-column">
          {selectedThread ? (
            <SectionCard
              className="office-list-card office-mail-detail-card"
              subtitle={selectedThread.auditedByAdmin ? "审计模式为只读，会绕过参与人身份检查。" : "v1 中线程参与人创建后固定。"}
              title={selectedThread.subject}
            >
              <div className="office-mail-detail-head">
                <div className="office-mail-detail-meta">
                  <StatusBadge tone={selectedThread.isUnread ? "accent" : "neutral"}>
                    {selectedThread.isUnread ? "未读" : "已读"}
                  </StatusBadge>
                  <StatusBadge tone={selectedThread.isArchived ? "warning" : "success"}>
                    {selectedThread.isArchived ? "已归档" : "收件箱"}
                  </StatusBadge>
                  {selectedThread.auditedByAdmin ? <Badge tone="warning">审计视图</Badge> : null}
                  <span>{selectedThread.latestMessageAtLabel}</span>
                  <span>{selectedThread.attachmentCount} 个附件</span>
                </div>

                {snapshot.mode === "mine" ? (
                  <div className="office-mail-detail-actions">
                    {selectedThread.actionUrl ? (
                      <Link className="office-button-secondary office-button-sm" href={selectedThread.actionUrl}>
                        {selectedThread.actionLabel || "打开"}
                      </Link>
                    ) : null}
                    <Button
                      disabled={pendingAction === "mark_unread" || pendingAction === "mark_read"}
                      onClick={() => handleThreadAction(selectedThread.isUnread ? "mark_read" : "mark_unread")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isUnread ? "标记已读" : "标记未读"}
                    </Button>
                    <Button
                      disabled={pendingAction === "archive" || pendingAction === "unarchive"}
                      onClick={() => handleThreadAction(selectedThread.isArchived ? "unarchive" : "archive")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isArchived ? "取消归档" : "归档"}
                    </Button>
                  </div>
                ) : selectedThread.actionUrl ? (
                  <div className="office-mail-detail-actions">
                    <Link className="office-button-secondary office-button-sm" href={selectedThread.actionUrl}>
                      {selectedThread.actionLabel || "打开"}
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="office-mail-participant-strip">
                <span className="office-mail-participant-label">参与人</span>
                <div className="office-mail-participant-list">
                  {selectedThread.participants.map((participant) => (
                    <span className="office-mail-participant-pill" key={participant.membershipId}>
                      <strong>{participant.fullName}</strong>
                      <span>{participant.title || participant.roleLabel}</span>
                      <span>{participant.officeName}</span>
                    </span>
                  ))}
                </div>
                <p className="office-form-helper">组织范围：{scopeLabel}</p>
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

                    <p className="office-mail-message-body">{message.body || "仅附件消息"}</p>

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
                      <strong>回复线程</strong>
                      <p>回复会发送给这个线程中已有的所有参与人。</p>
                    </div>
                    <Badge tone="neutral">回复全部</Badge>
                  </div>

                  <FormField label="消息">
                    <TextareaInput
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="写下你的回复..."
                      rows={5}
                      value={replyBody}
                    />
                  </FormField>

                  <FormField helper="单个文件最多 10 MB，每条回复合计最多 25 MB。" label="附件">
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
                      {pendingAction === "reply" ? "发送中..." : "发送回复"}
                    </Button>
                  </div>
                </form>
              ) : selectedThread.auditedByAdmin ? (
                <div className="office-mail-audit-note">
                  <Badge tone="warning">审计视图</Badge>
                  <p>在审计模式查看组织站内信时，回复功能会被停用。</p>
                </div>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard className="office-list-card office-mail-detail-card" title="线程详情">
              <EmptyState
                description="从左侧选择一个线程；如果邮箱为空，也可以新建一个线程。"
                title="尚未选择线程"
              />
            </SectionCard>
          )}
        </div>
      </section>
    </>
  );
}
