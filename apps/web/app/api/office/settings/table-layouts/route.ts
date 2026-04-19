import { canManageOfficeSettings } from "@acre/auth";
import { getOfficeTableLayouts, saveOfficeTableLayout, type OfficeTableLayoutColumn } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { saveOfficeTableLayoutBodySchema } from "./route.schema";

type TableLayoutRequestBody = {
  tableKey?: string;
  columns?: Array<{
    key?: string;
    width?: number;
  }>;
} | null;

type TableLayoutRequestColumns = Array<{
  key?: string;
  width?: number;
}> | undefined;

function normalizeColumns(value: TableLayoutRequestColumns): OfficeTableLayoutColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((column) => {
    if (!column || typeof column.key !== "string" || typeof column.width !== "number") {
      return [];
    }

    return [
      {
        key: column.key,
        width: column.width
      }
    ];
  });
}

export async function GET(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const layouts = await getOfficeTableLayouts({
    organizationId: context.currentOrganization.id
  });

  return NextResponse.json({ layouts });
}

export async function handleSaveOfficeTableLayoutPut(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    saveOfficeTableLayout?: typeof saveOfficeTableLayout;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, saveOfficeTableLayoutBodySchema, {
    error: "Table layout payload is invalid.",
    invalidJsonError: "Table layout payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data as TableLayoutRequestBody;

  try {
    const layout = await (dependencies.saveOfficeTableLayout ?? saveOfficeTableLayout)({
      organizationId: context.currentOrganization.id,
      actorMembershipId: context.currentMembership.id,
      tableKey: body?.tableKey ?? "",
      columns: normalizeColumns(body?.columns)
    });

    return NextResponse.json({ layout });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save the table layout." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSettings(context.currentMembership)) {
    return NextResponse.json({ error: "Settings management permission required." }, { status: 403 });
  }

  return handleSaveOfficeTableLayoutPut(request, context);
}
