import { canManageOfficeFields } from "@acre/auth";
import { saveOfficeFieldSettings } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";

export async function PATCH(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeFields(context.currentMembership)) {
    return NextResponse.json({ error: "Field settings permission required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        module?: string;
        contactRoleSettings?: Array<{
          role?: string;
          isRequired?: boolean;
        }>;
        builtInFieldSettings?: Array<{
          fieldKey?: string;
          isRequired?: boolean;
          isVisible?: boolean;
          sortOrder?: number;
          selectOptions?: Array<{
            value?: string;
            label?: string;
            isEnabled?: boolean;
          }>;
        }>;
        customFieldDefinitions?: Array<{
          fieldKey?: string;
          label?: string;
          type?: string;
          isRequired?: boolean;
          isVisible?: boolean;
          isDeletionLocked?: boolean;
          sortOrder?: number;
          options?: string[];
        }>;
      }
    | null;

  try {
    const snapshot = await saveOfficeFieldSettings({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      actorMembershipId: context.currentMembership.id,
      module: body?.module === "contact" || body?.module === "offer" ? body.module : "transaction",
      contactRoleSettings:
        body?.contactRoleSettings?.map((entry) => ({
          role: entry.role ?? "",
          isRequired: Boolean(entry.isRequired)
        })) ?? [],
      builtInFieldSettings:
        body?.builtInFieldSettings?.map((entry) => ({
          fieldKey: entry.fieldKey ?? "",
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
        body?.customFieldDefinitions?.map((entry) => ({
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
