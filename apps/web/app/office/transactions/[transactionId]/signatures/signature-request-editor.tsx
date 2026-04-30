"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckboxField, FormField, SelectInput, StatusBadge, TextInput, TextareaInput } from "@acre/ui";
import type {
  OfficeSignatureAuditEntry,
  OfficeSignatureField,
  OfficeSignatureRequest,
  OfficeSignatureTemplate,
  OfficeTransactionDocument
} from "@acre/db";
import { usePdfPreview } from "../../../../../components/signature/use-pdf-preview";

type SignatureRequestEditorProps = {
  transactionId: string;
  document: OfficeTransactionDocument;
  initialRequest: OfficeSignatureRequest | null;
  initialFields: OfficeSignatureField[];
  initialAuditEntries: OfficeSignatureAuditEntry[];
  defaultSenderDisplayName: string;
  defaultReplyTo: string;
  availableTemplates?: OfficeSignatureTemplate[];
  initialTemplate?: OfficeSignatureTemplate | null;
};

type SignatureDraftState = {
  recipients: SignatureRecipientDraft[];
  ccRecipients: SignatureRecipientDraft[];
  emailSubject: string;
  emailBody: string;
  expiresAt: string;
  senderDisplayName: string;
  senderReplyTo: string;
};

type SignatureRecipientDraft = {
  id: string;
  roleKey: "signer" | "approver" | "cc";
  name: string;
  email: string;
  recipientRole: string;
  routingStep: string;
  sortOrder: number;
};

type SignatureTemplateCategoryKey = "transaction" | "hr" | "finance" | "admin" | "project_sales";

type TemplateDraftState = {
  templateId: string;
  name: string;
  description: string;
  category: SignatureTemplateCategoryKey;
};

type SignatureEditorStep = "recipients" | "fields";

type FieldGestureState =
  | {
      mode: "move";
      fieldId: string;
      pageNumber: number;
      pointerOffsetX: number;
      pointerOffsetY: number;
    }
  | {
      mode: "resize";
      fieldId: string;
      pageNumber: number;
      startPointerX: number;
      startPointerY: number;
      startWidth: number;
      startHeight: number;
    };

const fieldDefaults: Record<OfficeSignatureField["fieldType"], { label: string; width: number; height: number; fontStyle?: string }> = {
  signature: { label: "Signature", width: 0.26, height: 0.08, fontStyle: "signature" },
  date: { label: "Date", width: 0.18, height: 0.05 },
  initials: { label: "Initials", width: 0.16, height: 0.05 },
  name: { label: "Full Name", width: 0.24, height: 0.05 },
  text: { label: "Text", width: 0.24, height: 0.06 },
  email: { label: "Email", width: 0.26, height: 0.05 },
  title: { label: "Title", width: 0.22, height: 0.05 },
  company: { label: "Company", width: 0.28, height: 0.05 },
  checkbox: { label: "Checkbox", width: 0.06, height: 0.04 },
  dropdown: { label: "Dropdown", width: 0.24, height: 0.05 }
};

const placementFieldTools: OfficeSignatureField["fieldType"][] = [
  "signature",
  "initials",
  "date",
  "name",
  "text",
  "email",
  "title",
  "company",
  "checkbox",
  "dropdown"
];

const minimumFieldWidth = 0.08;
const minimumFieldHeight = 0.04;
const fieldPadding = 0.02;
const fieldBoundary = 0.98;

