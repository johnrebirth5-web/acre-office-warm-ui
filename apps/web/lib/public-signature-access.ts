import type { OfficeSignatureField, PublicSignatureRequestSnapshot } from "@acre/db";
import type { SubmittedSignatureFieldValue } from "./signature-pdf";

type SignatureAccessRecipient = Pick<PublicSignatureRequestSnapshot["request"]["recipients"][number], "id" | "roleKey">;

type SignatureAccessContext = {
  fields: OfficeSignatureField[];
  recipients: SignatureAccessRecipient[];
  currentRecipientId: string;
};

type SignatureSubmissionValidationInput = SignatureAccessContext & {
  submittedValues: SubmittedSignatureFieldValue[];
};

function getActionableRecipients(recipients: SignatureAccessRecipient[]) {
  return recipients.filter((recipient) => recipient.roleKey !== "cc");
}

function doesSubmittedValueSatisfyField(field: OfficeSignatureField, value?: SubmittedSignatureFieldValue) {
  if (field.fieldType === "signature") {
    return Boolean(value?.imageDataUrl?.trim() || value?.textValue?.trim());
  }

  return Boolean(value?.textValue?.trim() || field.defaultValue.trim());
}

export function canRecipientEditField(context: SignatureAccessContext, field: OfficeSignatureField) {
  const actionableRecipients = getActionableRecipients(context.recipients);
  const allowUnassignedField = actionableRecipients.length <= 1;

  if (!field.assignedRecipientId) {
    return allowUnassignedField;
  }

  return field.assignedRecipientId === context.currentRecipientId;
}

export function getRecipientEditableFields(context: SignatureAccessContext) {
  return context.fields.filter((field) => canRecipientEditField(context, field));
}

export function getRecipientEditableFieldIds(context: SignatureAccessContext) {
  return new Set(getRecipientEditableFields(context).map((field) => field.id));
}

export function validateRecipientFieldSubmission(input: SignatureSubmissionValidationInput) {
  const editableFields = getRecipientEditableFields(input);
  const editableFieldIds = new Set(editableFields.map((field) => field.id));
  const submittedValuesByFieldId = new Map(input.submittedValues.map((value) => [value.fieldId, value]));

  const unauthorizedFieldIds = input.submittedValues
    .filter((value) => !editableFieldIds.has(value.fieldId))
    .map((value) => value.fieldId);

  const missingRequiredFieldLabels = editableFields
    .filter((field) => field.required && !doesSubmittedValueSatisfyField(field, submittedValuesByFieldId.get(field.id)))
    .map((field) => field.label);

  return {
    editableFields,
    editableFieldIds,
    missingRequiredFieldLabels,
    unauthorizedFieldIds
  };
}
