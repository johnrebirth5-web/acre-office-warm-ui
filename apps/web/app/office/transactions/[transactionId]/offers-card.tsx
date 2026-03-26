"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  EmptyState,
  FormField,
  HorizontalScrollArea,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput
} from "@acre/ui";
import type { OfficeFormTemplateOption, OfficeOfferFieldSchema, OfficeTransactionOffersSnapshot } from "@acre/db";

type TaskOption = {
  id: string;
  title: string;
};

type TransactionOffersCardProps = {
  transactionId: string;
  snapshot: OfficeTransactionOffersSnapshot;
  fieldSchema: OfficeOfferFieldSchema;
  taskOptions: TaskOption[];
  formTemplates: OfficeFormTemplateOption[];
  canManageOffers: boolean;
  canReviewOffers: boolean;
  canAcceptOffers: boolean;
  canManageDocuments: boolean;
  canUseForms: boolean;
  canManageSignatures: boolean;
};

type OfferFormState = {
  values: Record<string, string>;
  additionalFields: Record<string, string>;
  isPrimaryOffer: boolean;
};

type OfferUploadState = {
  title: string;
  documentType: string;
  linkedTaskId: string;
};

type OfferFormDraftState = {
  templateId: string;
  linkedTaskId: string;
  name: string;
};

type SignatureDraftState = {
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;
  signingOrder: string;
};

type OfferVisibleField =
  | { kind: "builtIn"; field: OfficeOfferFieldSchema["builtInFields"][number] }
  | { kind: "custom"; field: OfficeOfferFieldSchema["customFields"][number] };

const offerActionMap: Record<
  OfficeTransactionOffersSnapshot["offers"][number]["statusValue"],
  Array<{ action: string; label: string }>
> = {
  draft: [
    { action: "submit", label: "Submit" },
    { action: "receive", label: "Mark received" },
    { action: "withdraw", label: "Withdraw" }
  ],
  submitted: [
    { action: "receive", label: "Mark received" },
    { action: "counter", label: "Counter" },
    { action: "reject", label: "Reject" },
    { action: "withdraw", label: "Withdraw" }
  ],
  received: [
    { action: "review", label: "Start review" },
    { action: "counter", label: "Counter" },
    { action: "accept", label: "Accept" },
    { action: "reject", label: "Reject" },
    { action: "withdraw", label: "Withdraw" }
  ],
  under_review: [
    { action: "counter", label: "Counter" },
    { action: "accept", label: "Accept" },
    { action: "reject", label: "Reject" },
    { action: "withdraw", label: "Withdraw" }
  ],
  countered: [
    { action: "submit", label: "Resubmit" },
    { action: "receive", label: "Mark received" },
    { action: "accept", label: "Accept" },
    { action: "reject", label: "Reject" },
    { action: "withdraw", label: "Withdraw" }
  ],
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: []
};

function sortSchemaFieldEntries(fields: OfferVisibleField[]) {
  return [...fields].sort((left, right) => {
    if (left.field.sortOrder !== right.field.sortOrder) {
      return left.field.sortOrder - right.field.sortOrder;
    }

    return left.field.label.localeCompare(right.field.label);
  });
}

function buildOfferFormState(
  fieldSchema: OfficeOfferFieldSchema,
  offer?: OfficeTransactionOffersSnapshot["offers"][number]
): OfferFormState {
  const values: Record<string, string> = {};
  const additionalFields: Record<string, string> = {};

  for (const field of fieldSchema.builtInFields) {
    values[field.inputName] = String((offer as Record<string, unknown> | undefined)?.[field.inputName] ?? "");
  }

  for (const field of fieldSchema.customFields) {
    additionalFields[field.fieldKey] = offer?.additionalFields[field.fieldKey] ?? "";
  }

  return {
    values,
    additionalFields,
    isPrimaryOffer: offer?.isPrimaryOffer ?? false
  };
}

function buildOfferPayload(fieldSchema: OfficeOfferFieldSchema, state: OfferFormState) {
  return {
    ...state.values,
    ...Object.fromEntries(
      fieldSchema.customFields.map((field) => [
        field.inputName,
        state.additionalFields[field.fieldKey] ?? ""
      ])
    ),
    isPrimaryOffer: state.isPrimaryOffer
  };
}