function clampFieldMetric(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createRecipientDraft(
  roleKey: SignatureRecipientDraft["roleKey"],
  overrides: Partial<SignatureRecipientDraft> = {}
): SignatureRecipientDraft {
  return {
    id: overrides.id ?? `draft-recipient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roleKey,
    name: overrides.name ?? "",
    email: overrides.email ?? "",
    recipientRole: overrides.recipientRole ?? (roleKey === "approver" ? "Approver" : roleKey === "cc" ? "CC" : "Signer"),
    routingStep: overrides.routingStep ?? (roleKey === "cc" ? "" : "1"),
    sortOrder: overrides.sortOrder ?? 0
  };
}

function buildDraftState(
  document: OfficeTransactionDocument,
  request: OfficeSignatureRequest | null,
  template: OfficeSignatureTemplate | null,
  defaultSenderDisplayName: string,
  defaultReplyTo: string
): SignatureDraftState {
  const recipients =
    request?.recipients.filter((recipient) => recipient.roleKey !== "cc").map((recipient) =>
      createRecipientDraft(recipient.roleKey === "approver" ? "approver" : "signer", {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        recipientRole: recipient.recipientRole,
        routingStep: String(recipient.routingStep),
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const ccRecipients =
    request?.ccRecipients.map((recipient) =>
      createRecipientDraft("cc", {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        recipientRole: recipient.recipientRole,
        routingStep: "",
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const fallbackRecipient =
    recipients[0] ??
    createRecipientDraft("signer", {
      name: request?.recipientName ?? "",
      email: request?.recipientEmail ?? "",
      recipientRole: request?.recipientRole ?? "Signer",
      routingStep: request?.signingOrder ? String(request.signingOrder) : "1",
      sortOrder: 0
    });

  const templateRecipients =
    template?.recipients.filter((recipient) => recipient.roleKey !== "cc").map((recipient) =>
      createRecipientDraft(recipient.roleKey === "approver" ? "approver" : "signer", {
        id: recipient.id,
        name: "",
        email: "",
        recipientRole: recipient.recipientRole,
        routingStep: String(recipient.routingStep),
        sortOrder: recipient.sortOrder
      })
    ) ?? [];
  const templateCcRecipients =
    template?.recipients.filter((recipient) => recipient.roleKey === "cc").map((recipient) =>
      createRecipientDraft("cc", {
        id: recipient.id,
        name: "",
        email: "",
        recipientRole: recipient.recipientRole,
        routingStep: "",
        sortOrder: recipient.sortOrder
      })
    ) ?? [];

  return {
    recipients: recipients.length > 0 ? recipients : templateRecipients.length > 0 ? templateRecipients : [fallbackRecipient],
    ccRecipients: ccRecipients.length > 0 ? ccRecipients : templateCcRecipients,
    emailSubject: request?.emailSubject ?? template?.emailSubject ?? `Signature requested: ${document.title}`,
    emailBody:
      request?.emailBody ?? template?.emailBody ?? `${defaultSenderDisplayName} sent you a document to review and sign in Acre.`,
    expiresAt: request?.expiresAt ? request.expiresAt.slice(0, 10) : "",
    senderDisplayName: request?.senderDisplayName || template?.senderDisplayName || defaultSenderDisplayName,
    senderReplyTo: request?.senderReplyTo || template?.senderReplyTo || defaultReplyTo
  };
}

function buildTemplateDraftState(template: OfficeSignatureTemplate | null): TemplateDraftState {
  return {
    templateId: template?.id ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    category: template?.category ?? "transaction"
  };
}

function mapTemplateFieldToSignatureField(templateField: OfficeSignatureTemplate["fields"][number]): OfficeSignatureField {
  return {
    id: `template-field-${templateField.id}`,
    signatureRequestId: "",
    assignedRecipientId: templateField.assignedTemplateRecipientId || null,
    fieldType: templateField.fieldType,
    label: templateField.label,
    page: templateField.page,
    x: templateField.x,
    y: templateField.y,
    width: templateField.width,
    height: templateField.height,
    required: templateField.required,
    defaultValue: templateField.defaultValue,
    fontStyle: templateField.fontStyle,
    fieldKey: templateField.fieldKey,
    isReadOnly: templateField.isReadOnly,
    isSystemPrefilled: templateField.isSystemPrefilled,
    visibilityRule: templateField.visibilityRule,
    mirrorGroup: templateField.mirrorGroup,
    fieldOptions: templateField.fieldOptions,
    sortOrder: templateField.sortOrder
  };
}

function getRequestTone(statusKey: OfficeSignatureRequest["statusKey"]) {
  if (statusKey === "completed") {
    return "success" as const;
  }

  if (statusKey === "canceled" || statusKey === "declined" || statusKey === "expired" || statusKey === "voided") {
    return "danger" as const;
  }

  if (statusKey === "pending_send" || statusKey === "sent" || statusKey === "viewed" || statusKey === "signed") {
    return "accent" as const;
  }

  return "neutral" as const;
}

function isRecipientRowComplete(recipient: SignatureRecipientDraft) {
  return Boolean(recipient.name.trim() && recipient.email.trim() && recipient.recipientRole.trim());
}

function getRecipientBindingSummary(recipient: SignatureRecipientDraft | null) {
  if (!recipient) {
    return {
      badge: "Unassigned",
      detail: "Select a signer or approver"
    };
  }

  return {
    badge: `${recipient.roleKey === "approver" ? "Approver" : "Signer"} · Step ${recipient.routingStep || "1"}`,
    detail: recipient.name || recipient.email || recipient.recipientRole || "Recipient"
  };
}

export function SignatureRequestEditor({
  transactionId,
  document,
  initialRequest,
  initialFields,
  initialAuditEntries,
  defaultSenderDisplayName,
  defaultReplyTo,
  availableTemplates = [],
  initialTemplate = null
}: SignatureRequestEditorProps) {
  const router = useRouter();
  const { pages, isLoading, error: previewError } = usePdfPreview(document.storageUrl);
  const [requestId, setRequestId] = useState(initialRequest?.id ?? "");
  const [requestStatus, setRequestStatus] = useState<OfficeSignatureRequest["statusKey"]>(initialRequest?.statusKey ?? "draft");
  const [draftState, setDraftState] = useState<SignatureDraftState>(
    buildDraftState(document, initialRequest, initialTemplate, defaultSenderDisplayName, defaultReplyTo)
  );
  const [fields, setFields] = useState<OfficeSignatureField[]>(
    initialFields.length > 0 ? initialFields : initialTemplate?.fields.map(mapTemplateFieldToSignatureField) ?? []
  );
  const [auditEntries] = useState<OfficeSignatureAuditEntry[]>(initialAuditEntries);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraftState>(() => buildTemplateDraftState(initialTemplate));
  const [selectedTool, setSelectedTool] = useState<OfficeSignatureField["fieldType"]>("signature");
  const [selectedFieldId, setSelectedFieldId] = useState<string>(initialFields[0]?.id ?? "");
  const [activeGesture, setActiveGesture] = useState<FieldGestureState | null>(null);
  const [activeStep, setActiveStep] = useState<SignatureEditorStep>(initialRequest ? "fields" : "recipients");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const previewCanvasRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const fieldsRef = useRef(fields);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );
  const recipientLookup = useMemo(
    () => new Map(draftState.recipients.map((recipient) => [recipient.id, recipient])),
    [draftState.recipients]
  );

  const actionableRecipients = draftState.recipients;
  const canAccessFieldStep = Boolean(requestId);
  const isRecipientsStep = activeStep === "recipients";
  const isFieldsStep = activeStep === "fields";

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    if (!requestId && activeStep !== "recipients") {
      setActiveStep("recipients");
    }
  }, [activeStep, requestId]);

  useEffect(() => {
    if (!activeGesture) {
      return;
    }

    const gesture = activeGesture;

    function handlePointerMove(event: PointerEvent) {
      const previewCanvas = previewCanvasRefs.current[gesture.pageNumber];
      const field = fieldsRef.current.find((entry) => entry.id === gesture.fieldId);

      if (!previewCanvas || !field || field.page !== gesture.pageNumber) {
        return;
      }

      const bounds = previewCanvas.getBoundingClientRect();
      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;

      if (gesture.mode === "move") {
        updateField(gesture.fieldId, {
          x: clampFieldMetric(relativeX - gesture.pointerOffsetX, fieldPadding, fieldBoundary - field.width),
          y: clampFieldMetric(relativeY - gesture.pointerOffsetY, fieldPadding, fieldBoundary - field.height)
        });
        return;
      }

      updateField(gesture.fieldId, {
        width: clampFieldMetric(
          gesture.startWidth + (relativeX - gesture.startPointerX),
          minimumFieldWidth,
          fieldBoundary - field.x
        ),
        height: clampFieldMetric(
          gesture.startHeight + (relativeY - gesture.startPointerY),
          minimumFieldHeight,
          fieldBoundary - field.y
        )
      });
    }

    function handlePointerUp() {
      setActiveGesture(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeGesture]);

  function openStep(step: SignatureEditorStep) {
    if (step === "fields" && !canAccessFieldStep) {
      return;
    }

    setActiveStep(step);
    setError("");
    setSuccessMessage("");
  }

  function updateDraftField(field: Exclude<keyof SignatureDraftState, "recipients" | "ccRecipients">, value: string) {
    setDraftState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateRecipient(
    collection: "recipients" | "ccRecipients",
    recipientId: string,
    field: keyof SignatureRecipientDraft,
    value: string
  ) {
    setDraftState((current) => ({
      ...current,
      [collection]: current[collection].map((recipient) =>
        recipient.id === recipientId
          ? {
              ...recipient,
              [field]: value
            }
          : recipient
      )
    }));
  }

  function addRecipient(roleKey: SignatureRecipientDraft["roleKey"]) {
    setDraftState((current) => {
      const collection = roleKey === "cc" ? "ccRecipients" : "recipients";
      const nextRecipient = createRecipientDraft(roleKey, {
        sortOrder: current.recipients.length + current.ccRecipients.length,
        routingStep: roleKey === "cc" ? "" : String(Math.max(1, current.recipients.length + 1))
      });

      return {
        ...current,
        [collection]: [...current[collection], nextRecipient]
      };
    });
  }

  function removeRecipient(collection: "recipients" | "ccRecipients", recipientId: string) {
    setDraftState((current) => {
      const nextRecipients = current[collection].filter((recipient) => recipient.id !== recipientId);
      const fallbackOwnerId = (collection === "recipients" ? nextRecipients : current.recipients)[0]?.id ?? null;

      setFields((existingFields) =>
        existingFields.map((field) =>
          field.assignedRecipientId === recipientId
            ? {
                ...field,
                assignedRecipientId: fallbackOwnerId
              }
            : field
        )
      );

      return {
        ...current,
        [collection]: collection === "recipients" && nextRecipients.length === 0 ? [createRecipientDraft("signer")] : nextRecipients
      };
    });
  }

  function updateField(fieldId: string, changes: Partial<OfficeSignatureField>) {
    setFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...changes
            }
          : field
      )
    );
  }

  function handleAddField(pageNumber: number, event: React.MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest(".office-signature-field-token")) {
      return;
    }

    const currentTarget = event.currentTarget;
    const bounds = currentTarget.getBoundingClientRect();
    const defaults = fieldDefaults[selectedTool];
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nextField: OfficeSignatureField = {
      id,
      signatureRequestId: requestId,
      assignedRecipientId: actionableRecipients[0]?.id ?? null,
      fieldType: selectedTool,
      label: defaults.label,
      page: pageNumber,
      x: clampFieldMetric(relativeX - defaults.width / 2, fieldPadding, fieldBoundary - defaults.width),
      y: clampFieldMetric(relativeY - defaults.height / 2, fieldPadding, fieldBoundary - defaults.height),
      width: defaults.width,
      height: defaults.height,
      required: true,
      defaultValue: selectedTool === "date" ? new Date().toISOString().slice(0, 10) : "",
      fontStyle: defaults.fontStyle ?? "",
      fieldKey: "",
      isReadOnly: false,
      isSystemPrefilled: false,
      visibilityRule: {},
      mirrorGroup: "",
      fieldOptions: {},
      sortOrder: fields.length
    };

    setFields((current) => [...current, nextField]);
    setSelectedFieldId(id);
    setSuccessMessage("");
  }

  function handleFieldPointerDown(fieldId: string, pageNumber: number, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setSelectedFieldId(fieldId);
    const previewCanvas = previewCanvasRefs.current[pageNumber];
    const field = fieldsRef.current.find((entry) => entry.id === fieldId);

    if (!previewCanvas || !field) {
      return;
    }

    const bounds = previewCanvas.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width;
    const relativeY = (event.clientY - bounds.top) / bounds.height;

    setActiveGesture({
      mode: "move",
      fieldId,
      pageNumber,
      pointerOffsetX: relativeX - field.x,
      pointerOffsetY: relativeY - field.y
    });
  }

  function handleResizePointerDown(fieldId: string, pageNumber: number, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    setSelectedFieldId(fieldId);
    const previewCanvas = previewCanvasRefs.current[pageNumber];
    const field = fieldsRef.current.find((entry) => entry.id === fieldId);

    if (!previewCanvas || !field) {
      return;
    }

    const bounds = previewCanvas.getBoundingClientRect();
    setActiveGesture({
      mode: "resize",
      fieldId,
      pageNumber,
      startPointerX: (event.clientX - bounds.left) / bounds.width,
      startPointerY: (event.clientY - bounds.top) / bounds.height,
      startWidth: field.width,
      startHeight: field.height
    });
  }

  function setPreviewCanvasRef(pageNumber: number, node: HTMLDivElement | null) {
    previewCanvasRefs.current[pageNumber] = node;
  }

  function removeField(fieldId: string) {
    setFields((current) => current.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) => (current === fieldId ? "" : current));
  }

  function validateRecipients() {
    const incompleteRecipient = draftState.recipients.find((recipient) => !isRecipientRowComplete(recipient));

    if (incompleteRecipient) {
      throw new Error("Complete every signer or approver row before continuing.");
    }

    const invalidRoutingStepRecipient = draftState.recipients.find((recipient) => {
      const routingStep = Number(recipient.routingStep || "0");
      return !Number.isFinite(routingStep) || routingStep < 1;
    });

    if (invalidRoutingStepRecipient) {
      throw new Error("Each signer or approver needs a routing step of 1 or greater.");
    }

    const incompleteCcRecipient = draftState.ccRecipients.find((recipient) => !recipient.name.trim() || !recipient.email.trim());

    if (incompleteCcRecipient) {
      throw new Error("Complete every CC recipient row before saving.");
    }

    const validRecipients = draftState.recipients.filter(isRecipientRowComplete);

    if (!validRecipients.length) {
      throw new Error("At least one signer or approver is required.");
    }

    return validRecipients;
  }

  function buildRecipientIdMap(previousRecipientDrafts: SignatureRecipientDraft[], nextRequest: OfficeSignatureRequest) {
    const recipientIdMap = new Map<string, string>();

    for (const draftRecipient of previousRecipientDrafts) {
      const matchedRecipient = [...nextRequest.recipients, ...nextRequest.ccRecipients].find(
        (recipient) =>
          recipient.sortOrder === draftRecipient.sortOrder &&
          recipient.roleKey === draftRecipient.roleKey &&
          recipient.email.trim().toLowerCase() === draftRecipient.email.trim().toLowerCase()
      );

      if (matchedRecipient) {
        recipientIdMap.set(draftRecipient.id, matchedRecipient.id);
      }
    }

    return recipientIdMap;
  }

  async function persistSignatureRequest(options: {
    action: "save-recipients" | "save-fields" | "send";
    requireFields: boolean;
    continueToFieldStep?: boolean;
    successMessage: string;
  }) {
    let validRecipients: SignatureRecipientDraft[];

    try {
      validRecipients = validateRecipients();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Signature request could not be saved.");
      return;
    }

    if (options.requireFields && !fields.length) {
      setError("Add at least one signature field before saving this step.");
      return;
    }

    if (options.requireFields && validRecipients.length > 1 && fields.some((field) => !field.assignedRecipientId)) {
      setError("Assign every field to a specific signer or approver before saving a multi-recipient request.");
      return;
    }

    const shouldSend = options.action === "send";

    setPendingAction(options.action);
    setError("");
    setSuccessMessage("");

    try {
      const previousRecipientDrafts = [...draftState.recipients, ...draftState.ccRecipients];
      const primaryRecipient = validRecipients[0]!;
      const requestResponse = await fetch(`/api/office/transactions/${transactionId}/signatures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signatureRequestId: requestId || null,
          documentId: document.id,
          recipientName: primaryRecipient.name,
          recipientEmail: primaryRecipient.email,
          recipientRole: primaryRecipient.recipientRole,
          recipients: draftState.recipients.map((recipient, index) => ({
            id: recipient.id,
            role: recipient.roleKey,
            name: recipient.name,
            email: recipient.email,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.roleKey === "cc" ? null : Number(recipient.routingStep || "1"),
            sortOrder: index
          })),
          ccRecipients: draftState.ccRecipients.map((recipient, index) => ({
            id: recipient.id,
            role: "cc",
            name: recipient.name,
            email: recipient.email,
            recipientRole: recipient.recipientRole,
            routingStep: null,
            sortOrder: draftState.recipients.length + index
          })),
          emailSubject: draftState.emailSubject,
          emailBody: draftState.emailBody,
          expiresAt: draftState.expiresAt || null,
          senderDisplayName: draftState.senderDisplayName,
          senderReplyTo: draftState.senderReplyTo
        })
      });

      const requestPayload = (await requestResponse.json().catch(() => null)) as
        | { error?: string; signatureRequest?: OfficeSignatureRequest }
        | null;

      if (!requestResponse.ok || !requestPayload?.signatureRequest) {
        throw new Error(requestPayload?.error ?? "Signature draft could not be saved.");
      }

      const nextRequest = requestPayload.signatureRequest;
      const nextRequestId = nextRequest.id;
      const recipientIdMap = buildRecipientIdMap(previousRecipientDrafts, nextRequest);

      setRequestId(nextRequestId);
      setRequestStatus(nextRequest.statusKey);
      setDraftState(buildDraftState(document, nextRequest, initialTemplate, defaultSenderDisplayName, defaultReplyTo));

      if (fields.length > 0) {
        const fieldsResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}/fields`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: fields.map((field, index) => ({
              ...field,
              assignedRecipientId: field.assignedRecipientId
                ? recipientIdMap.get(field.assignedRecipientId) ?? field.assignedRecipientId
                : null,
              sortOrder: index
            }))
          })
        });

        const fieldsPayload = (await fieldsResponse.json().catch(() => null)) as
          | { error?: string; fields?: OfficeSignatureField[] }
          | null;

        if (!fieldsResponse.ok || !fieldsPayload?.fields) {
          throw new Error(fieldsPayload?.error ?? "Signature fields could not be saved.");
        }

        setFields(fieldsPayload.fields);
      }

      if (shouldSend) {
        const sendResponse = await fetch(`/api/office/transactions/${transactionId}/signatures/${nextRequestId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action:
              requestStatus === "sent" ||
              requestStatus === "viewed" ||
              requestStatus === "expired" ||
              requestStatus === "voided" ||
              requestStatus === "canceled" ||
              requestStatus === "signed"
                ? "resend"
                : "send"
          })
        });

        const sendPayload = (await sendResponse.json().catch(() => null)) as
          | { error?: string; signatureRequest?: OfficeSignatureRequest }
          | null;

        if (!sendResponse.ok || !sendPayload?.signatureRequest) {
          throw new Error(sendPayload?.error ?? "Signature email could not be sent.");
        }

        setRequestStatus(sendPayload.signatureRequest.statusKey);
      }

      if (!requestId) {
        router.replace(`/office/transactions/${transactionId}/signatures/${nextRequestId}`);
      } else if (options.continueToFieldStep) {
        setActiveStep("fields");
      }

      setSuccessMessage(options.successMessage);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Signature draft could not be saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveDraft(sendAfterSave: boolean) {
    await persistSignatureRequest({
      action: sendAfterSave ? "send" : "save-fields",
      requireFields: true,
      successMessage: sendAfterSave ? "Signature request email sent." : "Signature field layout saved."
    });
  }

  async function handleRequestAction(action: "canceled" | "expire" | "resend") {
    if (!requestId) {
      return;
    }

    setPendingAction(action);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/office/transactions/${transactionId}/signatures/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; signatureRequest?: OfficeSignatureRequest }
        | null;

      if (!response.ok || !payload?.signatureRequest) {
        throw new Error(payload?.error ?? "Signature request update failed.");
      }

      setRequestStatus(payload.signatureRequest.statusKey);
      setSuccessMessage(
        action === "resend"
          ? "Signature request email resent."
          : action === "expire"
            ? "Signature request marked expired."
            : "Signature request canceled."
      );
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Signature request update failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTemplate() {
    if (!templateDraft.name.trim()) {
      setError("Template name is required before saving.");
      return;
    }

    if (draftState.recipients.length === 0 || fields.length === 0) {
      setError("Add recipients and fields before saving this request as a template.");
      return;
    }

    setPendingAction("save-template");
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/office/signatures/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: templateDraft.templateId || null,
          name: templateDraft.name,
          description: templateDraft.description,
          category: templateDraft.category,
          isActive: true,
          emailSubject: draftState.emailSubject,
          emailBody: draftState.emailBody,
          senderDisplayName: draftState.senderDisplayName,
          senderReplyTo: draftState.senderReplyTo,
          recipients: [
            ...draftState.recipients.map((recipient, index) => ({
              id: recipient.id,
              role: recipient.roleKey,
              recipientRole: recipient.recipientRole,
              routingStep: Number(recipient.routingStep || "1"),
              sortOrder: index
            })),
            ...draftState.ccRecipients.map((recipient, index) => ({
              id: recipient.id,
              role: "cc",
              recipientRole: recipient.recipientRole,
              routingStep: 0,
              sortOrder: draftState.recipients.length + index
            }))
          ],
          fields: fields.map((field, index) => ({
            assignedTemplateRecipientId: field.assignedRecipientId,
            fieldType: field.fieldType,
            label: field.label,
            page: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required,
            defaultValue: field.defaultValue,
            fontStyle: field.fontStyle,
            fieldKey: field.fieldKey,
            isReadOnly: field.isReadOnly,
            isSystemPrefilled: field.isSystemPrefilled,
            visibilityRule: field.visibilityRule,
            mirrorGroup: field.mirrorGroup,
            fieldOptions: field.fieldOptions,
            sortOrder: index
          }))
        })
      });

      const payload = (await response.json().catch(() => null)) as { template?: OfficeSignatureTemplate; error?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.error ?? "Signature template could not be saved.");
      }

      setTemplateDraft({
        templateId: payload.template.id,
        name: payload.template.name,
        description: payload.template.description,
        category: payload.template.category
      });
      setSuccessMessage("Signature template saved.");
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Signature template could not be saved.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleTemplateSelection(templateId: string) {
    const query = new URLSearchParams({
      documentId: document.id
    });

    if (templateId) {
      query.set("templateId", templateId);
    }

    router.push(`/office/transactions/${transactionId}/signatures/new?${query.toString()}`);
  }

  return (
    <div className="office-signature-editor">
      <div className="office-signature-editor-main">
        <section className="office-detail-card office-signature-stepper-card">
          <div className="office-card-head">
            <div>
              <h3>Signature request workflow</h3>
              <span>Save the recipients first, then place each signature field on the PDF and bind it to the correct signer.</span>
            </div>
            {requestId ? <StatusBadge tone={getRequestTone(requestStatus)}>{requestStatus}</StatusBadge> : null}
          </div>

          <div className="office-signature-stepper">
            <button
              className={`office-signature-step${isRecipientsStep ? " is-active" : ""}${requestId ? " is-complete" : ""}`}
              onClick={() => openStep("recipients")}
              type="button"
            >
              <span className="office-signature-step-index">Step 1</span>
              <strong>Recipients and delivery</strong>
              <span>Choose signers, approvers, CC recipients, routing steps, and invitation copy.</span>
            </button>

            <button
              className={`office-signature-step${isFieldsStep ? " is-active" : ""}${canAccessFieldStep ? "" : " is-locked"}`}
              disabled={!canAccessFieldStep}
              onClick={() => openStep("fields")}
              type="button"
            >
              <span className="office-signature-step-index">Step 2</span>
              <strong>PDF field placement</strong>
              <span>Place the fields on the PDF and assign every field to one signer or approver.</span>
            </button>
          </div>

          {!canAccessFieldStep ? (
            <p className="office-signature-helper">
              Save Step 1 first. Once the request exists, Step 2 unlocks and every signature field can be assigned to the right signer.
            </p>
          ) : null}
        </section>

        {isRecipientsStep ? (
          <>
            <section className="office-detail-card">
              <div className="office-card-head">
                <div>
                  <h3>Step 1 · Recipients and delivery</h3>
                  <span>Configure the participants first. After saving this step, the PDF field placement stage unlocks.</span>
                </div>
              </div>

              <div className="office-signature-summary-list">
                <p>
                  <strong>Actionable recipients</strong>
                </p>
                {draftState.recipients.map((recipient) => (
                  <p key={recipient.id}>
                    {recipient.roleKey === "approver" ? "Approver" : "Signer"} · Step {recipient.routingStep || "1"} · {recipient.name || "New recipient"}
                  </p>
                ))}
                {draftState.ccRecipients.length > 0 ? (
                  <p>
                    <strong>CC recipients</strong> · {draftState.ccRecipients.length}
                  </p>
                ) : null}
              </div>

              <div className="office-signature-section-actions office-signature-add-actions">
                <Button onClick={() => addRecipient("signer")} variant="secondary">
                  Add signer
                </Button>
                <Button onClick={() => addRecipient("approver")} variant="secondary">
                  Add approver
                </Button>
                <Button onClick={() => addRecipient("cc")} variant="secondary">
                  Add CC
                </Button>
              </div>

              <div className="office-signature-audit-list">
                {draftState.recipients.map((recipient) => (
                  <article className="office-signature-audit-row" key={recipient.id}>
                    <div className="office-signature-audit-head">
                      <strong>{recipient.roleKey === "approver" ? "Approver" : "Signer"}</strong>
                      <span>Step {recipient.routingStep || "1"}</span>
                    </div>
                    <div className="office-signature-recipient-grid">
                      <FormField label="Role">
                        <SelectInput
                          onChange={(event) =>
                            updateRecipient("recipients", recipient.id, "roleKey", event.target.value as SignatureRecipientDraft["roleKey"])
                          }
                          value={recipient.roleKey}
                        >
                          <option value="signer">Signer</option>
                          <option value="approver">Approver</option>
                        </SelectInput>
                      </FormField>
                      <FormField label="Name">
                        <TextInput onChange={(event) => updateRecipient("recipients", recipient.id, "name", event.target.value)} value={recipient.name} />
                      </FormField>
                      <FormField label="Email">
                        <TextInput
                          onChange={(event) => updateRecipient("recipients", recipient.id, "email", event.target.value)}
                          type="email"
                          value={recipient.email}
                        />
                      </FormField>
                      <FormField label="Recipient role">
                        <TextInput
                          onChange={(event) => updateRecipient("recipients", recipient.id, "recipientRole", event.target.value)}
                          value={recipient.recipientRole}
                        />
                      </FormField>
                      <FormField label="Routing step">
                        <TextInput
                          inputMode="numeric"
                          onChange={(event) => updateRecipient("recipients", recipient.id, "routingStep", event.target.value)}
                          value={recipient.routingStep}
                        />
                      </FormField>
                    </div>
                    <div className="office-signature-recipient-actions">
                      <Button onClick={() => removeRecipient("recipients", recipient.id)} size="sm" variant="danger">
                        Remove
                      </Button>
                    </div>
                  </article>
                ))}

                {draftState.ccRecipients.map((recipient) => (
                  <article className="office-signature-audit-row" key={recipient.id}>
                    <div className="office-signature-audit-head">
                      <strong>CC</strong>
                      <span>Read-only copy</span>
                    </div>
                    <div className="office-signature-recipient-grid">
                      <FormField label="Name">
                        <TextInput onChange={(event) => updateRecipient("ccRecipients", recipient.id, "name", event.target.value)} value={recipient.name} />
                      </FormField>
                      <FormField label="Email">
                        <TextInput
                          onChange={(event) => updateRecipient("ccRecipients", recipient.id, "email", event.target.value)}
                          type="email"
                          value={recipient.email}
                        />
                      </FormField>
                      <FormField label="Recipient role">
                        <TextInput
                          onChange={(event) => updateRecipient("ccRecipients", recipient.id, "recipientRole", event.target.value)}
                          value={recipient.recipientRole}
                        />
                      </FormField>
                    </div>
                    <div className="office-signature-recipient-actions">
                      <Button onClick={() => removeRecipient("ccRecipients", recipient.id)} size="sm" variant="danger">
                        Remove
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="office-document-upload-grid">
                <FormField label="Expires on">
                  <TextInput onChange={(event) => updateDraftField("expiresAt", event.target.value)} type="date" value={draftState.expiresAt} />
                </FormField>
                <FormField className="office-form-grid-span-2" label="Email subject">
                  <TextInput onChange={(event) => updateDraftField("emailSubject", event.target.value)} value={draftState.emailSubject} />
                </FormField>
                <FormField className="office-form-grid-span-2" label="Sender display name">
                  <TextInput onChange={(event) => updateDraftField("senderDisplayName", event.target.value)} value={draftState.senderDisplayName} />
                </FormField>
                <FormField
                  className="office-form-grid-span-2"
                  helper="Replies to the invitation email go to this address, and the finalized signed PDF notification is also copied here alongside all signature participants."
                  label="Reply-to email"
                >
                  <TextInput onChange={(event) => updateDraftField("senderReplyTo", event.target.value)} type="email" value={draftState.senderReplyTo} />
                </FormField>
                <FormField className="office-form-grid-span-4" label="Email body">
                  <TextareaInput onChange={(event) => updateDraftField("emailBody", event.target.value)} rows={5} value={draftState.emailBody} />
                </FormField>
              </div>

              <div className="office-signature-section-actions">
                <Button
                  disabled={pendingAction === "save-recipients"}
                  onClick={() =>
                    persistSignatureRequest({
                      action: "save-recipients",
                      requireFields: false,
                      continueToFieldStep: true,
                      successMessage: "Recipients saved. Continue to PDF field placement."
                    })
                  }
                >
                  {pendingAction === "save-recipients" ? "Saving..." : "Save recipients & continue"}
                </Button>
              </div>
            </section>

            <section className="office-detail-card office-signature-delivery-card">
              <div className="office-card-head">
                <div>
                  <h3>Template library</h3>
                  <span>Load a saved template into this document or save the current recipient and field map as a reusable template.</span>
                </div>
              </div>

              <div className="office-document-upload-grid">
                <FormField label="Apply template">
                  <SelectInput onChange={(event) => handleTemplateSelection(event.target.value)} value={initialTemplate?.id ?? ""}>
                    <option value="">No template</option>
                    {availableTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.categoryLabel}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Template name">
                  <TextInput
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                    value={templateDraft.name}
                  />
                </FormField>
                <FormField label="Template category">
                  <SelectInput
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        category: event.target.value as TemplateDraftState["category"]
                      }))
                    }
                    value={templateDraft.category}
                  >
                    <option value="transaction">Transaction</option>
                    <option value="hr">HR</option>
                    <option value="finance">Finance</option>
                    <option value="admin">Admin</option>
                    <option value="project_sales">Project sales</option>
                  </SelectInput>
                </FormField>
                <FormField className="office-form-grid-span-4" label="Template description">
                  <TextareaInput
                    onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    value={templateDraft.description}
                  />
                </FormField>
              </div>

              <div className="office-signature-section-actions">
                <Button disabled={pendingAction === "save-template"} onClick={handleSaveTemplate} variant="secondary">
                  {pendingAction === "save-template" ? "Saving template..." : templateDraft.templateId ? "Update template" : "Save as template"}
                </Button>
              </div>
            </section>
          </>
        ) : (
          <section className="office-detail-card office-signature-template-card">
            <div className="office-card-head">
              <div>
                <h3>Step 2 · PDF field placement</h3>
                <span>Select a field type, place it on the PDF, then assign that field to the signer or approver who should complete it.</span>
              </div>
              <StatusBadge tone={getRequestTone(requestStatus)}>{requestStatus}</StatusBadge>
            </div>

            <div className="office-signature-step-banner">
              <p>
                Every signature position must be bound to a specific signer. Other recipients cannot sign or type into a field that is assigned to
                someone else.
              </p>
              <Button onClick={() => openStep("recipients")} variant="secondary">
                Back to Step 1
              </Button>
            </div>

            <div className="office-signature-toolbar">
              {placementFieldTools.map((fieldType) => (
                <button
                  className={`office-toggle-link${selectedTool === fieldType ? " is-active" : ""}`}
                  key={fieldType}
                  onClick={() => setSelectedTool(fieldType)}
                  type="button"
                >
                  {fieldDefaults[fieldType].label}
                </button>
              ))}
            </div>

            {isLoading ? <p className="office-signature-helper">Loading PDF preview…</p> : null}
            {previewError ? <p className="office-form-error">{previewError}</p> : null}

            <div className="office-signature-preview-stack">
              {pages.map((page) => (
                <div className="office-signature-preview-page" key={page.pageNumber}>
                  <div className="office-signature-preview-label">Page {page.pageNumber}</div>
                  <div
                    className="office-signature-preview-canvas"
                    onClick={(event) => handleAddField(page.pageNumber, event)}
                    ref={(node) => setPreviewCanvasRef(page.pageNumber, node)}
                  >
                    <img alt={`Document page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
                    {fields
                      .filter((field) => field.page === page.pageNumber)
                      .map((field) => {
                        const assignedRecipient = field.assignedRecipientId ? recipientLookup.get(field.assignedRecipientId) ?? null : null;
                        const bindingSummary = getRecipientBindingSummary(assignedRecipient);

                        return (
                          <div
                            className={`office-signature-field-token${selectedFieldId === field.id ? " is-selected" : ""}`}
                            key={field.id}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => handleFieldPointerDown(field.id, page.pageNumber, event)}
                            style={{
                              left: `${field.x * 100}%`,
                              top: `${field.y * 100}%`,
                              width: `${field.width * 100}%`,
                              height: `${field.height * 100}%`
                            }}
                            title={`${bindingSummary.badge} · ${bindingSummary.detail}`}
                          >
                            <span className={`office-signature-field-assignee${assignedRecipient ? "" : " is-unassigned"}`}>
                              {bindingSummary.badge}
                            </span>
                            <span className="office-signature-field-token-label">{field.label}</span>
                            <span className="office-signature-field-token-detail">{bindingSummary.detail}</span>
                            {selectedFieldId === field.id ? (
                              <button
                                aria-label={`Resize ${field.label}`}
                                className="office-signature-field-resize-handle"
                                onClick={(event) => event.stopPropagation()}
                                onPointerDown={(event) => handleResizePointerDown(field.id, page.pageNumber, event)}
                                type="button"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            <div className="office-signature-section-actions">
              <Button disabled={pendingAction === "save-fields"} onClick={() => saveDraft(false)}>
                {pendingAction === "save-fields" ? "Saving..." : "Save field layout"}
              </Button>
              <Button disabled={pendingAction === "send"} onClick={() => saveDraft(true)}>
                {pendingAction === "send" ? "Sending..." : requestStatus === "sent" || requestStatus === "viewed" ? "Save & resend" : "Save & send"}
              </Button>
              {requestId ? (
                <>
                  <Button disabled={pendingAction === "resend"} onClick={() => handleRequestAction("resend")} variant="secondary">
                    {pendingAction === "resend" ? "Resending..." : "Resend"}
                  </Button>
                  <Button disabled={pendingAction === "canceled"} onClick={() => handleRequestAction("canceled")} variant="danger">
                    {pendingAction === "canceled" ? "Canceling..." : "Cancel"}
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <aside className="office-signature-editor-side">
        {isFieldsStep ? (
          <section className="office-detail-card">
            <div className="office-card-head">
              <div>
                <h3>Selected field</h3>
                <span>Bind this field to one signer, then refine the label, default value, and validation.</span>
              </div>
            </div>

            {selectedField ? (
              <div className="office-signature-field-panel">
                <div className="office-signature-field-grid">
                  <FormField className="office-signature-field-panel-span-2" label="Assigned recipient">
                    <SelectInput
                      onChange={(event) => updateField(selectedField.id, { assignedRecipientId: event.target.value || null })}
                      value={selectedField.assignedRecipientId ?? ""}
                    >
                      <option value="">Unassigned</option>
                      {draftState.recipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.roleKey === "approver" ? "Approver" : "Signer"} · Step {recipient.routingStep || "1"} ·{" "}
                          {recipient.name || recipient.email || recipient.recipientRole}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                  <FormField label="Label">
                    <TextInput onChange={(event) => updateField(selectedField.id, { label: event.target.value })} value={selectedField.label} />
                  </FormField>
                  <FormField label="Font style">
                    <TextInput onChange={(event) => updateField(selectedField.id, { fontStyle: event.target.value })} value={selectedField.fontStyle} />
                  </FormField>
                  <FormField label="Field key">
                    <TextInput onChange={(event) => updateField(selectedField.id, { fieldKey: event.target.value })} value={selectedField.fieldKey} />
                  </FormField>
                  <FormField className="office-signature-field-panel-span-2" label="Default value">
                    <TextInput onChange={(event) => updateField(selectedField.id, { defaultValue: event.target.value })} value={selectedField.defaultValue} />
                  </FormField>
                  <FormField label="Mirror group">
                    <TextInput onChange={(event) => updateField(selectedField.id, { mirrorGroup: event.target.value })} value={selectedField.mirrorGroup} />
                  </FormField>
                </div>

                <div className="office-signature-field-toggle-grid">
                  <CheckboxField className="office-signature-toggle-card" label="Required">
                    <input
                      checked={selectedField.required}
                      onChange={(event) => updateField(selectedField.id, { required: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                  <CheckboxField className="office-signature-toggle-card" label="Read-only">
                    <input
                      checked={selectedField.isReadOnly}
                      onChange={(event) => updateField(selectedField.id, { isReadOnly: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                  <CheckboxField className="office-signature-toggle-card" label="System prefilled">
                    <input
                      checked={selectedField.isSystemPrefilled}
                      onChange={(event) => updateField(selectedField.id, { isSystemPrefilled: event.target.checked })}
                      type="checkbox"
                    />
                  </CheckboxField>
                </div>

                <div className="office-signature-field-note">
                  <p className="office-signature-helper">
                    Drag the field to move it. Drag the handle in the bottom-right corner to resize it. Other signers cannot complete a field that is not
                    assigned to them.
                  </p>
                </div>

                <div className="office-signature-section-actions office-signature-field-actions">
                  <Button onClick={() => removeField(selectedField.id)} size="sm" variant="danger">
                    Delete field
                  </Button>
                </div>
              </div>
            ) : (
              <p className="office-signature-helper">Select a field on the PDF to edit its recipient binding and settings.</p>
            )}
          </section>
        ) : (
          <section className="office-detail-card">
            <div className="office-card-head">
              <div>
                <h3>Step 2 preview</h3>
                <span>Once Step 1 is saved, you will place signature fields here and assign each one to a specific signer.</span>
              </div>
            </div>
            <p className="office-signature-helper">
              Multi-signer requests stay safe because each field is bound to one signer only. Unassigned signers will be blocked from someone else&apos;s
              signature position automatically.
            </p>
          </section>
        )}

        <section className="office-detail-card">
          <div className="office-card-head">
            <div>
              <h3>Document</h3>
              <span>{document.documentType}</span>
            </div>
          </div>

          <div className="office-signature-summary-list">
            <p>
              <strong>{document.title}</strong>
            </p>
            <p>{document.fileName}</p>
            <p>{(document.fileSizeBytes / 1024).toFixed(1)} KB</p>
            <p>
              <Link href={document.storageUrl} target="_blank">
                Open original PDF
              </Link>
            </p>
            {initialRequest?.completedDocumentHref ? (
              <p>
                <Link href={initialRequest.completedDocumentHref} target="_blank">
                  Download signed PDF
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="office-detail-card">
          <div className="office-card-head">
            <div>
              <h3>Audit trail</h3>
              <span>Internal and signer-side events are recorded here after the request is saved.</span>
            </div>
          </div>

          {auditEntries.length > 0 ? (
            <div className="office-signature-audit-list">
              {auditEntries.map((entry) => (
                <article className="office-signature-audit-row" key={entry.id}>
                  <div className="office-signature-audit-head">
                    <strong>{entry.eventLabel}</strong>
                    <span>{entry.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <p>{entry.actorLabel}</p>
                  {entry.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p className="office-signature-helper">The audit trail starts once the request has been saved.</p>
          )}
        </section>

        {error ? <p className="office-form-error">{error}</p> : null}
        {successMessage ? <p className="office-inline-success">{successMessage}</p> : null}
      </aside>
    </div>
  );
}
