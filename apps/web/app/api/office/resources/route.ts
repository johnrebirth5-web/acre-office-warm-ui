import { createOfficeResource } from "@acre/db";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireOfficeAdminRequestContext } from "./_helpers";

export const runtime = "nodejs";

type ResourceBody = {
  title?: string;
  summary?: string;
  url?: string;
  tags?: string[];
  type?: string;
  isPublished?: boolean;
  visibilityScope?: "organization_wide" | "office_only";
};

const allowedTypes = new Set<ResourceType>([
  ResourceType.playbook,
  ResourceType.template,
  ResourceType.document,
  ResourceType.training_video,
]);

export async function POST(request: NextRequest) {
  const access = await requireOfficeAdminRequestContext(request);

  if (access.response) {
    return access.response;
  }

  const body = (await request.json().catch(() => null)) as ResourceBody | null;
  const type = body?.type as ResourceType | undefined;

  if (!type || !allowedTypes.has(type)) {
    return NextResponse.json(
      { error: "A supported resource type is required." },
      { status: 400 },
    );
  }

  try {
    const resourceId = await createOfficeResource({
      organizationId: access.context.currentOrganization.id,
      officeId: access.context.currentOffice?.id ?? null,
      title: String(body?.title ?? ""),
      summary: String(body?.summary ?? ""),
      url: String(body?.url ?? ""),
      tags: Array.isArray(body?.tags) ? body.tags : [],
      type,
      isPublished: Boolean(body?.isPublished),
      visibilityScope: body?.visibilityScope === "organization_wide"
        ? "organization_wide"
        : "office_only",
    });

    return NextResponse.json({ resourceId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create resource.",
      },
      { status: 400 },
    );
  }
}
