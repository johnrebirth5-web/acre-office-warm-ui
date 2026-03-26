"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, EmptyState, FormField, SelectInput, StatusBadge, TextInput } from "@acre/ui";
import type { OfficeFormTemplateOption, OfficeSignatureRequest, OfficeTransactionForm } from "@acre/db";

type TaskOption = {
  id: string;
  title: string;
};

type TransactionFormsSignaturesCardProps = {
  transactionId: string;
  forms: OfficeTransactionForm[];
  formTemplates: OfficeFormTemplateOption[];
  taskOptions: TaskOption[];
  canUseForms: boolean;
  canManageSignatures: boolean;
  canViewDocuments: boolean;
};

type NewFormState = {
  templateId: string;
  linkedTaskId: string;
  name: string;
};

type FormEditState = {
  name: string;
  linkedTaskId: string;
  statusKey: OfficeTransactionForm["statusKey"];
};

type SignatureDraftState = {
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: string;
};

const formStatusOptions: Array<{ value: OfficeTransactionForm["statusKey"]; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "prepared", label: "Prepared" },
  { value: "sent_for_signature", label: "Sent for signature" },
  { value: "partially_signed", label: "Partially signed" },
  { value: "fully_signed", label: "Fully signed" },
  { value: "rejected", label: "Rejected" },
  { value: "voided", label: "Voided" }
];

function buildFormEditState(form: OfficeTransactionForm): FormEditState {
  return {
    name: form.name,
    linkedTaskId: form.linkedTaskId ?? "",
    statusKey: form.statusKey
  };
}

function buildSignatureDraft(): SignatureDraftState {
  return {
    recipientName: "",
    recipientEmail: "",
    recipientRole: "Primary contact",
    signingOrder: ""
  };
}

