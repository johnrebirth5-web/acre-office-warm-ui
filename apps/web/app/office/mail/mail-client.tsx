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
      return "Unread";
    case "archived":
      return "Archived";
    default:
      return "Inbox";
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
          throw new Error(body?.error ?? "Could not load mail recipients.");
        }

        const body = (await response.json()) as { recipients?: OfficeMailRecipientOption[] };

        if (isActive) {
          setRecipients(body.recipients ?? []);
          setRecipientLoadError("");
        }
      } catch (loadError) {
        if (isActive) {
          setRecipientLoadError(loadError instanceof Error ? loadError.message : "Could not load mail recipients.");
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
        throw new Error(body?.error ?? "Could not create the mail thread.");
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
      setError(composeError instanceof Error ? composeError.message : "Could not create the mail thread.");
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
        throw new Error(body?.error ?? "Could not send the reply.");
      }

      setReplyBody("");
      setReplyFiles([]);
      setReplyFileInputNonce((value) => value + 1);
      router.refresh();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Could not send the reply.");
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
        throw new Error(body?.error ?? "Could not update the mail thread.");
      }

      router.refresh();
    } catch (threadError) {
      setError(threadError instanceof Error ? threadError.message : "Could not update the mail thread.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <section className="office-mail-summary-grid">
        <StatCard hint="Threads with unread messages that are still in your inbox." label="Unread" value={snapshot.summary.unreadCount} />
        <StatCard hint="Visible active threads before archive filtering." label="Active threads" value={snapshot.summary.activeCount} />
        <StatCard hint="Private archived threads for the current mailbox view." label="Archived" value={snapshot.summary.archivedCount} />
        <StatCard hint={`Attachments counted in the current ${getMailViewLabel(snapshot.filters.view).toLowerCase()} view.`} label="Attachments in view" value={snapshot.summary.attachmentsInView} />
      </section>

      <section className="office-mail-toolbar-row">
        <SectionCard
          className="office-list-card office-mail-toolbar-card"
          subtitle="Search by subject, participant names, and recent message context."
          title="Mailbox controls"
        >
          <FilterBar as="form" className="office-mail-filter-grid office-list-filters" method="get">
            <input name="mode" type="hidden" value={snapshot.mode} />
            <FilterField label="Search">
              <TextInput defaultValue={snapshot.filters.q} name="q" placeholder="Subject, people, latest preview..." />
            </FilterField>

            <FilterField label="View">
              <SelectInput defaultValue={snapshot.filters.view} name="view">
                <option value="all">Inbox</option>
                <option value="unread">Unread</option>
                <option value="archived">Archived</option>
              </SelectInput>
            </FilterField>

            <div className="office-mail-filter-actions">
              <Button type="submit">Apply</Button>
              <Link className="office-button-secondary" href={buildMailHref({ pathname, mode: snapshot.mode })}>
                Reset
              </Link>
              {snapshot.canAudit ? (
                <div className="office-mail-mode-toggle" role="tablist" aria-label="Mail mode">
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "mine" ? " is-active" : ""}`}
                    href={modeToggleLinks.mine}
                  >
                    My mail
                  </Link>
                  <Link
                    className={`office-button-secondary office-mail-mode-button${snapshot.mode === "audit" ? " is-active" : ""}`}
                    href={modeToggleLinks.audit}
                  >
                    Audit view
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
                  {isComposeOpen ? "Close compose" : "Compose"}
                </Button>
              }
              subtitle="Recipients must be active Back Office members in the same organization."
              title="New message"
            >
              {isComposeOpen ? (
                <form className="office-mail-compose-form" onSubmit={handleComposeSubmit}>
                  <div className="office-form-grid office-form-grid-2">
                    <FormField className="office-mail-compose-field-wide" label="Subject">
                      <TextInput
                        onChange={(event) => setComposeState((current) => ({ ...current, subject: event.target.value }))}
                        required
                        value={composeState.subject}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper="Hold Command/Ctrl to select more than one recipient." label="Recipients">
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

                    <FormField className="office-mail-compose-field-wide" label="Message">
                      <TextareaInput
                        onChange={(event) => setComposeState((current) => ({ ...current, body: event.target.value }))}
                        placeholder="Write the opening message for this thread..."
                        rows={6}
                        value={composeState.body}
                      />
                    </FormField>

                    <FormField className="office-mail-compose-field-wide" helper="Single file 10 MB max, 25 MB total per message." label="Attachments">
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
                      {pendingAction === "compose" ? "Sending..." : "Send message"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="office-form-helper">Start a thread with one or more teammates and keep the full conversation inside Back Office.</p>
              )}
            </SectionCard>
          ) : null}

          <SectionCard
            className="office-list-card office-mail-thread-list-card"
            subtitle={`${snapshot.summary.threadsInView} threads in the current view`}
            title={snapshot.mode === "audit" ? "Organization mail threads" : "Inbox threads"}
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
                        badgeLabel={thread.isUnread ? "Unread" : thread.isArchived ? "Archived" : "Open"}
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
                            <span>{thread.messageCount} messages</span>
                            <span>{thread.participantCount} participants</span>
                            {thread.hasAttachments ? <span>{thread.attachmentCount} attachments</span> : null}
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
                      Compose first message
                    </Button>
                  ) : undefined
                }
                description={
                  snapshot.mode === "audit"
                    ? "No internal mail threads match the current audit filters."
                    : "No internal mail threads match the current inbox filters."
                }
                title="Nothing in this mailbox view"
              />
            )}
          </SectionCard>
        </div>

        <div className="office-mail-detail-column">
          {selectedThread ? (
            <SectionCard
              className="office-list-card office-mail-detail-card"
              subtitle={selectedThread.auditedByAdmin ? "Audit mode is read-only and bypasses participant membership checks." : "Thread participants are fixed after creation in v1."}
              title={selectedThread.subject}
            >
              <div className="office-mail-detail-head">
                <div className="office-mail-detail-meta">
                  <StatusBadge tone={selectedThread.isUnread ? "accent" : "neutral"}>
                    {selectedThread.isUnread ? "Unread" : "Read"}
                  </StatusBadge>
                  <StatusBadge tone={selectedThread.isArchived ? "warning" : "success"}>
                    {selectedThread.isArchived ? "Archived" : "Inbox"}
                  </StatusBadge>
                  {selectedThread.auditedByAdmin ? <Badge tone="warning">Audit view</Badge> : null}
                  <span>{selectedThread.latestMessageAtLabel}</span>
                  <span>{selectedThread.attachmentCount} attachments</span>
                </div>

                {snapshot.mode === "mine" ? (
                  <div className="office-mail-detail-actions">
                    <Button
                      disabled={pendingAction === "mark_unread" || pendingAction === "mark_read"}
                      onClick={() => handleThreadAction(selectedThread.isUnread ? "mark_read" : "mark_unread")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isUnread ? "Mark read" : "Mark unread"}
                    </Button>
                    <Button
                      disabled={pendingAction === "archive" || pendingAction === "unarchive"}
                      onClick={() => handleThreadAction(selectedThread.isArchived ? "unarchive" : "archive")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {selectedThread.isArchived ? "Unarchive" : "Archive"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="office-mail-participant-strip">
                <span className="office-mail-participant-label">Participants</span>
                <div className="office-mail-participant-list">
                  {selectedThread.participants.map((participant) => (
                    <span className="office-mail-participant-pill" key={participant.membershipId}>
                      <strong>{participant.fullName}</strong>
                      <span>{participant.title || participant.roleLabel}</span>
                      <span>{participant.officeName}</span>
                    </span>
                  ))}
                </div>
                <p className="office-form-helper">Organization scope: {scopeLabel}</p>
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

                    <p className="office-mail-message-body">{message.body || "Attachment only message"}</p>

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
                      <strong>Reply to thread</strong>
                      <p>Replies go to every participant already on the thread.</p>
                    </div>
                    <Badge tone="neutral">Reply-all</Badge>
                  </div>

                  <FormField label="Message">
                    <TextareaInput
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Write your reply..."
                      rows={5}
                      value={replyBody}
                    />
                  </FormField>

                  <FormField helper="Single file 10 MB max, 25 MB total per reply." label="Attachments">
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
                      {pendingAction === "reply" ? "Sending..." : "Send reply"}
                    </Button>
                  </div>
                </form>
              ) : selectedThread.auditedByAdmin ? (
                <div className="office-mail-audit-note">
                  <Badge tone="warning">Audit view</Badge>
                  <p>Replies are disabled while you are reviewing organization mail in audit mode.</p>
                </div>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard className="office-list-card office-mail-detail-card" title="Thread detail">
              <EmptyState
                description="Select a thread from the left column, or start a new one if your mailbox is empty."
                title="No thread selected"
              />
            </SectionCard>
          )}
        </div>
      </section>
    </>
  );
}
