import { HrDocumentTemplateType, HrSyncState } from "@prisma/client";
import { prisma } from "./client";
import { formatDateTimeLabel } from "./date-time";

export const defaultHrTemplateLinks = [
  {
    type: HrDocumentTemplateType.offer_letter,
    company: "ACRE NY",
    position: "Sales Assistant",
    name: "Template 2026 Sales Assistant Employment Letter-ACRE NY",
    driveFileId: "1K5gc17xSooBxAKG_Utg2ASmsAPQObYmA0gMZ5UruVZY",
    sourceUrl: "https://docs.google.com/document/d/1K5gc17xSooBxAKG_Utg2ASmsAPQObYmA0gMZ5UruVZY/edit",
  },
  {
    type: HrDocumentTemplateType.offer_letter,
    company: "ACRE NY",
    position: "Salesperson",
    name: "2026 NY Salesperson Employment Letter-templet.docx",
    driveFileId: "19IbGPvUW5_gfWeoYJ6t2PgaDjPl41F9i",
    sourceUrl: "https://docs.google.com/document/d/19IbGPvUW5_gfWeoYJ6t2PgaDjPl41F9i/edit",
  },
  {
    type: HrDocumentTemplateType.offer_letter,
    company: "ACRE Rentals",
    position: "Sales Assistant",
    name: "Template Rental Sales assistance Employment Letter-ACRE Rentals",
    driveFileId: "1vR6BsYDgbnxcl0F39cSLQypO6JuntBYnx7bZXzQh8Og",
    sourceUrl: "https://docs.google.com/document/d/1vR6BsYDgbnxcl0F39cSLQypO6JuntBYnx7bZXzQh8Og/edit",
  },
  {
    type: HrDocumentTemplateType.offer_letter,
    company: "ACRE Rentals",
    position: "Salesperson",
    name: "2026 Rental Salesperson Employment Letter - Templet.docx",
    driveFileId: "12CWNqC4A4-TDdvY1XaTvxoHFfrAcORy_",
    sourceUrl: "https://docs.google.com/document/d/12CWNqC4A4-TDdvY1XaTvxoHFfrAcORy_/edit",
  },
  {
    type: HrDocumentTemplateType.offer_letter,
    company: "Acre NJ",
    position: "Sales Assistant",
    name: "Template 2026 NJ Sales Assistant Employment Letter - Acre NJ",
    driveFileId: "1gdTdU30hk3SHIBT9tFDt8rBcrstuzczi2sP_LPe0tT4",
    sourceUrl: "https://docs.google.com/document/d/1gdTdU30hk3SHIBT9tFDt8rBcrstuzczi2sP_LPe0tT4/edit",
  },
  {
    type: HrDocumentTemplateType.nda,
    company: "ACRE NY",
    position: "",
    name: "ACRE NY NON-DISCLOSURE AGREEMENT (NDA) .docx",
    driveFileId: "1ZYdZ57rYixvqRbtd915ntFAk2Wmfusbh",
    sourceUrl: "https://docs.google.com/document/d/1ZYdZ57rYixvqRbtd915ntFAk2Wmfusbh/edit",
  },
  {
    type: HrDocumentTemplateType.nda,
    company: "ACRE NJ",
    position: "",
    name: "ACRE NJ NON-DISCLOSURE AGREEMENT (NDA) .docx",
    driveFileId: "1PitIMZC3epKdfKnSyRAs9EALfPctjlbD",
    sourceUrl: "https://docs.google.com/document/d/1PitIMZC3epKdfKnSyRAs9EALfPctjlbD/edit",
  },
  {
    type: HrDocumentTemplateType.nda,
    company: "ACRE Rentals",
    position: "",
    name: "ACRE RENTALS NON-DISCLOSURE AGREEMENT (NDA) .docx.pdf",
    driveFileId: "1Q6skKUvqvXJcmXgU0j8q6pF6hP-tbV6L",
    sourceUrl: "https://drive.google.com/file/d/1Q6skKUvqvXJcmXgU0j8q6pF6hP-tbV6L/view",
  },
  {
    type: HrDocumentTemplateType.employee_handbook,
    company: "ACRE",
    position: "",
    name: "Welcome guide PDF",
    driveFileId: "1pSbZK0bJQmYhdNpi7HrJzZNHcl1Gr7pi",
    sourceUrl: "https://drive.google.com/file/d/1pSbZK0bJQmYhdNpi7HrJzZNHcl1Gr7pi/view",
  },
  {
    type: HrDocumentTemplateType.other,
    company: "ACRE",
    position: "",
    name: "Finance process PDF",
    driveFileId: "1oU2vTQ0sIlKnuF8SERb5IZyc0xommXA-",
    sourceUrl: "https://drive.google.com/file/d/1oU2vTQ0sIlKnuF8SERb5IZyc0xommXA-/view",
  },
  {
    type: HrDocumentTemplateType.commission_after_termination,
    company: "ACRE NY",
    position: "",
    name: "Commission After Termination Agreement.docx",
    driveFileId: "19HgHdtmFaM0T4fNPtuklwXDyMcSMwjq2",
    sourceUrl: "https://docs.google.com/document/d/19HgHdtmFaM0T4fNPtuklwXDyMcSMwjq2/edit",
  },
  {
    type: HrDocumentTemplateType.termination_letter,
    company: "ACRE NY",
    position: "",
    name: "Termination Letter - NY（模版）",
    driveFileId: "1_TAEV5vfJ-Nd0HSFt7Swu31TJDQ8UDayiusFMqBuzOY",
    sourceUrl: "https://docs.google.com/document/d/1_TAEV5vfJ-Nd0HSFt7Swu31TJDQ8UDayiusFMqBuzOY/edit",
  },
  {
    type: HrDocumentTemplateType.termination_letter,
    company: "ACRE Rentals",
    position: "",
    name: "Termination Letter - Rentals",
    driveFileId: "199jjsMP-jfNL1712OgwL4fGE6UxAukO7e8JTh1CCdqM",
    sourceUrl: "https://docs.google.com/document/d/199jjsMP-jfNL1712OgwL4fGE6UxAukO7e8JTh1CCdqM/edit",
  },
  {
    type: HrDocumentTemplateType.termination_letter,
    company: "ACRE NJ",
    position: "",
    name: "Termination Letter - NJ",
    driveFileId: "1f4KZJIoDuGQi9HrGUpYgvyoO0VqWx3UCmZpdltF_k8g",
    sourceUrl: "https://docs.google.com/document/d/1f4KZJIoDuGQi9HrGUpYgvyoO0VqWx3UCmZpdltF_k8g/edit",
  },
] as const;

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseTemplateType(value: string | null | undefined) {
  return Object.values(HrDocumentTemplateType).includes(value as HrDocumentTemplateType)
    ? (value as HrDocumentTemplateType)
    : HrDocumentTemplateType.other;
}

