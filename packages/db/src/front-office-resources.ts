import { ResourceType } from "@prisma/client";
import { prisma } from "./client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";

export const frontOfficeVendorInteractionActions = [
  "phone",
  "email",
  "website",
  "primary",
] as const;

export type FrontOfficeVendorInteractionAction =
  (typeof frontOfficeVendorInteractionActions)[number];

type FrontOfficeResourceInteractionInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  resourceId: string;
};

type FrontOfficeVendorInteractionInput = {
  organizationId: string;
  membershipId: string;
  officeId?: string | null;
  vendorId: string;
  action: FrontOfficeVendorInteractionAction;
};

function buildOfficeScopeFilter(officeId: string | null | undefined) {
  if (!officeId) {
    return undefined;
  }

  return {
    OR: [{ officeId }, { officeId: null }],
  };
}

function formatResourceTypeLabel(type: ResourceType) {
  switch (type) {
    case ResourceType.playbook:
      return "Playbook";
    case ResourceType.template:
      return "Template";
    case ResourceType.document:
      return "Document";
    case ResourceType.training_video:
      return "Training video";
    case ResourceType.vendor_card:
      return "Vendor support card";
    default:
      return "Resource";
  }
}

function getResourceActionLabel(type: ResourceType) {
  switch (type) {
    case ResourceType.playbook:
      return "Open playbook";
    case ResourceType.template:
      return "Open template";
    case ResourceType.document:
      return "Open document";
    case ResourceType.training_video:
      return "Watch training";
    case ResourceType.vendor_card:
      return "Open vendor card";
    default:
      return "Open resource";
  }
}

function formatVendorActionLabel(action: FrontOfficeVendorInteractionAction) {
  switch (action) {
    case "phone":
      return "Call";
    case "email":
      return "Email";
    case "website":
      return "Open site";
    case "primary":
      return "Open vendor card";
    default:
      return "Open vendor";
  }
}

export async function recordFrontOfficeResourceOpen(
  input: FrontOfficeResourceInteractionInput,
) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const resource = await prisma.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      isPublished: true,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      title: true,
      type: true,
    },
  });

  if (!resource) {
    throw new Error("Resource was not found.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "resource",
    entityId: resource.id,
    action: activityLogActions.frontOfficeResourceOpened,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: resource.title,
      contextHref: "/agent/resources#published-tool-library",
      actionSource: "front_office_resource_hub",
      details: [
        `Lane: ${formatResourceTypeLabel(resource.type)}`,
        `Action: ${getResourceActionLabel(resource.type)}`,
      ],
    },
  });
}

export async function recordFrontOfficeVendorClick(
  input: FrontOfficeVendorInteractionInput,
) {
  const officeScopeFilter = buildOfficeScopeFilter(input.officeId ?? null);
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: input.vendorId,
      organizationId: input.organizationId,
      ...(officeScopeFilter ? { AND: [officeScopeFilter] } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      phone: true,
      email: true,
      website: true,
    },
  });

  if (!vendor) {
    throw new Error("Vendor was not found.");
  }

  if (input.action === "phone" && !vendor.phone?.trim()) {
    throw new Error("Vendor phone action is not available.");
  }

  if (input.action === "email" && !vendor.email?.trim()) {
    throw new Error("Vendor email action is not available.");
  }

  if (input.action === "website" && !vendor.website?.trim()) {
    throw new Error("Vendor website action is not available.");
  }

  if (
    input.action === "primary" &&
    !vendor.website?.trim() &&
    !vendor.phone?.trim() &&
    !vendor.email?.trim()
  ) {
    throw new Error("Vendor primary action is not available.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "vendor",
    entityId: vendor.id,
    action: activityLogActions.frontOfficeVendorClicked,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: vendor.name,
      contextHref: "/agent/resources#vendor-hub",
      actionSource: "front_office_resource_hub",
      details: [
        `Action: ${formatVendorActionLabel(input.action)}`,
        `Category: ${vendor.category || "Vendor"}`,
      ],
    },
  });
}
