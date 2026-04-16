import { createOfficeVendor } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireOfficeAdminRequestContext } from "../_helpers";

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

export async function POST(request: NextRequest) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const body = (await request.json().catch(() => null)) as VendorBody | null;

  try {
    const vendorId = await createOfficeVendor({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      category: String(body?.category ?? ""),
      name: String(body?.name ?? ""),
      headline: String(body?.headline ?? ""),
      phone: body?.phone ?? null,
      email: body?.email ?? null,
      website: body?.website ?? null,
      neighborhoods: Array.isArray(body?.neighborhoods)
        ? body.neighborhoods
        : [],
      notes: body?.notes ?? null,
      isFeatured: Boolean(body?.isFeatured),
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
