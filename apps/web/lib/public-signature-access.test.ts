import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeSignatureField, PublicSignatureRequestSnapshot } from "@acre/db";
import { canRecipientEditField, validateRecipientFieldSubmission } from "./public-signature-access.ts";
import type { SubmittedSignatureFieldValue } from "./signature-pdf.ts";

type PublicRecipient = PublicSignatureRequestSnapshot["request"]["recipients"][number];

function buildRecipient(overrides: Partial<PublicRecipient>): PublicRecipient {
  return {
    id: overrides.id ?? "recipient-1",
    roleKey: overrides.roleKey ?? "signer",
    role: overrides.role ?? "Signer",
    name: overrides.name ?? "Signer One",
    email: overrides.email ?? "signer1@example.com",
    recipientRole: overrides.recipientRole ?? "Signer",
    routingStep: overrides.routingStep ?? 1,
    sortOrder: overrides.sortOrder ?? 0,
    statusKey: overrides.statusKey ?? "sent",
    status: overrides.status ?? "Sent",
    sentAt: overrides.sentAt ?? "",
    firstViewedAt: overrides.firstViewedAt ?? "",
    viewedAt: overrides.viewedAt ?? "",
    actedAt: overrides.actedAt ?? "",
    declinedAt: overrides.declinedAt ?? "",
    tokenIssued: overrides.tokenIssued ?? true
  };
}

function buildField(overrides: Partial<OfficeSignatureField>): OfficeSignatureField {
  return {
    id: overrides.id ?? "field-1",
    signatureRequestId: overrides.signatureRequestId ?? "request-1",
    assignedRecipientId: overrides.assignedRecipientId ?? null,
    fieldType: overrides.fieldType ?? "signature",
    label: overrides.label ?? "Signature",
    page: overrides.page ?? 1,
    x: overrides.x ?? 0.1,
    y: overrides.y ?? 0.1,
    width: overrides.width ?? 0.2,
    height: overrides.height ?? 0.08,
    required: overrides.required ?? true,
    defaultValue: overrides.defaultValue ?? "",
    fontStyle: overrides.fontStyle ?? "",
    fieldKey: overrides.fieldKey ?? "",
    isReadOnly: overrides.isReadOnly ?? false,
    isSystemPrefilled: overrides.isSystemPrefilled ?? false,
    visibilityRule: overrides.visibilityRule ?? {},
    mirrorGroup: overrides.mirrorGroup ?? "",
    fieldOptions: overrides.fieldOptions ?? {},
    sortOrder: overrides.sortOrder ?? 0
  };
}

test("canRecipientEditField only unlocks assigned fields for multi-recipient requests", () => {
  const recipients = [buildRecipient({ id: "recipient-a" }), buildRecipient({ id: "recipient-b", sortOrder: 1, email: "signer2@example.com" })];
  const editableField = buildField({ id: "field-a", assignedRecipientId: "recipient-a" });
  const lockedField = buildField({ id: "field-b", assignedRecipientId: "recipient-b" });

  assert.equal(
    canRecipientEditField({ fields: [editableField, lockedField], recipients, currentRecipientId: "recipient-a" }, editableField),
    true
  );
  assert.equal(
    canRecipientEditField({ fields: [editableField, lockedField], recipients, currentRecipientId: "recipient-a" }, lockedField),
    false
  );
});

test("canRecipientEditField keeps unassigned fields editable for single-recipient requests", () => {
  const recipients = [buildRecipient({ id: "recipient-a" })];
  const field = buildField({ id: "field-a", assignedRecipientId: null });

  assert.equal(canRecipientEditField({ fields: [field], recipients, currentRecipientId: "recipient-a" }, field), true);
});

test("validateRecipientFieldSubmission rejects unauthorized fields and missing required owned fields", () => {
  const recipients = [buildRecipient({ id: "recipient-a" }), buildRecipient({ id: "recipient-b", sortOrder: 1, email: "signer2@example.com" })];
  const fields = [
    buildField({ id: "field-a", label: "Buyer signature", assignedRecipientId: "recipient-a" }),
    buildField({ id: "field-b", label: "Seller signature", assignedRecipientId: "recipient-b" })
  ];
  const submittedValues: SubmittedSignatureFieldValue[] = [
    { fieldId: "field-b", fieldType: "signature", textValue: "Not allowed", signatureMode: "type" }
  ];

  const validation = validateRecipientFieldSubmission({
    fields,
    recipients,
    currentRecipientId: "recipient-a",
    submittedValues
  });

  assert.deepEqual(validation.unauthorizedFieldIds, ["field-b"]);
  assert.deepEqual(validation.missingRequiredFieldLabels, ["Buyer signature"]);
});

test("validateRecipientFieldSubmission accepts default-valued required text fields", () => {
  const recipients = [buildRecipient({ id: "recipient-a" })];
  const fields = [buildField({ id: "field-a", fieldType: "date", label: "Signed date", defaultValue: "2026-04-06" })];

  const validation = validateRecipientFieldSubmission({
    fields,
    recipients,
    currentRecipientId: "recipient-a",
    submittedValues: []
  });

  assert.deepEqual(validation.unauthorizedFieldIds, []);
  assert.deepEqual(validation.missingRequiredFieldLabels, []);
});
