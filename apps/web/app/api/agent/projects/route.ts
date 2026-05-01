import {
  canCreateProjectSigning,
  canViewProjectSigning,
  createSalesProject,
  findSimilarSalesProjects,
  getFrontOfficeProjectSigningSnapshot,
} from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSessionContext } from "../../../../lib/auth-session";
import { parseJsonBody } from "../../../../lib/api/parse-body";

const createProjectBodySchema = z.object({
  code: z.string().trim().min(1, "Project code is required."),
  name: z.string().trim().min(1, "Project name is required."),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  description: z.string().trim().optional(),
  archiveSinkEmails: z.array(z.string().trim()).optional(),
  defaultResponsibleMembershipId: z.string().trim().optional(),
  force: z.boolean().optional(),
});

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canViewProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing access required." }, { status: 403 });
  }

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";
  const snapshot = await getFrontOfficeProjectSigningSnapshot({
    ...buildProjectSigningContext(context),
    includeArchived,
  });

  return NextResponse.json({ snapshot });
}

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const parsedBody = await parseJsonBody(request, createProjectBodySchema, {
    error: "Project payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const projectContext = buildProjectSigningContext(context);

  if (!parsedBody.data.force) {
    const similar = await findSimilarSalesProjects({
      ...projectContext,
      code: parsedBody.data.code,
      name: parsedBody.data.name,
    });

    if (similar.length > 0) {
      return NextResponse.json(
        {
          error: "A project with the same code or name already exists in this office.",
          similarProjects: similar.map((project) => ({
            id: project.id,
            code: project.code,
            name: project.name,
            status: project.status,
          })),
        },
        { status: 409 },
      );
    }
  }

  try {
    const project = await createSalesProject({
      ...projectContext,
      code: parsedBody.data.code,
      name: parsedBody.data.name,
      address: parsedBody.data.address,
      city: parsedBody.data.city,
      state: parsedBody.data.state,
      zipCode: parsedBody.data.zipCode,
      description: parsedBody.data.description,
      archiveSinkEmails: parsedBody.data.archiveSinkEmails ?? [],
      defaultResponsibleMembershipId: parsedBody.data.defaultResponsibleMembershipId || null,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project could not be created." },
      { status: 400 },
    );
  }
}

