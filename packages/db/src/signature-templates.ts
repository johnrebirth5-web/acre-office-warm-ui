import {
  SignatureFieldType,
  SignatureRecipientRole,
  SignatureRequestStatus,
  SignatureTemplateCategory
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export type OfficeSignatureTemplateRecipient = {
  id: string;
  roleKey: SignatureRecipientRole;
  role: string;
  recipientRole: string;
  routingStep: number;
  sortOrder: number;
};

export type OfficeSignatureTemplateField = {
  id: string;
  assignedTemplateRecipientId: string;
  fieldType: SignatureFieldType;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  defaultValue: string;
  fontStyle: string;
  fieldKey: string;
  isReadOnly: boolean;
  isSystemPrefilled: boolean;
  visibilityRule: Record<string, string>;
  mirrorGroup: string;
  fieldOptions: Record<string, string>;
  sortOrder: number;
};

export type OfficeSignatureTemplate = {
  id: string;
  name: string;
  description: string;
  category: SignatureTemplateCategory;
  categoryLabel: string;
  version: number;
  isActive: boolean;
  emailSubject: string;
  emailBody: string;
  senderDisplayName: string;
  senderReplyTo: string;
  createdByLabel: string;
  updatedAt: string;
  pdfFileName: string;
  pdfByteSize: number;
  hasPdfSource: boolean;
  usage: {
    totalCount: number;
    draftCount: number;
    inFlightCount: number;
    completedCount: number;
  };
  latestRequest:
    | {
        id: string;
        title: string;
        statusKey: SignatureRequestStatus;
        statusLabel: string;
        updatedAt: string;
        requestHref: string;
        transactionHref: string;
        transactionLabel: string;
        reuseHref: string;
      }
    | null;
  recipients: OfficeSignatureTemplateRecipient[];
  fields: OfficeSignatureTemplateField[];
};

export type OfficeSignatureTemplateLibrarySnapshot = {
  summary: {
    totalCount: number;
    activeCount: number;
    inactiveCount: number;
    nonTransactionCount: number;
    usedCount: number;
    templatesWithLiveDraftsCount: number;
  };
  capabilities: {
    supportsGenericTemplateCategory: boolean;
    supportedCategories: Array<{
      key: SignatureTemplateCategory;
      label: string;
    }>;
    genericTemplateCategoryNote: string;
  };
  templates: OfficeSignatureTemplate[];
};

export type SaveSignatureTemplateInput = {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  templateId?: string | null;
  name: string;
  description?: string | null;
  category: SignatureTemplateCategory;
  isActive?: boolean;
  emailSubject?: string | null;
  emailBody?: string | null;
  senderDisplayName?: string | null;
  senderReplyTo?: string | null;
  recipients: Array<{
    id?: string | null;
    role: SignatureRecipientRole;
    recipientRole: string;
    routingStep?: number | null;
    sortOrder?: number | null;
  }>;
  fields: Array<{
    assignedTemplateRecipientId?: string | null;
    fieldType: SignatureFieldType;
    label: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required?: boolean;
    defaultValue?: string | null;
    fontStyle?: string | null;
    fieldKey?: string | null;
    isReadOnly?: boolean;
    isSystemPrefilled?: boolean;
    visibilityRule?: Record<string, string>;
    mirrorGroup?: string | null;
    fieldOptions?: Record<string, string>;
    sortOrder?: number | null;
  }>;
};

const recipientRoleLabelMap: Record<SignatureRecipientRole, string> = {
  signer: "Signer",
  approver: "Approver",
  cc: "CC"
};

const categoryLabelMap: Record<SignatureTemplateCategory, string> = {
  hr: "HR",
  finance: "Finance",
  admin: "Admin",
  transaction: "Transaction",
  project_sales: "Project sales"
};

const signatureRequestStatusLabelMap: Record<SignatureRequestStatus, string> = {
  draft: "Draft",
  pending_send: "Pending Send",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  completed: "Completed",
  declined: "Declined",
  canceled: "Void / Cancelled",
  voided: "Void / Cancelled",
  expired: "Expired"
};

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatMembershipLabel(
  membership:
    | {
        user?: {
          firstName: string | null;
          lastName: string | null;
          email: string;
        } | null;
      }
    | null
    | undefined
) {
  const firstName = membership?.user?.firstName?.trim() ?? "";
  const lastName = membership?.user?.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();

  return name || membership?.user?.email || "—";
}

function buildTemplateRequestTitle(
  request: NonNullable<Awaited<ReturnType<typeof listSignatureTemplatesInternal>>[number]["signatureRequests"][number]>
) {
  return request.document?.title || request.form?.name || request.contextLabel || request.transaction?.title || "Signature request";
}

function buildTemplateUsage(
  template: Awaited<ReturnType<typeof listSignatureTemplatesInternal>>[number]
) {
  const draftCount = template.signatureRequests.filter((request) =>
    request.status === "draft" || request.status === "pending_send"
  ).length;
  const inFlightCount = template.signatureRequests.filter((request) =>
    request.status === "sent" || request.status === "viewed" || request.status === "signed"
  ).length;
  const completedCount = template.signatureRequests.filter((request) => request.status === "completed").length;

  return {
    totalCount: template.signatureRequests.length,
    draftCount,
    inFlightCount,
    completedCount
  };
}

function resolveTemplateLatestRequest(
  template: Awaited<ReturnType<typeof listSignatureTemplatesInternal>>[number]
) {
  return (
    template.signatureRequests.find((request) =>
      request.status === "draft" ||
      request.status === "pending_send" ||
      request.status === "sent" ||
      request.status === "viewed" ||
      request.status === "signed"
    ) ?? template.signatureRequests[0] ?? null
  );
}

function mapTemplate(
  template: Awaited<ReturnType<typeof listSignatureTemplatesInternal>>[number]
): OfficeSignatureTemplate {
  const latestRequest = resolveTemplateLatestRequest(template);

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? "",
    category: template.category,
    categoryLabel: categoryLabelMap[template.category],
    version: template.version,
    isActive: template.isActive,
    emailSubject: template.emailSubject ?? "",
    emailBody: template.emailBody ?? "",
    senderDisplayName: template.senderDisplayName ?? "",
    senderReplyTo: template.senderReplyTo ?? "",
    createdByLabel: formatMembershipLabel(template.createdByMembership),
    updatedAt: formatDateTimeLabel(template.updatedAt) || "",
    pdfFileName: template.pdfFileName ?? "",
    pdfByteSize: template.pdfByteSize ?? 0,
    hasPdfSource: Boolean(template.pdfStorageKey),
    usage: buildTemplateUsage(template),
    latestRequest: latestRequest
      ? {
          id: latestRequest.id,
          title: buildTemplateRequestTitle(latestRequest),
          statusKey: latestRequest.status,
          statusLabel: signatureRequestStatusLabelMap[latestRequest.status],
          updatedAt: formatDateTimeLabel(latestRequest.updatedAt) || "",
          requestHref: `/office/transactions/${latestRequest.transactionId}/signatures/${latestRequest.id}`,
          transactionHref: `/office/transactions/${latestRequest.transactionId}`,
          transactionLabel: latestRequest.transaction?.title || latestRequest.contextLabel || "Transaction",
          reuseHref:
            latestRequest.documentId
              ? `/office/transactions/${latestRequest.transactionId}/signatures/new?documentId=${latestRequest.documentId}&templateId=${template.id}`
              : ""
        }
      : null,
    recipients: template.recipients.map((recipient) => ({
      id: recipient.id,
      roleKey: recipient.role,
      role: recipientRoleLabelMap[recipient.role],
      recipientRole: recipient.recipientRole,
      routingStep: recipient.routingStep,
      sortOrder: recipient.sortOrder
    })),
    fields: template.fields.map((field) => ({
      id: field.id,
      assignedTemplateRecipientId: field.assignedTemplateRecipientId ?? "",
      fieldType: field.fieldType,
      label: field.label,
      page: field.page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      required: field.required,
      defaultValue: field.defaultValue ?? "",
      fontStyle: field.fontStyle ?? "",
      fieldKey: field.fieldKey ?? "",
      isReadOnly: field.isReadOnly,
      isSystemPrefilled: field.isSystemPrefilled,
      visibilityRule:
        field.visibilityRule && typeof field.visibilityRule === "object" && !Array.isArray(field.visibilityRule)
          ? (field.visibilityRule as Record<string, string>)
          : {},
      mirrorGroup: field.mirrorGroup ?? "",
      fieldOptions:
        field.fieldOptions && typeof field.fieldOptions === "object" && !Array.isArray(field.fieldOptions)
          ? (field.fieldOptions as Record<string, string>)
          : {},
      sortOrder: field.sortOrder
    }))
  };
}

