import {
  createOfficeVendor,
  type SessionMembershipContext,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { requireOfficeAdminRequestContext } from "../_helpers";
import { createOfficeVendorBodySchema } from "./route.schema";

export const runtime = "nodejs";

type VendorBody = {
  category?: string;
  name?: string;
  headline?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  neighborhoods?: string[];
  notes?: string | null;
  isFeatured?: boolean;
  visibilityScope?: "organization_wide" | "office_only";
};

const sharedVisibilityScope = "organization_wide" as const;

type OfficeVendorsRouteDependencies = {
  parseJsonBody?: typeof parseJsonBody;
  createOfficeVendor?: typeof createOfficeVendor;
};

export async function POST(request: NextRequest) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  return handleCreateOfficeVendorPost(request, access.context);
}

export async function handleCreateOfficeVendorPost(
  request: NextRequest,
  context: SessionMembershipContext,
  dependencies: OfficeVendorsRouteDependencies = {},
) {
  const parsedBody = await (
    dependencies.parseJsonBody ?? parseJsonBody
  )(request, createOfficeVendorBodySchema, {
    error: "Vendor payload is invalid.",
    invalidJsonError: "Vendor request body must be valid JSON.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  try {
    const vendorId = await (
      dependencies.createOfficeVendor ?? createOfficeVendor
    )({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      category: String(body.category ?? ""),
      name: String(body.name ?? ""),
      headline: String(body.headline ?? ""),
      phone: body.phone ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      neighborhoods: body.neighborhoods ?? [],
      notes: body.notes ?? null,
      isFeatured: Boolean(body.isFeatured),
      visibilityScope: sharedVisibilityScope,
    });

    return NextResponse.json({ vendorId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create vendor.",
      },
      { status: 400 },
    );
  }
}