function mapTemplate(record: {
  id: string;
  type: HrDocumentTemplateType;
  name: string;
  company: string | null;
  position: string | null;
  body: string | null;
  variables: string[];
  driveFileId: string | null;
  driveFolderId: string | null;
  sourceUrl: string | null;
  syncState: HrSyncState;
  syncError: string | null;
  isActive: boolean;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    company: record.company ?? "",
    position: record.position ?? "",
    body: record.body ?? "",
    variables: record.variables,
    driveFileId: record.driveFileId ?? "",
    driveFolderId: record.driveFolderId ?? "",
    sourceUrl: record.sourceUrl ?? "",
    syncState: record.syncState,
    syncError: record.syncError ?? "",
    isActive: record.isActive,
    updatedAt: formatDateTimeLabel(record.updatedAt),
    href: `/office/hr/templates/${record.id}`,
  };
}

export async function listHrDocumentTemplates(input: {
  organizationId: string;
  officeId?: string | null;
  type?: string | null;
}) {
  const type = parseTemplateType(input.type);
  const templates = await prisma.hrDocumentTemplate.findMany({
    where: {
      organizationId: input.organizationId,
      OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : undefined,
      ...(input.type ? { type } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return {
    defaults: defaultHrTemplateLinks,
    templates: templates.map(mapTemplate),
  };
}

export async function getHrDocumentTemplate(input: {
  organizationId: string;
  officeId?: string | null;
  templateId: string;
}) {
  const template = await prisma.hrDocumentTemplate.findFirst({
    where: {
      id: input.templateId,
      organizationId: input.organizationId,
      OR: input.officeId ? [{ officeId: input.officeId }, { officeId: null }] : undefined,
    },
  });

  return template ? mapTemplate(template) : null;
}

export async function saveHrDocumentTemplate(input: {
  organizationId: string;
  officeId?: string | null;
  actorMembershipId: string;
  templateId?: string | null;
  type?: string | null;
  name: string;
  company?: string | null;
  position?: string | null;
  body?: string | null;
  variables?: string[];
  driveFileId?: string | null;
  driveFolderId?: string | null;
  sourceUrl?: string | null;
}) {
  const name = normalizeOptional(input.name);
  if (!name) {
    throw new Error("Template name is required.");
  }

  const data = {
    organizationId: input.organizationId,
    officeId: input.officeId ?? null,
    createdByMembershipId: input.actorMembershipId,
    type: parseTemplateType(input.type),
    name,
    company: normalizeOptional(input.company),
    position: normalizeOptional(input.position),
    body: normalizeOptional(input.body),
    variables: input.variables ?? [],
    driveFileId: normalizeOptional(input.driveFileId),
    driveFolderId: normalizeOptional(input.driveFolderId),
    sourceUrl: normalizeOptional(input.sourceUrl),
    syncState: input.driveFileId || input.sourceUrl ? HrSyncState.synced : HrSyncState.not_applicable,
  };

  const saved = input.templateId
    ? await prisma.hrDocumentTemplate.update({
        where: {
          id: input.templateId,
          organizationId: input.organizationId,
        },
        data,
      })
    : await prisma.hrDocumentTemplate.create({ data });

  return mapTemplate(saved);
}

export function renderHrDocumentTemplateBody(
  body: string,
  variables: Record<string, string | number | null | undefined>,
) {
  return Object.entries(variables).reduce((current, [key, value]) => {
    const replacement = String(value ?? "");
    return current.replaceAll(`{{${key}}}`, replacement).replaceAll(`[${key}]`, replacement);
  }, body);
}