async function listSignatureTemplatesInternal(input: {
  organizationId: string;
  officeId?: string | null;
}) {
  return prisma.signatureTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.officeId ? { officeId: input.officeId } : {})
    },
    include: {
      createdByMembership: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      fields: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      signatureRequests: {
        select: {
          id: true,
          transactionId: true,
          documentId: true,
          status: true,
          contextLabel: true,
          updatedAt: true,
          transaction: {
            select: {
              id: true,
              title: true
            }
          },
          document: {
            select: {
              id: true,
              title: true
            }
          },
          form: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
  });
}

function buildLibrarySummary(templates: OfficeSignatureTemplate[]) {
  return {
    totalCount: templates.length,
    activeCount: templates.filter((template) => template.isActive).length,
    inactiveCount: templates.filter((template) => !template.isActive).length,
    nonTransactionCount: templates.filter((template) => template.category !== "transaction").length,
    usedCount: templates.filter((template) => template.usage.totalCount > 0).length,
    templatesWithLiveDraftsCount: templates.filter((template) => template.usage.draftCount > 0).length
  };
}

function buildTemplateLibraryCapabilities() {
  return {
    supportsGenericTemplateCategory: false,
    supportedCategories: Object.entries(categoryLabelMap).map(([key, label]) => ({
      key: key as SignatureTemplateCategory,
      label
    })),
    genericTemplateCategoryNote:
      "The current schema only allows transaction, HR, finance, and admin template categories. `generic` still exists only as request context metadata."
  };
}

