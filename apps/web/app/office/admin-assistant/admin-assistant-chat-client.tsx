"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  content: string;
  id: string;
  role: ChatRole;
};

type ImageAttachment = {
  content: string;
  dataUrl: string;
  fileName: string;
  id: string;
  mimeType: string;
  size: number;
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    content:
      "我可以回答 Acre Back Office 的页面用途、登单入口、功能是否已开发、测试时报错该怎么初筛，以及怎么整理给程序员的 bug 报告。你也可以把截图拖进来一起问。",
    id: "welcome",
    role: "assistant",
  },
];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("Unable to read image.")));
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.readAsDataURL(file);
  });
}

function stripDataUrlContent(dataUrl: string) {
  const match = /^data:[^;]+;base64,([\s\S]+)$/i.exec(dataUrl);
  return match?.[1] ?? dataUrl;
}

function formatSize(size: number) {
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

export function AdminAssistantChatClient() {
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : createId("session"),
  );
  const hasAttachments = attachments.length > 0;
  const canSend = input.trim().length > 0 && !isSending;
  const currentPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/office/admin-assistant";
    }

    return `${window.location.pathname}${window.location.search}`;
  }, []);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));

    if (incoming.length === 0) {
      setError("只能上传截图或图片。");
      return;
    }

    const openSlots = MAX_ATTACHMENTS - attachments.length;

    if (openSlots <= 0) {
      setError(`最多只能附加 ${MAX_ATTACHMENTS} 张截图。`);
      return;
    }

    const accepted = incoming.slice(0, openSlots);
    const nextAttachments: ImageAttachment[] = [];

    for (const file of accepted) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} 太大，请把单张截图控制在 ${formatSize(MAX_ATTACHMENT_BYTES)} 以内。`);
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);
      nextAttachments.push({
        content: stripDataUrlContent(dataUrl),
        dataUrl,
        fileName: file.name,
        id: createId("image"),
        mimeType: file.type || "image/png",
        size: file.size,
      });
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments].slice(0, MAX_ATTACHMENTS));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();

    if (!trimmed || isSending) {
      return;
    }

    const history = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-8)
      .map((message) => ({
        content: message.content,
        role: message.role,
      }));
    const outgoingAttachments = attachments.map((attachment) => ({
      content: attachment.content,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    }));
    const userMessage: ChatMessage = {
      content: trimmed,
      id: createId("user"),
      role: "user",
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAttachments([]);
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/admin-gpt/chat", {
        body: JSON.stringify({
          attachments: outgoingAttachments,
          currentPath,
          history,
          message: trimmed,
          sessionId,
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; reply?: string }
        | null;

      const reply = payload?.reply;

      if (!response.ok || typeof reply !== "string" || !reply.trim()) {
        throw new Error(payload?.error || "管理员助手暂时不可用，请稍后重试。");
      }

      setMessages((current) => [
        ...current,
        {
          content: reply,
          id: createId("assistant"),
          role: "assistant",
        },
      ]);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "管理员助手暂时不可用，请稍后重试。";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          content: message,
          id: createId("assistant-error"),
          role: "assistant",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className={`office-admin-gpt-chatbox${isDragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) {
          setIsDragging(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void addFiles(event.dataTransfer.files);
      }}
    >
      <div aria-live="polite" className="office-admin-gpt-thread">
        {messages.map((message) => (
          <article
            className={`office-admin-gpt-message office-admin-gpt-message-${message.role}`}
            key={message.id}
          >
            <span>{message.role === "user" ? "You" : "Acre Admin Assistant"}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {isSending ? (
          <div className="office-admin-gpt-typing">Acre 管理员助手正在思考...</div>
        ) : null}
      </div>

      {error ? <div className="office-admin-gpt-error">{error}</div> : null}

      <form className="office-admin-gpt-composer" onSubmit={handleSubmit}>
        {hasAttachments ? (
          <div className="office-admin-gpt-attachment-row">
            {attachments.map((attachment) => (
              <div className="office-admin-gpt-attachment" key={attachment.id}>
                <img alt="" src={attachment.dataUrl} />
                <div>
                  <strong>{attachment.fileName}</strong>
                  <span>{formatSize(attachment.size)}</span>
                </div>
                <button
                  aria-label={`Remove ${attachment.fileName}`}
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id),
                    )
                  }
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          className="office-admin-gpt-textarea"
          disabled={isSending}
          onChange={(event) => setInput(event.target.value)}
          placeholder="问 Acre 页面怎么用、功能有没有、测试报错怎么判断；也可以拖拽截图进来。"
          rows={3}
          value={input}
        />

        <div className="office-admin-gpt-actions">
          <input
            accept="image/*"
            className="office-admin-gpt-file-input"
            multiple
            onChange={(event) => {
              if (event.target.files) {
                void addFiles(event.target.files);
              }
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="office-button"
            disabled={isSending || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Add screenshot
          </button>
          <span className="office-admin-gpt-drop-hint">
            只读助手，不改代码、不改数据库、不部署
          </span>
          <button className="office-button office-button-primary" disabled={!canSend} type="submit">
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