function getOfferFieldLabel(label: string, isRequired: boolean) {
  return isRequired ? `${label} *` : label;
}

function getOfferFieldClassName(fieldClassName: string, context: "create" | "edit") {
  if (!fieldClassName.includes("is-span-4")) {
    return undefined;
  }

  return context === "create" ? "bm-offer-create-notes" : "bm-offer-edit-notes";
}

function buildOfferUploadState(): OfferUploadState {
  return {
    title: "",
    documentType: "Offer packet",
    linkedTaskId: ""
  };
}

function buildOfferFormDraftState(formTemplates: OfficeFormTemplateOption[]): OfferFormDraftState {
  return {
    templateId: formTemplates[0]?.id ?? "",
    linkedTaskId: "",
    name: ""
  };
}

function buildSignatureDraftState(): SignatureDraftState {
  return {
    recipientName: "",
    recipientEmail: "",
    recipientRole: "Buyer",
    signingOrder: ""
  };
}

function getOfferTone(status: OfficeTransactionOffersSnapshot["offers"][number]["statusValue"]) {
  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "rejected" || status === "withdrawn" || status === "expired") {
    return "danger" as const;
  }

  if (status === "countered" || status === "under_review") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function TransactionOffersCard({
  transactionId,
  snapshot,
  fieldSchema,
  taskOptions,
  formTemplates,
  canManageOffers,
  canReviewOffers,
  canAcceptOffers,
  canManageDocuments,
  canUseForms,
  canManageSignatures
}: TransactionOffersCardProps) {
  const router = useRouter();
  const [newOfferState, setNewOfferState] = useState<OfferFormState>(() =>
    buildOfferFormState(fieldSchema)
  );
  const [offerStates, setOfferStates] = useState<Record<string, OfferFormState>>(
    Object.fromEntries(
      snapshot.offers.map((offer) => [offer.id, buildOfferFormState(fieldSchema, offer)])
    )
  );
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, ""]))
  );
  const [uploadStates, setUploadStates] = useState<Record<string, OfferUploadState>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferUploadState()]))
  );
  const [formDrafts, setFormDrafts] = useState<Record<string, OfferFormDraftState>>(
    Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferFormDraftState(formTemplates)]))
  );
  const [signatureDrafts, setSignatureDrafts] = useState<Record<string, SignatureDraftState>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setNewOfferState(buildOfferFormState(fieldSchema));
    setOfferStates(
      Object.fromEntries(
        snapshot.offers.map((offer) => [offer.id, buildOfferFormState(fieldSchema, offer)])
      )
    );
    setCommentDrafts(
      Object.fromEntries(snapshot.offers.map((offer) => [offer.id, ""]))
    );
    setUploadStates(
      Object.fromEntries(snapshot.offers.map((offer) => [offer.id, buildOfferUploadState()]))
    );
    setFormDrafts(
      Object.fromEntries(
        snapshot.offers.map((offer) => [offer.id, buildOfferFormDraftState(formTemplates)])
      )
    );
    setSignatureDrafts({});
    setSelectedFiles({});
  }, [fieldSchema, formTemplates, snapshot.offers]);

  const visibleOfferFields: OfferVisibleField[] = sortSchemaFieldEntries([
    ...fieldSchema.builtInFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "builtIn" as const, field })),
    ...fieldSchema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "custom" as const, field }))
  ]);

  const comparisonRows = useMemo(
    () => snapshot.offers.map((offer) => offer.comparison),
    [snapshot.offers]
  );

  function updateNewOfferValue(fieldName: string, value: string) {
    setNewOfferState((current) => ({
      ...current,
      values: {
        ...current.values,
        [fieldName]: value
      }
    }));
  }

  function updateNewOfferAdditionalField(fieldKey: string, value: string) {
    setNewOfferState((current) => ({
      ...current,
      additionalFields: {
        ...current.additionalFields,
        [fieldKey]: value
      }
    }));
  }

  function updateOfferValue(offerId: string, fieldName: string, value: string) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        values: {
          ...(current[offerId]?.values ??
            buildOfferFormState(
              fieldSchema,
              snapshot.offers.find((offer) => offer.id === offerId)
            ).values),
          [fieldName]: value
        }
      }
    }));
  }

  function updateOfferAdditionalField(offerId: string, fieldKey: string, value: string) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        additionalFields: {
          ...(current[offerId]?.additionalFields ??
            buildOfferFormState(
              fieldSchema,
              snapshot.offers.find((offer) => offer.id === offerId)
            ).additionalFields),
          [fieldKey]: value
        }
      }
    }));
  }

  function updateOfferPrimaryFlag(offerId: string, value: boolean) {
    setOfferStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ??
          buildOfferFormState(
            fieldSchema,
            snapshot.offers.find((offer) => offer.id === offerId)
          )),
        isPrimaryOffer: value
      }
    }));
  }

  function updateUploadState(offerId: string, field: keyof OfferUploadState, value: string) {
    setUploadStates((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ?? buildOfferUploadState()),
        [field]: value
      }
    }));
  }

  function updateFormDraft(offerId: string, field: keyof OfferFormDraftState, value: string) {
    setFormDrafts((current) => ({
      ...current,
      [offerId]: {
        ...(current[offerId] ?? buildOfferFormDraftState(formTemplates)),
        [field]: value
      }
    }));
  }

  function updateSignatureDraft(key: string, field: keyof SignatureDraftState, value: string) {
    setSignatureDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? buildSignatureDraftState()),
        [field]: value
      }
    }));
  }

  async function handleCreateOffer() {
    if (!newOfferState.values.title?.trim() || !newOfferState.values.offeringPartyName?.trim()) {
      setError("Offer title and offer party are required.");
      return;
    }

    setPendingAction("create-offer");
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildOfferPayload(fieldSchema, newOfferState))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Offer could not be created.");
      }

      setNewOfferState(buildOfferFormState(fieldSchema));
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Offer could not be created.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveOffer(offerId: string) {
    const offerState = offerStates[offerId];

    if (!offerState?.values.title?.trim() || !offerState.values.offeringPartyName?.trim()) {
      setError("Offer title and offer party are required.");
      return;
    }

    setPendingAction(`save-offer:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildOfferPayload(fieldSchema, offerState))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Offer update failed.");
      }

      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Offer update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOfferAction(
    offerId: string,
    action: "submit" | "receive" | "review" | "counter" | "accept" | "reject" | "withdraw" | "expire"
  ) {
    setPendingAction(`offer-action:${offerId}:${action}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Offer action failed.");
      }

      router.refresh();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Offer action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddComment(offerId: string) {
    const body = commentDrafts[offerId]?.trim() ?? "";

    if (!body) {
      setError("Comment body is required.");
      return;
    }

    setPendingAction(`comment:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/offers/${offerId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ body })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Comment could not be added.");
      }

      setCommentDrafts((current) => ({ ...current, [offerId]: "" }));
      router.refresh();
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Comment could not be added.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUploadDocument(offerId: string) {
    const file = selectedFiles[offerId] ?? null;
    if (!file) {
      setError("A file is required.");
      return;
    }

    const uploadState = uploadStates[offerId] ?? buildOfferUploadState();
    setPendingAction(`upload:${offerId}`);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("title", uploadState.title.trim() || file.name);
      formData.set("documentType", uploadState.documentType.trim() || "Offer packet");
      formData.set("linkedTaskId", uploadState.linkedTaskId || "");
      formData.set("offerId", offerId);
      formData.set("isRequired", "false");
      formData.set("isUnsorted", "false");

      const response = await fetch(`/api/office/transactions/${transactionId}/documents`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Document upload failed.");
      }

      setUploadStates((current) => ({ ...current, [offerId]: buildOfferUploadState() }));
      setSelectedFiles((current) => ({ ...current, [offerId]: null }));
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateForm(offerId: string) {
    const draft = formDrafts[offerId] ?? buildOfferFormDraftState(formTemplates);

    if (!draft.templateId) {
      setError("Select a form template first.");
      return;
    }

    setPendingAction(`create-form:${offerId}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/forms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: draft.templateId,
          linkedTaskId: draft.linkedTaskId || null,
          offerId,
          name: draft.name
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Form could not be created.");
      }

      setFormDrafts((current) => ({ ...current, [offerId]: buildOfferFormDraftState(formTemplates) }));
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Form could not be created.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateSignature(offerId: string, formId: string) {
    const draftKey = `${offerId}:${formId}`;
    const draft = signatureDrafts[draftKey] ?? buildSignatureDraftState();

    if (!draft.recipientName.trim() || !draft.recipientEmail.trim() || !draft.recipientRole.trim()) {
      setError("Recipient name, email, and role are required.");
      return;
    }

    setPendingAction(`create-signature:${draftKey}`);
    setError("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          offerId,
          formId,
          recipientName: draft.recipientName,
          recipientEmail: draft.recipientEmail,
          recipientRole: draft.recipientRole,
          signingOrder: draft.signingOrder ? Number(draft.signingOrder) : null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Signature request could not be created.");
      }

      setSignatureDrafts((current) => ({ ...current, [draftKey]: buildSignatureDraftState() }));
      router.refresh();
    } catch (signatureError) {
      setError(signatureError instanceof Error ? signatureError.message : "Signature request could not be created.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="bm-detail-card" id="transaction-offers">
      <div className="bm-card-head">
        <div>
          <h3>Offers</h3>
          <span>Back-office offer tracking, comparison, comments, and offer-linked documents/forms/signatures.</span>
        </div>
        <div className="bm-offer-head-metrics">
          {snapshot.acceptedOfferLabel ? (
            <StatusBadge tone="success">Accepted: {snapshot.acceptedOfferLabel}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">No accepted offer</StatusBadge>
          )}
          {snapshot.expiringSoonCount > 0 ? (
            <StatusBadge tone="warning">{snapshot.expiringSoonCount} expiring soon</StatusBadge>
          ) : null}
        </div>
      </div>

      {error ? <div className="office-inline-error">{error}</div> : null}

      {canManageOffers ? (
        <div className="bm-offer-create-grid">
          {visibleOfferFields.map((entry) => {
            const field = entry.field;
            const fieldType =
              entry.kind === "builtIn" ? entry.field.control : entry.field.type;
            const fieldClassName =
              entry.kind === "builtIn" ? entry.field.className : "";
            const fieldValue =
              entry.kind === "builtIn"
                ? newOfferState.values[field.inputName] ?? ""
                : newOfferState.additionalFields[field.fieldKey] ?? "";

            return (
              <FormField
                className={getOfferFieldClassName(fieldClassName, "create")}
                key={`create:${entry.kind}:${field.fieldKey}`}
                label={getOfferFieldLabel(field.label, field.isRequired)}
              >
                {fieldType === "textarea" ? (
                  <TextareaInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    rows={3}
                    value={fieldValue}
                  />
                ) : fieldType === "select" ? (
                  <SelectInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    value={fieldValue}
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <TextInput
                    onChange={(event) =>
                      entry.kind === "builtIn"
                        ? updateNewOfferValue(field.inputName, event.target.value)
                        : updateNewOfferAdditionalField(
                            field.fieldKey,
                            event.target.value
                          )
                    }
                    placeholder={
                      field.inputName === "title"
                        ? "Offer #1 / Highest and best"
                        : field.inputName === "offeringPartyName"
                          ? "Buyer / agent / party"
                          : undefined
                    }
                    type={fieldType === "date" ? "date" : "text"}
                    value={fieldValue}
                  />
                )}
              </FormField>
            );
          })}
          <div className="bm-offer-create-actions">
            <Button disabled={pendingAction === "create-offer"} onClick={handleCreateOffer}>
              {pendingAction === "create-offer" ? "Saving..." : "Create offer"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="bm-offer-list">
        {snapshot.offers.length ? (
          snapshot.offers.map((offer) => {
            const offerState =
              offerStates[offer.id] ?? buildOfferFormState(fieldSchema, offer);
            const uploadState = uploadStates[offer.id] ?? buildOfferUploadState();
            const formDraft = formDrafts[offer.id] ?? buildOfferFormDraftState(formTemplates);

            return (
              <article className="bm-offer-row" id={`offer-${offer.id}`} key={offer.id}>
                <div className="bm-offer-row-top">
                  <div className="bm-offer-row-headline">
                    <div className="bm-offer-row-title">
                      <strong>{offer.title}</strong>
                      <StatusBadge tone={getOfferTone(offer.statusValue)}>{offer.status}</StatusBadge>
                      {offer.isPrimaryOffer ? <StatusBadge tone="accent">Primary</StatusBadge> : null}
                    </div>
                    <p>{offer.buyerName || offer.offeringPartyName}</p>
                  </div>
                  <div className="bm-offer-row-metrics">
                    <span>{offer.price || "No price"}</span>
                    {offer.earnestMoneyAmount ? <span>EMD {offer.earnestMoneyAmount}</span> : null}
                    {offer.expirationAt ? <span>Expires {offer.expirationAt}</span> : null}
                  </div>
                </div>

                <div className="bm-offer-meta-grid">
                  <div><span>Financing</span><strong>{offer.financingType || "Not set"}</strong></div>
                  <div><span>Closing date</span><strong>{offer.closingDateOffered || "Not set"}</strong></div>
                  <div><span>Submitted</span><strong>{offer.submittedAt || "Not submitted"}</strong></div>
                  <div><span>Updated</span><strong>{offer.updatedAt || offer.createdAt}</strong></div>
                </div>

                {canManageOffers ? (
                  <div className="bm-offer-edit-grid">
                    {visibleOfferFields.map((entry) => {
                      const field = entry.field;
                      const fieldType =
                        entry.kind === "builtIn" ? entry.field.control : entry.field.type;
                      const fieldClassName =
                        entry.kind === "builtIn" ? entry.field.className : "";
                      const fieldValue =
                        entry.kind === "builtIn"
                          ? offerState.values[field.inputName] ?? ""
                          : offerState.additionalFields[field.fieldKey] ?? "";

                      return (
                        <FormField
                          className={getOfferFieldClassName(fieldClassName, "edit")}
                          key={`${offer.id}:${entry.kind}:${field.fieldKey}`}
                          label={getOfferFieldLabel(field.label, field.isRequired)}
                        >
                          {fieldType === "textarea" ? (
                            <TextareaInput
                              rows={3}
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            />
                          ) : fieldType === "select" ? (
                            <SelectInput
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            >
                              <option value="">Select...</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </SelectInput>
                          ) : (
                            <TextInput
                              type={fieldType === "date" ? "date" : "text"}
                              value={fieldValue}
                              onChange={(event) =>
                                entry.kind === "builtIn"
                                  ? updateOfferValue(
                                      offer.id,
                                      field.inputName,
                                      event.target.value
                                    )
                                  : updateOfferAdditionalField(
                                      offer.id,
                                      field.fieldKey,
                                      event.target.value
                                    )
                              }
                            />
                          )}
                        </FormField>
                      );
                    })}
                    <FormField className="bm-offer-edit-checkbox" label="Primary offer">
                      <input
                        checked={offerState.isPrimaryOffer}
                        onChange={(event) =>
                          updateOfferPrimaryFlag(offer.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </FormField>
                    <div className="bm-offer-action-row">
                      <Button
                        disabled={pendingAction === `save-offer:${offer.id}`}
                        onClick={() => handleSaveOffer(offer.id)}
                        size="sm"
                      >
                        {pendingAction === `save-offer:${offer.id}` ? "Saving..." : "Save offer"}
                      </Button>
                      {(offerActionMap[offer.statusValue] ?? []).map((action) => {
                        const canRun =
                          action.action === "accept"
                            ? canAcceptOffers
                            : canManageOffers || canReviewOffers;

                        if (!canRun) {
                          return null;
                        }

                        return (
                          <Button
                            disabled={pendingAction === `offer-action:${offer.id}:${action.action}`}
                            key={action.action}
                            onClick={() => handleOfferAction(offer.id, action.action as never)}
                            size="sm"
                            variant={action.action === "reject" || action.action === "withdraw" ? "danger" : "secondary"}
                          >
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="bm-offer-linked-grid">
                  <section className="bm-offer-linked-section">
                    <div className="bm-offer-subhead">
                      <h4>Documents</h4>
                      <span>{offer.documents.length} linked</span>
                    </div>
                    {offer.documents.length ? (
                      <ul className="bm-offer-inline-list">
                        {offer.documents.map((document) => (
                          <li key={document.id}>
                            <a href={document.href} rel="noreferrer" target="_blank">
                              {document.title}
                            </a>
                            <StatusBadge tone={document.statusValue === "approved" || document.statusValue === "signed" ? "success" : "neutral"}>
                              {document.status}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState description="No offer documents yet." title="No linked documents" />
                    )}

                    {canManageDocuments ? (
                      <div className="bm-offer-upload-grid">
                        <FormField label="Document title">
                          <TextInput value={uploadState.title} onChange={(event) => updateUploadState(offer.id, "title", event.target.value)} />
                        </FormField>
                        <FormField label="Document type">
                          <TextInput value={uploadState.documentType} onChange={(event) => updateUploadState(offer.id, "documentType", event.target.value)} />
                        </FormField>
                        <FormField label="Linked task">
                          <SelectInput value={uploadState.linkedTaskId} onChange={(event) => updateUploadState(offer.id, "linkedTaskId", event.target.value)}>
                            <option value="">None</option>
                            {taskOptions.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="File">
                          <input
                            onChange={(event) =>
                              setSelectedFiles((current) => ({
                                ...current,
                                [offer.id]: event.target.files?.[0] ?? null
                              }))
                            }
                            type="file"
                          />
                        </FormField>
                        <Button
                          disabled={pendingAction === `upload:${offer.id}`}
                          onClick={() => handleUploadDocument(offer.id)}
                          size="sm"
                        >
                          {pendingAction === `upload:${offer.id}` ? "Uploading..." : "Upload document"}
                        </Button>
                      </div>
                    ) : null}
                  </section>

                  <section className="bm-offer-linked-section">
                    <div className="bm-offer-subhead">
                      <h4>Forms & eSignature</h4>
                      <span>{offer.forms.length} forms · {offer.signatureRequests.length} requests</span>
                    </div>

                    {offer.forms.length ? (
                      <div className="bm-offer-form-list">
                        {offer.forms.map((form) => {
                          const signatureDraftKey = `${offer.id}:${form.id}`;
                          const signatureDraft = signatureDrafts[signatureDraftKey] ?? buildSignatureDraftState();

                          return (
                            <div className="bm-offer-form-row" key={form.id}>
                              <div className="bm-offer-form-head">
                                <div>
                                  <strong>{form.name}</strong>
                                  <p>{form.signatureStatusSummary}</p>
                                </div>
                                <StatusBadge tone={form.statusValue === "fully_signed" ? "success" : form.statusValue === "sent_for_signature" || form.statusValue === "partially_signed" ? "accent" : "neutral"}>
                                  {form.status}
                                </StatusBadge>
                              </div>
                              {form.documentId ? (
                                <Link className="office-inline-link" href={`#transaction-forms-signatures`}>
                                  View in forms section
                                </Link>
                              ) : null}
                              {canManageSignatures ? (
                                <div className="bm-offer-signature-grid">
                                  <FormField label="Recipient name">
                                    <TextInput value={signatureDraft.recipientName} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientName", event.target.value)} />
                                  </FormField>
                                  <FormField label="Recipient email">
                                    <TextInput value={signatureDraft.recipientEmail} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientEmail", event.target.value)} />
                                  </FormField>
                                  <FormField label="Recipient role">
                                    <TextInput value={signatureDraft.recipientRole} onChange={(event) => updateSignatureDraft(signatureDraftKey, "recipientRole", event.target.value)} />
                                  </FormField>
                                  <FormField label="Signing order">
                                    <TextInput value={signatureDraft.signingOrder} onChange={(event) => updateSignatureDraft(signatureDraftKey, "signingOrder", event.target.value)} />
                                  </FormField>
                                  <Button
                                    disabled={pendingAction === `create-signature:${signatureDraftKey}`}
                                    onClick={() => handleCreateSignature(offer.id, form.id)}
                                    size="sm"
                                  >
                                    {pendingAction === `create-signature:${signatureDraftKey}` ? "Saving..." : "Send for signature"}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState description="No offer forms yet." title="No offer forms" />
                    )}

                    {canUseForms ? (
                      <div className="bm-offer-form-create-grid">
                        <FormField label="Template">
                          <SelectInput value={formDraft.templateId} onChange={(event) => updateFormDraft(offer.id, "templateId", event.target.value)}>
                            {formTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="Linked task">
                          <SelectInput value={formDraft.linkedTaskId} onChange={(event) => updateFormDraft(offer.id, "linkedTaskId", event.target.value)}>
                            <option value="">None</option>
                            {taskOptions.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </SelectInput>
                        </FormField>
                        <FormField label="Form name">
                          <TextInput value={formDraft.name} onChange={(event) => updateFormDraft(offer.id, "name", event.target.value)} />
                        </FormField>
                        <Button
                          disabled={pendingAction === `create-form:${offer.id}`}
                          onClick={() => handleCreateForm(offer.id)}
                          size="sm"
                        >
                          {pendingAction === `create-form:${offer.id}` ? "Creating..." : "Use forms"}
                        </Button>
                      </div>
                    ) : null}
                  </section>
                </div>

                <section className="bm-offer-comments-section">
                  <div className="bm-offer-subhead">
                    <h4>Internal comments</h4>
                    <span>{offer.comments.length}</span>
                  </div>
                  {offer.comments.length ? (
                    <ul className="bm-offer-comment-list">
                      {offer.comments.map((comment) => (
                        <li key={comment.id}>
                          <div className="bm-offer-comment-head">
                            <strong>{comment.authorName}</strong>
                            <span>{comment.createdAt}</span>
                          </div>
                          <p>{comment.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState description="Use comments for internal offer discussion." title="No offer comments yet" />
                  )}
                  <div className="bm-offer-comment-compose">
                    <FormField label="Add comment">
                      <TextareaInput
                        onChange={(event) =>
                          setCommentDrafts((current) => ({ ...current, [offer.id]: event.target.value }))
                        }
                        rows={3}
                        value={commentDrafts[offer.id] ?? ""}
                      />
                    </FormField>
                    <Button
                      disabled={pendingAction === `comment:${offer.id}`}
                      onClick={() => handleAddComment(offer.id)}
                      size="sm"
                      variant="secondary"
                    >
                      {pendingAction === `comment:${offer.id}` ? "Saving..." : "Add comment"}
                    </Button>
                  </div>
                </section>
              </article>
            );
          })
        ) : (
          <EmptyState
            description="Track and compare buyer offers, then link documents and signatures to the accepted path."
            title="No offers for this transaction yet"
          />
        )}
      </div>

      {comparisonRows.length > 1 ? (
        <div className="bm-offer-comparison">
          <div className="bm-offer-subhead">
            <h4>Offer comparison</h4>
            <span>{comparisonRows.length} offers</span>
          </div>
          <HorizontalScrollArea viewportClassName="office-table-scroll">
            <table className="bm-offer-comparison-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Price</th>
                  <th>Earnest money</th>
                  <th>Closing date</th>
                  <th>Financing</th>
                  <th>Status</th>
                  <th>Expiration</th>
                  <th>Documents</th>
                  <th>Signatures</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="bm-offer-comparison-title">
                        <strong>{row.title}</strong>
                        <span>{row.buyerName || row.offeringPartyName}</span>
                        {row.isPrimaryOffer ? <StatusBadge tone="accent">Primary</StatusBadge> : null}
                      </div>
                    </td>
                    <td>{row.price || "—"}</td>
                    <td>{row.earnestMoneyAmount || "—"}</td>
                    <td>{row.closingDateOffered || "—"}</td>
                    <td>{row.financingType || "—"}</td>
                    <td>
                      <StatusBadge tone={getOfferTone(row.statusValue)}>{row.status}</StatusBadge>
                    </td>
                    <td>{row.expirationAt || "—"}</td>
                    <td>{row.documentReadiness}</td>
                    <td>{row.signatureReadiness}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScrollArea>
        </div>
      ) : null}
    </section>
  );
}
