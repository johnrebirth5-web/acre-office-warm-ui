import { createHash, randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { can, type PermissionKey, type UserRole } from "@acre/auth";
import {
  Prisma,
  ProjectDocumentDistributionMode,
  ProjectDocumentDistributionRecipientKind,
  ProjectDocumentDistributionStatus,
  ProjectSigningJobStatus,
  ProjectSigningJobType,
  ProjectSigningSessionMode,
  ProjectSigningSessionStatus,
  SignatureArtifactKind,
  SignatureContextType,
  SignatureRecipientRole,
  SignatureRecipientStatus,
  SignatureRequestStatus,
  SignatureTemplateCategory,
  TransactionRepresenting,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { activityLogActions, recordActivityLogEvent, type ActivityLogPayload } from "./activity-log";
import { prisma } from "./client";
import { resolveOfficeDataScope, type OfficeDataScope } from "./access";

const projectSigningTerminalSessionStatuses: readonly ProjectSigningSessionStatus[] = [
  ProjectSigningSessionStatus.completed,
  ProjectSigningSessionStatus.declined,
  ProjectSigningSessionStatus.voided,
  ProjectSigningSessionStatus.expired,
] as const;

const projectSigningTerminalRequestStatuses: readonly SignatureRequestStatus[] = [
  SignatureRequestStatus.completed,
  SignatureRequestStatus.declined,
  SignatureRequestStatus.voided,
  SignatureRequestStatus.expired,
  SignatureRequestStatus.canceled,
] as const;

export type ProjectSigningRoleScope = "admin" | "manager" | "self";

export type ProjectSigningActorContext = {
  organizationId: string;
  officeId?: string | null;
  viewerMembershipId: string;
  viewerRole: UserRole;
  viewerPermissions: PermissionKey[];
};

export type ProjectSigningRecipientInput = {
  membershipId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: SignatureRecipientRole;
  recipientRole?: string | null;
  routingStep?: number | null;
  sortOrder?: number | null;
};

export type CreateSalesProjectInput = ProjectSigningActorContext & {
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  description?: string | null;
  archiveSinkEmails?: string[];
  defaultResponsibleMembershipId?: string | null;
};

export type SaveSalesProjectArchiveSinksInput = ProjectSigningActorContext & {
  projectId: string;
  archiveSinkEmails: string[];
};

export type CreateProjectSigningSessionInput = ProjectSigningActorContext & {
  projectId: string;
  mode: ProjectSigningSessionMode;
  templateIds: string[];
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  responsibleMembershipId?: string | null;
  recipients: ProjectSigningRecipientInput[];
  expiresAt?: Date | null;
};

export type StartProjectHandoffInput = ProjectSigningActorContext & {
  sessionId: string;
  pin: string;
  expiresInMinutes?: number;
};

export type IssueProjectRemoteTokensInput = ProjectSigningActorContext & {
  sessionId: string;
  expiresInMinutes?: number;
};

export type ProjectSigningTokenPayload = {
  recipientId: string;
  version: number;
};

type ProjectSigningDbClient = typeof prisma | Prisma.TransactionClient;

function nowPlusMinutes(minutes: number) {
  const value = new Date();
  value.setMinutes(value.getMinutes() + minutes);
  return value;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || "";
}

export function normalizeProjectSignerEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function hashProjectSigningToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function createProjectSigningToken(payload: ProjectSigningTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const rawToken = `v1.${encodedPayload}.${nonce}`;

  return {
    rawToken,
    tokenHash: hashProjectSigningToken(rawToken),
  };
}

export function parseProjectSigningTokenPayload(token: string): ProjectSigningTokenPayload | null {
  const [, encodedPayload] = token.trim().split(".");

  if (!encodedPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ProjectSigningTokenPayload>;

    if (!parsed.recipientId || typeof parsed.recipientId !== "string") {
      return null;
    }

    const version = parsed.version;

    if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
      return null;
    }

    return {
      recipientId: parsed.recipientId,
      version,
    };
  } catch {
    return null;
  }
}

function isProjectSigningAdmin(role: UserRole) {
  return role === "owner" || role === "office_admin";
}

function isProjectSigningManager(context: ProjectSigningActorContext) {
  return (
    context.viewerRole === "team_lead" ||
    context.viewerRole === "office_manager" ||
    context.viewerPermissions.includes("project_signing:manage") ||
    context.viewerPermissions.includes("project_signing:archive_manage")
  );
}

export function canViewProjectSigning(context: { role: UserRole; permissions?: readonly PermissionKey[] | null }) {
  return can(context, "project_signing:view") || can(context, "signatures:view");
}

export function canCreateProjectSigning(context: { role: UserRole; permissions?: readonly PermissionKey[] | null }) {
  return can(context, "project_signing:create") || can(context, "signatures:manage");
}

export function canManageProjectSigning(context: { role: UserRole; permissions?: readonly PermissionKey[] | null }) {
  return can(context, "project_signing:manage") || can(context, "signatures:manage");
}

function buildAnchorAddress(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}) {
  return {
    address: normalizeText(input.address) || "System archive anchor",
    city: normalizeText(input.city) || "N/A",
    state: normalizeText(input.state) || "NA",
    zipCode: normalizeText(input.zipCode) || "00000",
  };
}

