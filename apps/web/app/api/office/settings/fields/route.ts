import { canManageOfficeFields } from "@acre/auth";
import { saveOfficeFieldSettings } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import { parseJsonBody } from "../../../../../lib/api/parse-body";
import { officeFieldSettingsBodySchema } from "./route.schema";

export async function handleSaveOfficeFieldSettingsPatch(
  request: NextRequest,
  context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>,
  dependencies: {
    saveOfficeFieldSettings?: typeof saveOfficeFieldSettings;
  } = {}
) {
  const parsedBody = await parseJsonBody(request, officeFieldSettingsBodySchema, {
    error: "Field settings payload is invalid.",
    invalidJsonError: "Field settings payload must be valid JSON."
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;

  try {
    const snapshot = await (dependencies.saveOfficeFieldSettings ?? saveOfficeFieldSettings)({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body.module ?? "transaction",
      contactRoleSettings:
        body.contactRoleSettings?.map((entry) => ({
          role: entry.role ?? "",
          isRequired: Boolean(entry.isRequired)
        })) ?? [],
      builtInFieldSettings:
        body.builtInFieldSettings?.map((entry) => ({
          fieldKey: entry.fieldKey ?? "",
          label: typeof entry.label === "string" ? entry.label : undefined,
          isRequired: Boolean(entry.isRequired),
          isVisible: typeof entry.isVisible === "boolean" ? entry.isVisible : true,
          sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : undefined,
          selectOptions: Array.isArray(entry.selectOptions)
            ? entry.selectOptions.map((option) => ({
                value: String(option.value ?? ""),
                label: String(option.label ?? ""),
                isEnabled: Boolean(option.isEnabled)
              }))
            : undefined
        })) ?? [],
      customFieldDefinitions:
        body.customFieldDefinitions?.map((entry) => ({
          fieldKey: entry.fieldKey ?? "",
          label: entry.label ?? "",
          type: entry.type ?? "",
          isRequired: Boolean(entry.isRequired),
          isVisible: typeof entry.isVisible === "boolean" ? entry.isVisible : true,
          isDeletionLocked:
            typeof entry.isDeletionLocked === "boolean" ? entry.isDeletionLocked : undefined,
          sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : undefined,
          options: Array.isArray(entry.options) ? entry.options.map((option) => String(option ?? "")) : []
        })) ?? []
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save field settings." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  return handleSaveOfficeFieldSettingsPatch(request, context);
}
