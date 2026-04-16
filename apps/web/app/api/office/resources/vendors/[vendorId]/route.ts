import { deleteOfficeVendor, updateOfficeVendor } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { requireOfficeAdminRequestContext } from "../../_helpers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    vendorId: string;
  }>;
};

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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const body = (await request.json().catch(() => null)) as VendorBody | null;
  const { vendorId } = await params;

  try {
    const updatedVendorId = await updateOfficeVendor({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      vendorId,
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
      visibilityScope: body?.visibilityScope === "organization_wide"
        ? "organization_wide"
        : "office_only",
    });

    if (!updatedVendorId) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    return NextResponse.json({ vendorId: updatedVendorId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update vendor.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const { vendorId } = await params;

  try {
    const removed = await deleteOfficeVendor({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      vendorId,
    });

    if (!removed) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete vendor.",
      },
      { status: 400 },
    );
  }
}