function getFormTone(statusKey: OfficeTransactionForm["statusKey"]) {
  if (statusKey === "fully_signed") {
    return "success" as const;
  }

  if (statusKey === "rejected" || statusKey === "voided") {
    return "danger" as const;
  }

  if (statusKey === "sent_for_signature" || statusKey === "partially_signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function getSignatureTone(statusKey: OfficeSignatureRequest["statusKey"]) {
  if (statusKey === "signed") {
    return "success" as const;
  }

  if (statusKey === "declined" || statusKey === "canceled") {
    return "danger" as const;
  }

  if (statusKey === "sent" || statusKey === "viewed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionFormsSignaturesCard({
  transactionId,
  forms,
  formTemplates,
  taskOptions,
  canUseForms,
  canManageSignatures,
  canViewDocuments
}: TransactionFormsSignaturesCardProps) {
  const router = useRouter();
  const [newFormState, setNewFormState] = useState<NewFormState>({
    templateId: formTemplates[0]?.id ?? "",
    linkedTaskId: "",
    name: ""
  });
  const [formStates, setFormStates] = useState<Record<string, FormEditState>>(
    Object.fromEntries(forms.map((form) => [form.id, buildFormEditState(form)]))
  );
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, SignatureDraftState>>(
    Object.fromEntries(forms.map((form) => [form.id, buildSignatureDraft()]))
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  function updateFormState(formId: string, field: keyof FormEditState, value: string) {
    setFormStates((current) => ({
      ...current,
      [formId]: {
        ...(current[formId] ?? buildFormEditState(forms.find((form) => form.id === formId)!)),
        [field]: value
      }
    }));
  }

  function updateSignatureDraft(formId: string, field: keyof SignatureDraftState, value: string) {
    setSignatureDrafts((current) => ({
      ...current,
      [formId]: {
        ...(current[formId] ?? buildSignatureDraft()),
        [field]: value
      }
    }));
  }

  async function handleCreateForm() {
    if (!newFormState.templateId) {
      setError("Select a template first.");
      return;
    }

    setPendingAction("create-form");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newFormState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Form could not be created.");
      }

      setNewFormState({
        templateId: formTemplates[0]?.id ?? "",
        linkedTaskId: "",
        name: ""
      });
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Form could not be created.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveForm(formId: string) {
    const formState = formStates[formId];

    if (!formState) {
      return;
    }

    setPendingAction(`save-form:${formId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms/${formId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formState.name,
          linkedTaskId: formState.linkedTaskId || null,
          status: formState.statusKey
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Form update failed.");
      }

      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Form update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateSignatureRequest(formId: string) {
    const draft = signatureDrafts[formId] ?? buildSignatureDraft();

    if (!draft.recipientName.trim() || !draft.recipientEmail.trim()) {
      setError("Recipient name and email are required.");
      return;
    }

    setPendingAction(`create-signature:${formId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          formId,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          recipientRole: draft.recipientRole,
          signingOrder: draft.signingOrder ? Number(draft.signingOrder) : null
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Signature request could not be prepared.");
      }

      setSignatureDrafts((current) => ({
        ...current,
        [formId]: buildSignatureDraft()
      }));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Signature request could not be prepared.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSignatureAction(signatureRequestId: string, action: "send" | "viewed" | "signed" | "declined" | "canceled") {
    setPendingAction(`${action}:${signatureRequestId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures/${signatureRequestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Signature status update failed.");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Signature status update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="bm-detail-card" id="transaction-forms-signatures">
      <div className="bm-card-head">
        <div>
          <h3>Forms &amp; eSignature</h3>
          <span>Generate transaction packets from templates, keep them tied to checklist tasks, and track manual signature status.</span>
        </div>
      </div>

      <div className="bm-document-list">
        {forms.length > 0 ? (
          forms.map((form) => {
            const formState = formStates[form.id] ?? buildFormEditState(form);
            const signatureDraft = signatureDrafts[form.id] ?? buildSignatureDraft();

            return (
              <article className="bm-form-row" key={form.id}>
                <div className="bm-document-row-top">
                  <div className="bm-document-row-copy">
                    <div className="bm-document-row-head">
                      <strong>{form.name}</strong>
                      <StatusBadge tone={getFormTone(form.statusKey)}>{form.status}</StatusBadge>
                      {form.documentTitle ? <StatusBadge tone="neutral">Rendered document</StatusBadge> : null}
                    </div>
                    <p>
                      Template: {form.templateName || "Custom"} · Created by {form.createdByName || "System"}
                    </p>
                    {form.linkedTaskTitle ? (
                      <p>
                        Linked task: <Link href={form.linkedTaskHref}>{form.linkedTaskTitle}</Link>
                      </p>
                    ) : null}
                  </div>

                  <div className="bm-document-row-actions">
                    {canViewDocuments && form.documentId ? (
                      <Link className="office-toggle-link" href={`/api/office/transactions/${transactionId}/documents/${form.documentId}/file`} target="_blank">
                        Open document
                      </Link>
                    ) : null}
                  </div>
                </div>

                {canUseForms ? (
                  <div className="bm-document-edit-grid">
                    <FormField label="Form name">
                      <TextInput
                        onChange={(event) => updateFormState(form.id, "name", event.target.value)}
                        value={formState.name}
                      />
                    </FormField>
                    <FormField label="Linked task">
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "linkedTaskId", event.target.value)}
                        value={formState.linkedTaskId}
                      >
                        <option value="">No linked task</option>
                        {taskOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <FormField label="Form status">
                      <SelectInput
                        onChange={(event) => updateFormState(form.id, "statusKey", event.target.value)}
                        value={formState.statusKey}
                      >
                        {formStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <div className="bm-document-edit-actions">
                      <Button
                        disabled={pendingAction === `save-form:${form.id}`}
                        onClick={() => handleSaveForm(form.id)}
                        size="sm"
                      >
                        {pendingAction === `save-form:${form.id}` ? "Saving..." : "Save form"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="bm-form-payload-preview">
                  {Object.entries(form.generatedPayload).slice(0, 8).map(([key, value]) => (
                    <div className="bm-form-payload-item" key={key}>
                      <span>{key}</span>
                      <strong>{value || "—"}</strong>
                    </div>
                  ))}
                </div>

                <div className="bm-form-signature-list">
                  <div className="bm-card-head bm-card-head-inline">
                    <h3>Signature requests</h3>
                  </div>

                  {form.signatureRequests.length > 0 ? (
                    form.signatureRequests.map((request) => (
                      <div className="bm-signature-row" key={request.id}>
                        <div className="bm-signature-row-copy">
                          <div className="bm-document-row-head">
                            <strong>{request.recipientName}</strong>
                            <StatusBadge tone={getSignatureTone(request.statusKey)}>{request.status}</StatusBadge>
                          </div>
                          <p>
                            {request.recipientRole} · {request.recipientEmail}
                            {request.signingOrder ? ` · Order ${request.signingOrder}` : ""}
                          </p>
                          <p>
                            {request.sentAt ? `Sent ${formatDateLabel(request.sentAt)}` : "Not sent yet"}
                            {request.completedAt ? ` · Signed ${formatDateLabel(request.completedAt)}` : ""}
                            {request.declinedAt ? ` · Declined ${formatDateLabel(request.declinedAt)}` : ""}
                          </p>
                        </div>

                        {canManageSignatures ? (
                          <div className="bm-signature-row-actions">
                            {request.statusKey === "draft" ? (
                              <Button
                                disabled={pendingAction === `send:${request.id}`}
                                onClick={() => handleSignatureAction(request.id, "send")}
                                size="sm"
                              >
                                {pendingAction === `send:${request.id}` ? "Sending..." : "Send"}
                              </Button>
                            ) : null}
                            {(request.statusKey === "sent" || request.statusKey === "viewed") ? (
                              <>
                                {request.statusKey === "sent" ? (
                                  <Button
                                    disabled={pendingAction === `viewed:${request.id}`}
                                    onClick={() => handleSignatureAction(request.id, "viewed")}
                                    size="sm"
                                    variant="secondary"
                                  >
                                    Viewed
                                  </Button>
                                ) : null}
                                <Button
                                  disabled={pendingAction === `signed:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "signed")}
                                  size="sm"
                                >
                                  {pendingAction === `signed:${request.id}` ? "Saving..." : "Mark signed"}
                                </Button>
                                <Button
                                  disabled={pendingAction === `declined:${request.id}`}
                                  onClick={() => handleSignatureAction(request.id, "declined")}
                                  size="sm"
                                  variant="danger"
                                >
                                  Decline
                                </Button>
                              </>
                            ) : null}
                            {(request.statusKey === "draft" || request.statusKey === "sent" || request.statusKey === "viewed") ? (
                              <Button
                                disabled={pendingAction === `canceled:${request.id}`}
                                onClick={() => handleSignatureAction(request.id, "canceled")}
                                size="sm"
                                variant="secondary"
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No signature requests yet." />
                  )}

                  {canManageSignatures ? (
                    <div className="bm-document-upload-panel bm-form-signature-create">
                      <div className="bm-card-head bm-card-head-inline">
                        <h3>Prepare signature request</h3>
                      </div>
                      <div className="bm-document-upload-grid">
                        <FormField label="Recipient name">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientName", event.target.value)}
                            value={signatureDraft.recipientName}
                          />
                        </FormField>
                        <FormField label="Recipient email">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientEmail", event.target.value)}
                            type="email"
                            value={signatureDraft.recipientEmail}
                          />
                        </FormField>
                        <FormField label="Recipient role">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "recipientRole", event.target.value)}
                            value={signatureDraft.recipientRole}
                          />
                        </FormField>
                        <FormField label="Signing order">
                          <TextInput
                            onChange={(event) => updateSignatureDraft(form.id, "signingOrder", event.target.value)}
                            type="number"
                            value={signatureDraft.signingOrder}
                          />
                        </FormField>
                      </div>

                      <div className="bm-document-edit-actions">
                        <Button
                          disabled={pendingAction === `create-signature:${form.id}`}
                          onClick={() => handleCreateSignatureRequest(form.id)}
                          size="sm"
                        >
                          {pendingAction === `create-signature:${form.id}` ? "Preparing..." : "Prepare signature request"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            description="Use a seeded template to prepare a transaction form packet and start an internal signature workflow."
            title="No forms created for this transaction yet."
          />
        )}
      </div>

      {canUseForms ? (
        <div className="bm-document-upload-panel">
          <div className="bm-card-head bm-card-head-inline">
            <h3>Use forms</h3>
          </div>

          <div className="bm-document-upload-grid">
            <FormField label="Template">
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, templateId: event.target.value }))}
                value={newFormState.templateId}
              >
                <option value="">Select template</option>
                {formTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Linked task">
              <SelectInput
                onChange={(event) => setNewFormState((current) => ({ ...current, linkedTaskId: event.target.value }))}
                value={newFormState.linkedTaskId}
              >
                <option value="">No linked task</option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Packet name">
              <TextInput
                onChange={(event) => setNewFormState((current) => ({ ...current, name: event.target.value }))}
                placeholder="Leave blank to use the default template name"
                value={newFormState.name}
              />
            </FormField>
          </div>

          <div className="bm-document-edit-actions">
            <Button disabled={pendingAction === "create-form"} onClick={handleCreateForm}>
              {pendingAction === "create-form" ? "Creating..." : "Create form draft"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="office-form-error">{error}</p> : null}
    </section>
  );
}