export async function getOfficeSignatureTemplateLibrarySnapshot(input: {
  organizationId: string;
  officeId?: string | null;
}): Promise<OfficeSignatureTemplateLibrarySnapshot> {
  const templates = await listSignatureTemplatesInternal(input);
  const mappedTemplates = templates.map(mapTemplate);

  return {
    summary: buildLibrarySummary(mappedTemplates),
    capabilities: buildTemplateLibraryCapabilities(),
    templates: mappedTemplates
  };
}

export async function getOfficeSignatureTemplate(input: {
  organizationId: string;
  templateId: string;
}) {
  const template = await prisma.signatureTemplate.findFirst({
    where: {
      id: input.templateId,
      organizationId: input.organizationId
    },
    include: {
      createdByMembership: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      recipients: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      fields: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      signatureRequests: {
        select: {
          id: true,
          transactionId: true,
          documentId: true,
          status: true,
          contextLabel: true,
          updatedAt: true,
          transaction: {
            select: {
              id: true,
              title: true
            }
          },
          document: {
            select: {
              id: true,
              title: true
            }
          },
          form: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }
    }
  });

  return template ? mapTemplate(template) : null;
}

export async function saveSignatureTemplate(input: SaveSignatureTemplateInput) {
  const name = normalizeOptionalString(input.name);

  if (!name) {
    throw new Error("Template name is required.");
  }

  const normalizedRecipients = input.recipients
    .filter((recipient) => recipient.recipientRole.trim())
    .map((recipient, index) => ({
      id: recipient.id?.trim() || null,
      role: recipient.role,
      recipientRole: recipient.recipientRole.trim(),
      routingStep: recipient.role === "cc" ? 0 : Math.max(1, Number(recipient.routingStep ?? 1)),
      sortOrder: typeof recipient.sortOrder === "number" ? recipient.sortOrder : index
    }));

  if (normalizedRecipients.length === 0) {
    throw new Error("At least one template recipient is required.");
  }

  const actionableRecipients = normalizedRecipients.filter((recipient) => recipient.role !== "cc");

  if (actionableRecipients.length === 0) {
    throw new Error("At least one signer or approver is required.");
  }

  const savedTemplateId = await prisma.$transaction(async (tx) => {
    const existing = input.templateId
      ? await tx.signatureTemplate.findFirst({
          where: {
            id: input.templateId,
            organizationId: input.organizationId
          }
        })
      : null;

    const template = existing
      ? await tx.signatureTemplate.update({
          where: {
            id: existing.id
          },
          data: {
            category: input.category,
            name,
            description: normalizeOptionalString(input.description),
            isActive: input.isActive ?? true,
            emailSubject: normalizeOptionalString(input.emailSubject),
            emailBody: normalizeOptionalString(input.emailBody),
            senderDisplayName: normalizeOptionalString(input.senderDisplayName),
            senderReplyTo: normalizeOptionalString(input.senderReplyTo),
            version: existing.version + 1
          }
        })
      : await tx.signatureTemplate.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            category: input.category,
            name,
            description: normalizeOptionalString(input.description),
            isActive: input.isActive ?? true,
            emailSubject: normalizeOptionalString(input.emailSubject),
            emailBody: normalizeOptionalString(input.emailBody),
            senderDisplayName: normalizeOptionalString(input.senderDisplayName),
            senderReplyTo: normalizeOptionalString(input.senderReplyTo),
            createdByMembershipId: input.actorMembershipId
          }
        });

    await tx.signatureTemplateRecipient.deleteMany({
      where: {
        templateId: template.id
      }
    });
    await tx.signatureTemplateField.deleteMany({
      where: {
        templateId: template.id
      }
    });

    const createdRecipients = await Promise.all(
      normalizedRecipients.map((recipient) =>
        tx.signatureTemplateRecipient.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            templateId: template.id,
            role: recipient.role,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.routingStep,
            sortOrder: recipient.sortOrder
          }
        })
      )
    );
    const fallbackRecipientId = createdRecipients.find((recipient) => recipient.role !== "cc")?.id ?? null;
    const recipientIdMap = new Map<string, string>();

    createdRecipients.forEach((recipient, index) => {
      const sourceId = normalizedRecipients[index]?.id;
      if (sourceId) {
        recipientIdMap.set(sourceId, recipient.id);
      }
    });

    await Promise.all(
      input.fields.map((field, index) =>
        tx.signatureTemplateField.create({
          data: {
            organizationId: input.organizationId,
            officeId: input.officeId ?? null,
            templateId: template.id,
            assignedTemplateRecipientId:
              (field.assignedTemplateRecipientId
                ? recipientIdMap.get(field.assignedTemplateRecipientId)
                : null) ?? fallbackRecipientId,
            fieldType: field.fieldType,
            label: field.label,
            page: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required ?? true,
            defaultValue: normalizeOptionalString(field.defaultValue),
            fontStyle: normalizeOptionalString(field.fontStyle),
            fieldKey: normalizeOptionalString(field.fieldKey),
            isReadOnly: Boolean(field.isReadOnly),
            isSystemPrefilled: Boolean(field.isSystemPrefilled),
            visibilityRule: field.visibilityRule ?? {},
            mirrorGroup: normalizeOptionalString(field.mirrorGroup),
            fieldOptions: field.fieldOptions ?? {},
            sortOrder: typeof field.sortOrder === "number" ? field.sortOrder : index
          }
        })
      )
    );

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "signature_template",
      entityId: template.id,
      action: existing ? activityLogActions.settingsSignatureTemplateUpdated : activityLogActions.settingsSignatureTemplateCreated,
      payload: {
        objectLabel: name,
        details: [
          `${categoryLabelMap[input.category]} template`,
          `${actionableRecipients.length} signer/approver role${actionableRecipients.length === 1 ? "" : "s"}`,
          `${input.fields.length} field${input.fields.length === 1 ? "" : "s"}`
        ]
      }
    });

    return template.id;
  });

  return getOfficeSignatureTemplate({
    organizationId: input.organizationId,
    templateId: savedTemplateId
  });
}