function sanitizeArchiveSinkEmails(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => normalizeProjectSignerEmail(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function buildAuditPayload(input: Record<string, unknown>): ActivityLogPayload {
  return {
    source: "front_office_project_signing",
    ...input,
  };
}

async function resolveProjectSigningOfficeScope(
  input: ProjectSigningActorContext,
): Promise<{
  roleScope: ProjectSigningRoleScope;
  officeId: string | null;
  visibleMembershipIds: string[] | null;
  officeDataScope: OfficeDataScope | null;
}> {
  if (isProjectSigningAdmin(input.viewerRole)) {
    return {
      roleScope: "admin",
      officeId: null,
      visibleMembershipIds: null,
      officeDataScope: null,
    };
  }

  const officeDataScope = await resolveOfficeDataScope({
    organizationId: input.organizationId,
    viewerMembershipId: input.viewerMembershipId,
    officeId: input.officeId ?? null,
    resource: "transactions",
  });
  const roleScope: ProjectSigningRoleScope = isProjectSigningManager(input) ? "manager" : "self";
  const visibleMembershipIds =
    roleScope === "manager" && officeDataScope.visibleMembershipIds && officeDataScope.visibleMembershipIds.length > 0
      ? officeDataScope.visibleMembershipIds
      : [input.viewerMembershipId];

  return {
    roleScope,
    officeId: input.officeId ?? officeDataScope.officeId ?? null,
    visibleMembershipIds,
    officeDataScope,
  };
}

async function buildProjectSigningWhere(input: ProjectSigningActorContext): Promise<Prisma.SalesProjectWhereInput> {
  const scope = await resolveProjectSigningOfficeScope(input);
  const conditions: Prisma.SalesProjectWhereInput[] = [
    {
      organizationId: input.organizationId,
    },
  ];

  if (scope.officeId) {
    conditions.push({ officeId: scope.officeId });
  }

  if (scope.visibleMembershipIds) {
    conditions.push({
      OR: [
        {
          createdByMembershipId: {
            in: scope.visibleMembershipIds,
          },
        },
        {
          defaultResponsibleMembershipId: {
            in: scope.visibleMembershipIds,
          },
        },
        {
          sessions: {
            some: {
              OR: [
                {
                  createdByMembershipId: {
                    in: scope.visibleMembershipIds,
                  },
                },
                {
                  responsibleMembershipId: {
                    in: scope.visibleMembershipIds,
                  },
                },
              ],
            },
          },
        },
        {
          documents: {
            some: {
              responsibleMembershipId: {
                in: scope.visibleMembershipIds,
              },
            },
          },
        },
      ],
    });
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

async function getAccessibleSalesProject(input: ProjectSigningActorContext & { projectId: string }, db: ProjectSigningDbClient = prisma) {
  const scopeWhere = await buildProjectSigningWhere(input);

  return db.salesProject.findFirst({
    where: {
      AND: [
        scopeWhere,
        {
          id: input.projectId,
        },
      ],
    },
    include: {
      defaultResponsibleMembership: {
        include: {
          user: true,
        },
      },
      createdByMembership: {
        include: {
          user: true,
        },
      },
    },
  });
}

function formatMembershipName(membership: { user?: { firstName: string; lastName: string; email: string } | null } | null | undefined) {
  const name = `${membership?.user?.firstName ?? ""} ${membership?.user?.lastName ?? ""}`.trim();
  return name || membership?.user?.email || "Unassigned";
}

function formatDateLabel(value: Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(value)
    : "Not set";
}

export async function getFrontOfficeProjectSigningSnapshot(input: ProjectSigningActorContext) {
  const where = await buildProjectSigningWhere(input);
  const [projects, templates] = await Promise.all([
    prisma.salesProject.findMany({
      where,
      include: {
        defaultResponsibleMembership: {
          include: {
            user: true,
          },
        },
        createdByMembership: {
          include: {
            user: true,
          },
        },
        sessions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 4,
          include: {
            documents: true,
            recipients: true,
          },
        },
        documents: {
          orderBy: {
            archivedAt: "desc",
          },
          take: 4,
        },
        _count: {
          select: {
            sessions: true,
            documents: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    }),
    prisma.signatureTemplate.findMany({
      where: {
        organizationId: input.organizationId,
        category: SignatureTemplateCategory.project_sales,
        isActive: true,
        OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : undefined,
      },
      include: {
        recipients: {
          orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
        },
        fields: {
          orderBy: [{ sortOrder: "asc" }],
        },
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const activeSessions = projects.flatMap((project) => project.sessions).filter((session) => !projectSigningTerminalSessionStatuses.includes(session.status));
  const completedSessions = projects.flatMap((project) => project.sessions).filter((session) => session.status === ProjectSigningSessionStatus.completed);
  const failedJobs = await prisma.projectSignatureJob.count({
    where: {
      organizationId: input.organizationId,
      project: {
        is: where,
      },
      status: ProjectSigningJobStatus.failed,
    },
  });

  return {
    summary: {
      projectCount: projects.length,
      activeSessionCount: activeSessions.length,
      completedSessionCount: completedSessions.length,
      archivedDocumentCount: projects.reduce((total, project) => total + project._count.documents, 0),
      failedJobCount: failedJobs,
    },
    templates: templates.map((template) => ({
      id: template.id,
      name: template.name,
      version: template.version,
      description: template.description ?? "",
      hasPdfSource: Boolean(template.pdfStorageKey),
      pdfFileName: template.pdfFileName ?? "",
      recipientCount: template.recipients.length,
      fieldCount: template.fields.length,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      addressLabel: [project.address, project.city, project.state, project.zipCode].filter(Boolean).join(", ") || "No address",
      archiveSinkEmails: project.archiveSinkEmails,
      responsibleLabel: formatMembershipName(project.defaultResponsibleMembership),
      createdByLabel: formatMembershipName(project.createdByMembership),
      updatedAtLabel: formatDateLabel(project.updatedAt),
      sessionCount: project._count.sessions,
      archivedDocumentCount: project._count.documents,
      sessions: project.sessions.map((session) => ({
        id: session.id,
        mode: session.mode,
        status: session.status,
        buyerName: session.buyerName ?? "Unnamed buyer",
        buyerEmail: session.buyerEmail ?? "",
        documentCount: session.documents.length,
        recipientCount: session.recipients.length,
        createdAtLabel: formatDateLabel(session.createdAt),
      })),
      recentDocuments: project.documents.map((document) => ({
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        buyerName: document.buyerName ?? "",
        buyerEmail: document.buyerEmail ?? "",
        archivedAtLabel: formatDateLabel(document.archivedAt),
        contentSha256: document.contentSha256 ?? "",
      })),
    })),
  };
}

export async function createSalesProject(input: CreateSalesProjectInput) {
  if (!canCreateProjectSigning({ role: input.viewerRole, permissions: input.viewerPermissions })) {
    throw new Error("Project signing create access required.");
  }

  const code = normalizeText(input.code);
  const name = normalizeText(input.name);

  if (!code || !name) {
    throw new Error("Project code and name are required.");
  }

  const address = buildAnchorAddress(input);
  const archiveSinkEmails = sanitizeArchiveSinkEmails(input.archiveSinkEmails ?? []);

  return prisma.$transaction(async (tx) => {
    const anchor = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        ownerMembershipId: null,
        primaryClientId: null,
        type: TransactionType.other,
        status: TransactionStatus.system_anchor,
        representing: TransactionRepresenting.buyer,
        title: `[SYSTEM] Project signing anchor - ${code}`,
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        companyReferral: false,
        clientReferralFormApproved: false,
        rebateAgreementSigned: false,
        rebateGoogleFormSubmitted: false,
        isSystemArchiveAnchor: true,
        additionalFields: {
          systemArchiveAnchor: true,
          source: "project_signing",
          projectCode: code,
        },
      },
    });

    const project = await tx.salesProject.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        signatureAnchorTransactionId: anchor.id,
        code,
        name,
        address: normalizeText(input.address) || null,
        city: normalizeText(input.city) || null,
        state: normalizeText(input.state) || null,
        zipCode: normalizeText(input.zipCode) || null,
        description: normalizeText(input.description) || null,
        archiveSinkEmails,
        defaultResponsibleMembershipId: input.defaultResponsibleMembershipId || input.viewerMembershipId,
        createdByMembershipId: input.viewerMembershipId,
      },
    });

    await tx.transaction.update({
      where: {
        id: anchor.id,
      },
      data: {
        additionalFields: {
          systemArchiveAnchor: true,
          source: "project_signing",
          salesProjectId: project.id,
          projectCode: code,
        },
      },
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      entityType: "sales_project",
      entityId: project.id,
      action: "project_signing.project_created",
      payload: buildAuditPayload({
        code,
        name,
        archiveSinkEmails,
      }),
    });

    return project;
  });
}

export async function saveSalesProjectArchiveSinkEmails(input: SaveSalesProjectArchiveSinksInput) {
  if (!canManageProjectSigning({ role: input.viewerRole, permissions: input.viewerPermissions })) {
    throw new Error("Project signing manage access required.");
  }

  const project = await getAccessibleSalesProject(input);

  if (!project) {
    throw new Error("Project not found.");
  }

  const before = project.archiveSinkEmails;
  const after = sanitizeArchiveSinkEmails(input.archiveSinkEmails);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((email) => !beforeSet.has(email));
  const removed = before.filter((email) => !afterSet.has(email));

  const saved = await prisma.salesProject.update({
    where: {
      id: project.id,
    },
    data: {
      archiveSinkEmails: after,
    },
  });

  if (added.length || removed.length) {
    await recordActivityLogEvent(prisma, {
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      entityType: "sales_project",
      entityId: project.id,
      action: "project_signing.archive_sink_changed",
      payload: buildAuditPayload({
        actorMembershipId: input.viewerMembershipId,
        before,
        after,
        added,
        removed,
      }),
    });
  }

  return saved;
}

function resolveSessionRecipients(input: CreateProjectSigningSessionInput, templateRecipients: Array<{
  role: SignatureRecipientRole;
  recipientRole: string;
  routingStep: number;
  sortOrder: number;
}>) {
  const recipients = input.recipients.length
    ? input.recipients
    : [
        {
          name: normalizeText(input.buyerName) || "Buyer",
          email: normalizeText(input.buyerEmail) || null,
          phone: normalizeText(input.buyerPhone) || null,
          role: SignatureRecipientRole.signer,
          recipientRole: "buyer",
          routingStep: 1,
          sortOrder: 0,
        },
      ];

  const normalizedEmailSet = new Set<string>();

  return recipients.map((recipient, index) => {
    const fallbackTemplateRecipient = templateRecipients[index] ?? templateRecipients[0];
    const normalizedEmail = normalizeProjectSignerEmail(recipient.email ?? null);

    if (!recipient.membershipId && !normalizedEmail) {
      throw new Error("Every recipient needs either an internal membership or an email address.");
    }

    if (normalizedEmail) {
      if (normalizedEmailSet.has(normalizedEmail)) {
        throw new Error("A signing session cannot contain duplicate recipient emails.");
      }

      normalizedEmailSet.add(normalizedEmail);
    }

    return {
      membershipId: recipient.membershipId ?? null,
      role: recipient.role ?? fallbackTemplateRecipient?.role ?? SignatureRecipientRole.signer,
      name: normalizeText(recipient.name) || normalizedEmail || "Signer",
      email: normalizedEmail,
      normalizedEmail,
      phone: normalizeText(recipient.phone) || null,
      recipientRole: normalizeText(recipient.recipientRole) || fallbackTemplateRecipient?.recipientRole || "signer",
      routingStep: recipient.routingStep ?? fallbackTemplateRecipient?.routingStep ?? 1,
      sortOrder: recipient.sortOrder ?? index,
    };
  });
}

export async function createProjectSigningSession(input: CreateProjectSigningSessionInput) {
  if (!canCreateProjectSigning({ role: input.viewerRole, permissions: input.viewerPermissions })) {
    throw new Error("Project signing create access required.");
  }

  const project = await getAccessibleSalesProject(input);

  if (!project) {
    throw new Error("Project not found.");
  }

  if (!input.templateIds.length) {
    throw new Error("Select at least one project signing template.");
  }

  const templates = await prisma.signatureTemplate.findMany({
    where: {
      id: {
        in: input.templateIds,
      },
      organizationId: input.organizationId,
      category: SignatureTemplateCategory.project_sales,
      isActive: true,
      OR: project.officeId ? [{ officeId: project.officeId }, { officeId: null }] : [{ officeId: null }],
    },
    include: {
      recipients: {
        orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
      },
      fields: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (templates.length !== input.templateIds.length) {
    throw new Error("One or more project signing templates could not be found.");
  }

  for (const template of templates) {
    if (!template.pdfStorageKey || !template.pdfFileName || !template.pdfByteSize || !template.pdfContentType) {
      throw new Error(`Template ${template.name} is missing its PDF source file.`);
    }
  }

  const templateRecipientBlueprint = templates.flatMap((template) => template.recipients);
  const sessionRecipients = resolveSessionRecipients(input, templateRecipientBlueprint);
  const firstRecipient = sessionRecipients[0];

  return prisma.$transaction(async (tx) => {
    const session = await tx.projectSigningSession.create({
      data: {
        organizationId: input.organizationId,
        officeId: project.officeId,
        projectId: project.id,
        mode: input.mode,
        status: ProjectSigningSessionStatus.draft,
        buyerName: normalizeText(input.buyerName) || firstRecipient?.name || null,
        buyerEmail: normalizeProjectSignerEmail(input.buyerEmail) || firstRecipient?.email || null,
        buyerPhone: normalizeText(input.buyerPhone) || firstRecipient?.phone || null,
        responsibleMembershipId: input.responsibleMembershipId || project.defaultResponsibleMembershipId || input.viewerMembershipId,
        createdByMembershipId: input.viewerMembershipId,
        expiresAt: input.expiresAt ?? nowPlusMinutes(60 * 24 * 14),
        recipients: {
          create: sessionRecipients.map((recipient) => ({
            organizationId: input.organizationId,
            officeId: project.officeId,
            membershipId: recipient.membershipId,
            role: recipient.role,
            name: recipient.name,
            email: recipient.email,
            normalizedEmail: recipient.normalizedEmail,
            phone: recipient.phone,
            recipientRole: recipient.recipientRole,
            routingStep: recipient.routingStep,
            sortOrder: recipient.sortOrder,
            status: SignatureRecipientStatus.draft,
          })),
        },
      },
      include: {
        recipients: {
          orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
        },
      },
    });

    for (const [index, template] of templates.entries()) {
      const request = await tx.signatureRequest.create({
        data: {
          organizationId: input.organizationId,
          officeId: project.officeId,
          transactionId: project.signatureAnchorTransactionId,
          requestedByMembershipId: input.viewerMembershipId,
          contextType: SignatureContextType.project,
          contextLabel: project.name,
          recipientName: firstRecipient?.name || normalizeText(input.buyerName) || "Signer",
          recipientEmail: firstRecipient?.email || normalizeProjectSignerEmail(input.buyerEmail) || "",
          recipientRole: firstRecipient?.recipientRole || "signer",
          emailSubject: template.emailSubject,
          emailBody: template.emailBody,
          status: SignatureRequestStatus.draft,
          senderDisplayName: template.senderDisplayName,
          senderReplyTo: template.senderReplyTo,
          expiresAt: input.expiresAt ?? session.expiresAt,
          templateId: template.id,
        },
      });
      const createdRecipients = new Map<string, string>();

      for (const templateRecipient of template.recipients) {
        const matchingSessionRecipient =
          session.recipients.find((recipient) => recipient.recipientRole.toLowerCase() === templateRecipient.recipientRole.toLowerCase()) ??
          session.recipients.find((recipient) => recipient.routingStep === templateRecipient.routingStep) ??
          session.recipients[0];

        const signatureRecipient = await tx.signatureRecipient.create({
          data: {
            organizationId: input.organizationId,
            officeId: project.officeId,
            transactionId: project.signatureAnchorTransactionId,
            signatureRequestId: request.id,
            membershipId: matchingSessionRecipient?.membershipId ?? null,
            role: templateRecipient.role,
            name: matchingSessionRecipient?.name ?? templateRecipient.recipientRole,
            email: matchingSessionRecipient?.email ?? "",
            recipientRole: templateRecipient.recipientRole,
            routingStep: templateRecipient.routingStep,
            sortOrder: templateRecipient.sortOrder,
            status: SignatureRecipientStatus.draft,
          },
        });

        createdRecipients.set(templateRecipient.id, signatureRecipient.id);
      }

      await tx.signatureField.createMany({
        data: template.fields.map((field) => ({
          signatureRequestId: request.id,
          assignedRecipientId: field.assignedTemplateRecipientId ? createdRecipients.get(field.assignedTemplateRecipientId) ?? null : null,
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
          visibilityRule: field.visibilityRule ?? undefined,
          mirrorGroup: field.mirrorGroup,
          fieldOptions: field.fieldOptions ?? undefined,
          sortOrder: field.sortOrder,
        })),
      });

      const sessionDocument = await tx.projectSigningSessionDocument.create({
        data: {
          organizationId: input.organizationId,
          officeId: project.officeId,
          projectId: project.id,
          sessionId: session.id,
          templateId: template.id,
          signatureRequestId: request.id,
          sortOrder: index,
          title: template.name,
          documentType: template.category,
          status: SignatureRequestStatus.draft,
          snapshotTemplateName: template.name,
          snapshotTemplateVersion: template.version,
          snapshotPdfStorageKey: template.pdfStorageKey!,
          snapshotPdfFileName: template.pdfFileName!,
          snapshotPdfByteSize: template.pdfByteSize!,
          snapshotPdfContentType: template.pdfContentType!,
          snapshotFieldsJson: template.fields as unknown as Prisma.InputJsonValue,
          snapshotRecipientsJson: template.recipients as unknown as Prisma.InputJsonValue,
          snapshotEmailSubject: template.emailSubject,
          snapshotEmailBody: template.emailBody,
        },
      });

      await tx.signatureRequest.update({
        where: {
          id: request.id,
        },
        data: {
          contextId: sessionDocument.id,
        },
      });

      await tx.signatureAuditEntry.create({
        data: {
          signatureRequestId: request.id,
          eventType: "session_created",
          actorMembershipId: input.viewerMembershipId,
          actorLabel: "Front Office",
          details: {
            sessionId: session.id,
            projectId: project.id,
            templateId: template.id,
          },
        },
      });
    }

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.viewerMembershipId,
      entityType: "project_signing_session",
      entityId: session.id,
      action: "project_signing.session_created",
      payload: buildAuditPayload({
        projectId: project.id,
        mode: input.mode,
        templateIds: input.templateIds,
        recipientCount: session.recipients.length,
      }),
    });

    return session;
  });
}

export async function startProjectSigningHandoff(input: StartProjectHandoffInput) {
  if (!canCreateProjectSigning({ role: input.viewerRole, permissions: input.viewerPermissions })) {
    throw new Error("Project signing create access required.");
  }

  if (!/^\d{4,6}$/.test(input.pin.trim())) {
    throw new Error("Handoff PIN must be 4 to 6 digits.");
  }

  const session = await prisma.projectSigningSession.findFirst({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
    },
    include: {
      project: true,
    },
  });

  if (!session) {
    throw new Error("Signing session not found.");
  }

  const project = await getAccessibleSalesProject({
    ...input,
    projectId: session.projectId,
  });

  if (!project) {
    throw new Error("Signing session not found.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashProjectSigningToken(rawToken);
  const pinHash = await hash(input.pin.trim(), 10);
  const expiresAt = nowPlusMinutes(Math.min(Math.max(input.expiresInMinutes ?? 30, 1), 30));

  const saved = await prisma.projectSigningSession.update({
    where: {
      id: session.id,
    },
    data: {
      mode: ProjectSigningSessionMode.in_person,
      status: ProjectSigningSessionStatus.awaiting_signers,
      handoffTokenHash: tokenHash,
      handoffTokenExpiresAt: expiresAt,
      handoffPinHash: pinHash,
      handoffPinFailedAttempts: 0,
      handoffLockedUntil: null,
      handoffStartedAt: new Date(),
      handoffExitedAt: null,
      startedAt: session.startedAt ?? new Date(),
    },
  });

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.viewerMembershipId,
    entityType: "project_signing_session",
    entityId: session.id,
    action: "project_signing.handoff_started",
    payload: buildAuditPayload({
      projectId: session.projectId,
      expiresAt,
      pinReset: true,
    }),
  });

  return {
    session: saved,
    rawToken,
    expiresAt,
  };
}

export async function verifyProjectHandoffPin(sessionId: string, pin: string) {
  const session = await prisma.projectSigningSession.findUnique({
    where: {
      id: sessionId,
    },
  });

  if (!session?.handoffPinHash) {
    return { ok: false, locked: false };
  }

  if (session.handoffLockedUntil && session.handoffLockedUntil.getTime() > Date.now()) {
    return { ok: false, locked: true };
  }

  const ok = await compare(pin.trim(), session.handoffPinHash);

  if (ok) {
    await prisma.projectSigningSession.update({
      where: {
        id: session.id,
      },
      data: {
        handoffTokenHash: null,
        handoffTokenExpiresAt: null,
        handoffPinHash: null,
        handoffPinFailedAttempts: 0,
        handoffLockedUntil: null,
        handoffExitedAt: new Date(),
      },
    });
    return { ok: true, locked: false };
  }

  const failedAttempts = session.handoffPinFailedAttempts + 1;

  await prisma.projectSigningSession.update({
    where: {
      id: session.id,
    },
    data: {
      handoffPinFailedAttempts: failedAttempts,
      handoffLockedUntil: failedAttempts >= 5 ? nowPlusMinutes(5) : null,
    },
  });

  return { ok: false, locked: failedAttempts >= 5 };
}

export async function resolveProjectHandoffToken(rawToken: string) {
  const session = await prisma.projectSigningSession.findFirst({
    where: {
      handoffTokenHash: hashProjectSigningToken(rawToken),
    },
    include: {
      project: true,
      recipients: {
        orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
      },
      documents: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!session || !session.handoffTokenExpiresAt || session.handoffTokenExpiresAt.getTime() < Date.now()) {
    return null;
  }

  if (session.handoffLockedUntil && session.handoffLockedUntil.getTime() > Date.now()) {
    return null;
  }

  return session;
}

export async function issueProjectRemoteSigningTokens(input: IssueProjectRemoteTokensInput) {
  if (!canCreateProjectSigning({ role: input.viewerRole, permissions: input.viewerPermissions })) {
    throw new Error("Project signing create access required.");
  }

  const session = await prisma.projectSigningSession.findFirst({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
    },
    include: {
      project: true,
      recipients: {
        orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (!session) {
    throw new Error("Signing session not found.");
  }

  const project = await getAccessibleSalesProject({
    ...input,
    projectId: session.projectId,
  });

  if (!project) {
    throw new Error("Signing session not found.");
  }

  const expiresAt = nowPlusMinutes(Math.min(Math.max(input.expiresInMinutes ?? 60 * 24 * 14, 10), 60 * 24 * 30));
  const issuedTokens = [];

  for (const recipient of session.recipients) {
    if (!recipient.email) {
      continue;
    }

    const nextVersion = recipient.tokenVersion + 1;
    const token = createProjectSigningToken({
      recipientId: recipient.id,
      version: nextVersion,
    });

    await prisma.projectSigningSessionRecipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        remoteTokenHash: token.tokenHash,
        remoteTokenIssuedAt: new Date(),
        remoteTokenExpiresAt: expiresAt,
        remoteTokenRevokedAt: null,
        tokenVersion: nextVersion,
        otpHash: null,
        otpExpiresAt: null,
        otpFailedAttempts: 0,
        otpLockedUntil: null,
        otpVerifiedAt: null,
        status: SignatureRecipientStatus.sent,
      },
    });

    issuedTokens.push({
      recipientId: recipient.id,
      email: recipient.email,
      name: recipient.name,
      rawToken: token.rawToken,
      expiresAt,
    });
  }

  await prisma.projectSigningSession.update({
    where: {
      id: session.id,
    },
    data: {
      mode: ProjectSigningSessionMode.remote,
      status: ProjectSigningSessionStatus.awaiting_signers,
      startedAt: session.startedAt ?? new Date(),
    },
  });

  return issuedTokens;
}

export async function resolveProjectRemoteSigningToken(rawToken: string) {
  const payload = parseProjectSigningTokenPayload(rawToken);

  if (!payload) {
    return null;
  }

  const recipient = await prisma.projectSigningSessionRecipient.findFirst({
    where: {
      id: payload.recipientId,
      remoteTokenHash: hashProjectSigningToken(rawToken),
    },
    include: {
      session: {
        include: {
          project: true,
          documents: {
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      },
    },
  });

  if (!recipient || recipient.tokenVersion !== payload.version || recipient.remoteTokenRevokedAt) {
    return null;
  }

  if (!recipient.remoteTokenExpiresAt || recipient.remoteTokenExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return {
    recipient,
    otpRequired: !recipient.otpVerifiedAt,
  };
}

export async function markProjectRecipientOtpVerified(recipientId: string) {
  return prisma.projectSigningSessionRecipient.update({
    where: {
      id: recipientId,
    },
    data: {
      otpVerifiedAt: new Date(),
      otpHash: null,
      otpExpiresAt: null,
      otpFailedAttempts: 0,
      otpLockedUntil: null,
      status: SignatureRecipientStatus.viewed,
      lastViewedAt: new Date(),
    },
  });
}

export async function enqueueProjectSignatureJob(input: {
  organizationId: string;
  officeId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
  sessionDocumentId?: string | null;
  signatureRequestId?: string | null;
  signatureArtifactId?: string | null;
  distributionId?: string | null;
  type: ProjectSigningJobType;
  idempotencyKey: string;
  runAfter?: Date;
}) {
  return prisma.projectSignatureJob.upsert({
    where: {
      idempotencyKey: input.idempotencyKey,
    },
    create: {
      organizationId: input.organizationId,
      officeId: input.officeId ?? null,
      projectId: input.projectId ?? null,
      sessionId: input.sessionId ?? null,
      sessionDocumentId: input.sessionDocumentId ?? null,
      signatureRequestId: input.signatureRequestId ?? null,
      signatureArtifactId: input.signatureArtifactId ?? null,
      distributionId: input.distributionId ?? null,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      status: ProjectSigningJobStatus.queued,
      runAfter: input.runAfter ?? new Date(),
    },
    update: {},
  });
}

export async function markProjectSessionDocumentCompleted(input: {
  organizationId: string;
  sessionDocumentId: string;
  signatureArtifactId: string;
  signedArtifactStorageKey: string;
  signedArtifactSha256: string;
}) {
  return prisma.projectSigningSessionDocument.update({
    where: {
      id: input.sessionDocumentId,
      organizationId: input.organizationId,
    },
    data: {
      status: SignatureRequestStatus.completed,
      signedArtifactId: input.signatureArtifactId,
      signedArtifactStorageKey: input.signedArtifactStorageKey,
      signedArtifactSha256: input.signedArtifactSha256,
      finalizedAt: new Date(),
      finalizationStatus: ProjectSigningJobStatus.succeeded,
      finalizationError: null,
    },
  });
}

export async function completeProjectSigningSessionIfReady(input: {
  organizationId: string;
  sessionId: string;
  actorMembershipId?: string | null;
}) {
  const incompleteDocuments = await prisma.projectSigningSessionDocument.count({
    where: {
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      status: {
        not: SignatureRequestStatus.completed,
      },
    },
  });

  if (incompleteDocuments > 0) {
    await prisma.projectSigningSession.updateMany({
      where: {
        id: input.sessionId,
        organizationId: input.organizationId,
        status: ProjectSigningSessionStatus.awaiting_signers,
      },
      data: {
        status: ProjectSigningSessionStatus.partially_signed,
      },
    });

    return false;
  }

  const completed = await prisma.projectSigningSession.updateMany({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
      status: {
        notIn: [...projectSigningTerminalSessionStatuses],
      },
    },
    data: {
      status: ProjectSigningSessionStatus.completed,
      completedAt: new Date(),
    },
  });

  if (completed.count !== 1) {
    return false;
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.actorMembershipId ?? null,
    entityType: "project_signing_session",
    entityId: input.sessionId,
    action: "project_signing.session_completed",
    payload: buildAuditPayload({
      sessionId: input.sessionId,
    }),
  });

  const sessionDocuments = await prisma.projectSigningSessionDocument.findMany({
    where: {
      organizationId: input.organizationId,
      sessionId: input.sessionId,
    },
    select: {
      signatureRequestId: true,
    },
  });

  await prisma.signatureAuditEntry.createMany({
    data: sessionDocuments.map((document) => ({
      signatureRequestId: document.signatureRequestId,
      eventType: "session_completed",
      actorMembershipId: input.actorMembershipId ?? null,
      actorLabel: "Front Office",
      details: {
        sessionId: input.sessionId,
      },
    })),
  });

  return true;
}

export async function markProjectSignatureSubmitted(input: {
  rawToken: string;
  submittedValues?: Prisma.InputJsonValue;
}) {
  const resolved = await resolveProjectRemoteSigningToken(input.rawToken);

  if (!resolved) {
    throw new Error("Signing token is invalid or expired.");
  }

  if (resolved.recipient.status === SignatureRecipientStatus.acted) {
    return resolved.recipient;
  }

  if (resolved.recipient.role !== SignatureRecipientRole.cc) {
    const activeRecipients = await prisma.projectSigningSessionRecipient.findMany({
      where: {
        sessionId: resolved.recipient.sessionId,
        role: {
          not: SignatureRecipientRole.cc,
        },
        status: {
          not: SignatureRecipientStatus.acted,
        },
      },
      orderBy: [{ routingStep: "asc" }, { sortOrder: "asc" }],
    });
    const activeRoutingStep = activeRecipients[0]?.routingStep ?? resolved.recipient.routingStep;

    if (resolved.recipient.routingStep !== activeRoutingStep) {
      throw new Error("This signer is not active yet.");
    }
  }

  const recipient = await prisma.projectSigningSessionRecipient.update({
    where: {
      id: resolved.recipient.id,
    },
    data: {
      status: SignatureRecipientStatus.acted,
      actedAt: new Date(),
    },
  });

  const sessionDocuments = await prisma.projectSigningSessionDocument.findMany({
    where: {
      sessionId: resolved.recipient.sessionId,
      status: {
        notIn: [...projectSigningTerminalRequestStatuses],
      },
    },
    include: {
      signatureRequest: {
        include: {
          recipients: true,
        },
      },
    },
  });

  for (const sessionDocument of sessionDocuments) {
    const matchingSignatureRecipient = sessionDocument.signatureRequest.recipients.find(
      (signatureRecipient) =>
        normalizeProjectSignerEmail(signatureRecipient.email) === recipient.normalizedEmail ||
        (recipient.membershipId && signatureRecipient.membershipId === recipient.membershipId),
    );

    if (!matchingSignatureRecipient) {
      continue;
    }

    await prisma.signatureRecipient.update({
      where: {
        id: matchingSignatureRecipient.id,
      },
      data: {
        status: SignatureRecipientStatus.acted,
        actedAt: new Date(),
        submittedValues: input.submittedValues ?? Prisma.JsonNull,
      },
    });

    const remaining = await prisma.signatureRecipient.count({
      where: {
        signatureRequestId: sessionDocument.signatureRequestId,
        role: {
          not: SignatureRecipientRole.cc,
        },
        status: {
          not: SignatureRecipientStatus.acted,
        },
      },
    });

    if (remaining === 0) {
      await prisma.signatureRequest.update({
        where: {
          id: sessionDocument.signatureRequestId,
        },
        data: {
          status: SignatureRequestStatus.completed,
          signedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await prisma.projectSigningSessionDocument.update({
        where: {
          id: sessionDocument.id,
        },
        data: {
          status: SignatureRequestStatus.completed,
          finalizationStatus: ProjectSigningJobStatus.queued,
        },
      });
      await enqueueProjectSignatureJob({
        organizationId: sessionDocument.organizationId,
        officeId: sessionDocument.officeId,
        projectId: sessionDocument.projectId,
        sessionId: sessionDocument.sessionId,
        sessionDocumentId: sessionDocument.id,
        signatureRequestId: sessionDocument.signatureRequestId,
        type: ProjectSigningJobType.finalize_pdf,
        idempotencyKey: `finalize_pdf:${sessionDocument.id}`,
      });
    } else {
      await prisma.signatureRequest.update({
        where: {
          id: sessionDocument.signatureRequestId,
        },
        data: {
          status: SignatureRequestStatus.signed,
          signedAt: new Date(),
        },
      });
      await prisma.projectSigningSessionDocument.update({
        where: {
          id: sessionDocument.id,
        },
        data: {
          status: SignatureRequestStatus.signed,
        },
      });
    }
  }

  return recipient;
}

export async function markProjectHandoffRecipientSubmitted(input: {
  rawToken: string;
  recipientId: string;
  submittedValues?: Prisma.InputJsonValue;
}) {
  const session = await resolveProjectHandoffToken(input.rawToken);

  if (!session) {
    throw new Error("Handoff token is invalid or expired.");
  }

  const sessionRecipient = session.recipients.find((recipient) => recipient.id === input.recipientId);

  if (!sessionRecipient) {
    throw new Error("Signer is not part of this handoff session.");
  }

  const activeRecipients = session.recipients.filter((recipient) => recipient.role !== SignatureRecipientRole.cc && recipient.status !== SignatureRecipientStatus.acted);
  const activeRoutingStep = activeRecipients.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), activeRecipients[0]?.routingStep ?? sessionRecipient.routingStep);

  if (sessionRecipient.routingStep !== activeRoutingStep) {
    throw new Error("This signer is not active yet.");
  }

  const recipient = await prisma.projectSigningSessionRecipient.update({
    where: {
      id: sessionRecipient.id,
    },
    data: {
      status: SignatureRecipientStatus.acted,
      actedAt: new Date(),
    },
  });

  const sessionDocuments = await prisma.projectSigningSessionDocument.findMany({
    where: {
      sessionId: session.id,
      status: {
        notIn: [...projectSigningTerminalRequestStatuses],
      },
    },
    include: {
      signatureRequest: {
        include: {
          recipients: true,
        },
      },
    },
  });

  for (const sessionDocument of sessionDocuments) {
    const matchingSignatureRecipient = sessionDocument.signatureRequest.recipients.find(
      (signatureRecipient) =>
        normalizeProjectSignerEmail(signatureRecipient.email) === recipient.normalizedEmail ||
        (recipient.membershipId && signatureRecipient.membershipId === recipient.membershipId),
    );

    if (!matchingSignatureRecipient) {
      continue;
    }

    await prisma.signatureRecipient.update({
      where: {
        id: matchingSignatureRecipient.id,
      },
      data: {
        status: SignatureRecipientStatus.acted,
        actedAt: new Date(),
        submittedValues: input.submittedValues ?? Prisma.JsonNull,
      },
    });

    const remaining = await prisma.signatureRecipient.count({
      where: {
        signatureRequestId: sessionDocument.signatureRequestId,
        role: {
          not: SignatureRecipientRole.cc,
        },
        status: {
          not: SignatureRecipientStatus.acted,
        },
      },
    });

    if (remaining === 0) {
      await prisma.signatureRequest.update({
        where: {
          id: sessionDocument.signatureRequestId,
        },
        data: {
          status: SignatureRequestStatus.completed,
          signedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await prisma.projectSigningSessionDocument.update({
        where: {
          id: sessionDocument.id,
        },
        data: {
          status: SignatureRequestStatus.completed,
          finalizationStatus: ProjectSigningJobStatus.queued,
        },
      });
      await enqueueProjectSignatureJob({
        organizationId: sessionDocument.organizationId,
        officeId: sessionDocument.officeId,
        projectId: sessionDocument.projectId,
        sessionId: sessionDocument.sessionId,
        sessionDocumentId: sessionDocument.id,
        signatureRequestId: sessionDocument.signatureRequestId,
        type: ProjectSigningJobType.finalize_pdf,
        idempotencyKey: `finalize_pdf:${sessionDocument.id}`,
      });
    } else {
      await prisma.signatureRequest.update({
        where: {
          id: sessionDocument.signatureRequestId,
        },
        data: {
          status: SignatureRequestStatus.signed,
          signedAt: new Date(),
        },
      });
      await prisma.projectSigningSessionDocument.update({
        where: {
          id: sessionDocument.id,
        },
        data: {
          status: SignatureRequestStatus.signed,
        },
      });
    }
  }

  return recipient;
}

export function buildProjectSignatureJobIdempotencyKey(input: {
  type: ProjectSigningJobType;
  sessionDocumentId?: string | null;
  distributionId?: string | null;
  signatureArtifactId?: string | null;
  resendCount?: number | null;
}) {
  let key: string;

  if (input.type === ProjectSigningJobType.finalize_pdf) {
    key = `finalize_pdf:${input.sessionDocumentId}`;
  } else if (input.type === ProjectSigningJobType.send_completion_email) {
    key = `send_email:${input.distributionId}`;
  } else {
    key = `drive_sync:${input.signatureArtifactId}`;
  }

  return input.resendCount && input.resendCount > 0 ? `${key}:resend:${input.resendCount}` : key;
}

export async function createProjectDistributionRows(input: {
  organizationId: string;
  officeId?: string | null;
  projectId: string;
  sessionId: string;
  sessionDocumentId: string;
  signatureArtifactId: string;
  recipients: Array<{
    recipientKind: ProjectDocumentDistributionRecipientKind;
    recipientEmail: string;
    recipientName?: string | null;
    deliveryMode?: ProjectDocumentDistributionMode;
  }>;
}) {
  const uniqueRecipients = new Map<string, (typeof input.recipients)[number]>();

  for (const recipient of input.recipients) {
    const email = normalizeProjectSignerEmail(recipient.recipientEmail);
    if (!email) {
      continue;
    }
    uniqueRecipients.set(`${recipient.recipientKind}:${email}`, {
      ...recipient,
      recipientEmail: email,
    });
  }

  const rows = [];

  for (const recipient of uniqueRecipients.values()) {
    const row = await prisma.projectDocumentDistribution.create({
      data: {
        organizationId: input.organizationId,
        officeId: input.officeId ?? null,
        projectId: input.projectId,
        sessionId: input.sessionId,
        sessionDocumentId: input.sessionDocumentId,
        signatureArtifactId: input.signatureArtifactId,
        recipientKind: recipient.recipientKind,
        recipientEmail: recipient.recipientEmail,
        recipientName: recipient.recipientName ?? null,
        deliveryMode: recipient.deliveryMode ?? ProjectDocumentDistributionMode.secure_link,
        status: ProjectDocumentDistributionStatus.queued,
      },
    });

    rows.push(row);
  }

  return rows;
}

export function createHashMismatchAuditDetails(input: {
  expected: string | null | undefined;
  actual: string;
  source: "signature_artifact" | "sales_project_document" | "session_document";
}) {
  return {
    expected: input.expected ?? null,
    actual: input.actual,
    source: input.source,
    eventId: randomUUID(),
  };
}
