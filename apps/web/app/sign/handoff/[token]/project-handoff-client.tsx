"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@acre/ui";
import { useI18n } from "../../../../lib/i18n/client";
import {
  ProjectSigningExperience,
  type ProjectSigningDocument,
  type ProjectSigningSubmitValue,
} from "../../_components/project-signing-experience";

type Recipient = {
  id: string;
  name: string;
  status: string;
  routingStep: number;
  documents: ProjectSigningDocument[];
};

function getAssignedFieldCount(recipient: Recipient) {
  return recipient.documents.reduce((count, document) => count + document.fields.length, 0);
}

function getActiveRecipients(recipients: Recipient[]) {
  const pending = recipients.filter((recipient) => recipient.status !== "acted");
  const activeStep = pending.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), pending[0]?.routingStep ?? 0);

  return pending.filter((recipient) => recipient.routingStep === activeStep);
}

function getAutoSelectedRecipientId(recipients: Recipient[]) {
  const activeRecipients = getActiveRecipients(recipients);

  return activeRecipients.length === 1 ? activeRecipients[0]?.id ?? null : null;
}

export function ProjectHandoffClient(props: {
  token: string;
  projectName: string;
  recipients: Recipient[];
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [recipients, setRecipients] = useState(props.recipients);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(() => getAutoSelectedRecipientId(props.recipients));
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const activeRecipients = useMemo(() => getActiveRecipients(recipients), [recipients]);
  const activeRecipientIds = useMemo(() => new Set(activeRecipients.map((recipient) => recipient.id)), [activeRecipients]);
  const allComplete = recipients.every((recipient) => recipient.status === "acted");
  const selectedRecipient = recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

  async function submitForSelectedRecipient(values: ProjectSigningSubmitValue[]) {
    if (!selectedRecipient) {
      throw new Error(isZh ? "未找到签署人。" : "Signer was not found.");
    }

    const response = await fetch(`/api/public/project-handoff/${encodeURIComponent(props.token)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: selectedRecipient.id, values }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || (isZh ? "无法提交签名。" : "Unable to submit the signature."));
    }

    const nextRecipients = recipients.map((recipient) =>
      recipient.id === selectedRecipient.id ? { ...recipient, status: "acted" } : recipient,
    );
    const nextSelectedRecipientId = getAutoSelectedRecipientId(nextRecipients);
    setRecipients(nextRecipients);
    setSelectedRecipientId(nextSelectedRecipientId);
    setMessage(
      nextSelectedRecipientId
        ? isZh
          ? "已签署。请把 iPad 交给下一位签署人。"
          : "Signed. Please hand the iPad to the next signer."
        : isZh
          ? "已签署。所有签署人都已完成。"
          : "Signed. All signers are complete."
    );
  }

  async function exitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);

    try {
      const response = await fetch(`/api/public/project-handoff/${encodeURIComponent(props.token)}/exit`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        throw new Error(payload.error || (isZh ? "无法退出交接模式。" : "Unable to exit handoff mode."));
      }

      window.location.href = payload.redirectTo ?? "/agent/projects";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isZh ? "无法退出交接模式。" : "Unable to exit handoff mode.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!allComplete && selectedRecipient) {
    return (
      <ProjectSigningExperience
        backLabel={isZh ? "签署人列表" : "Signer list"}
        completeMessage={isZh ? "已签署。请把 iPad 交给下一位签署人。" : "Signed. Please hand the iPad to the next signer."}
        description={
          isZh
            ? "查看完整 PDF，填写每个高亮字段，保存字段后再确认该签署人。"
            : "Review the full PDF, complete each highlighted field, save fields, then confirm this signer."
        }
        documents={selectedRecipient.documents}
        eyebrow={isZh ? "Acre 项目签署" : "Acre project signing"}
        key={selectedRecipient.id}
        onBack={activeRecipients.length > 1 ? () => setSelectedRecipientId(null) : undefined}
        onSubmit={submitForSelectedRecipient}
        recipientName={selectedRecipient.name}
        submitLabel={isZh ? "确认签名" : "Confirm signature"}
        title={props.projectName}
      />
    );
  }

  return (
    <main className="project-kiosk-shell">
      <section className="project-kiosk-panel">
        <p className="office-eyebrow">{isZh ? "Acre 项目签署" : "Acre project signing"}</p>
        <h1>{props.projectName}</h1>
        <p>
          {allComplete
            ? isZh
              ? "所有签署人都已完成。准备好后即可退出自助签署模式。"
              : "All signers are complete. Exit self-service signing mode when ready."
            : isZh
              ? "点击你的姓名，打开完整文件签署页面。"
              : "Select your name to open the full document signing page."}
        </p>
        {message ? <p className="project-public-message">{message}</p> : null}

        {!allComplete ? (
          <div className="project-kiosk-recipient-list">
            {recipients.map((recipient) => {
              const isActive = activeRecipientIds.has(recipient.id);
              const fieldCount = getAssignedFieldCount(recipient);

              return (
                <Button
                  disabled={!isActive || isBusy}
                  key={recipient.id}
                  onClick={() => setSelectedRecipientId(recipient.id)}
                  type="button"
                  variant={recipient.status === "acted" ? "secondary" : "primary"}
                >
                  {recipient.status === "acted"
                    ? isZh
                      ? `${recipient.name} 已签署`
                      : `${recipient.name} signed`
                    : isZh
                      ? `我是 ${recipient.name}（${fieldCount} 个字段）`
                      : `I am ${recipient.name} (${fieldCount} field${fieldCount === 1 ? "" : "s"})`}
                </Button>
              );
            })}
          </div>
        ) : (
          <form className="project-public-otp" onSubmit={exitHandoff}>
            <Button disabled={isBusy} type="submit">
              {isZh ? "退出自助签署" : "Exit self-service signing"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
