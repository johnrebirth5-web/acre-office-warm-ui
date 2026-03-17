import { Prisma } from "@prisma/client";
import { activityLogActions, recordActivityLogEvent } from "./activity-log";
import { prisma } from "./client";

const tableKeyPattern = /^[a-z0-9:_-]{1,120}$/;
const columnKeyPattern = /^[a-z0-9:_-]{1,120}$/;
const minimumColumnWidth = 56;
const maximumColumnWidth = 2400;
const maximumColumnCount = 24;

export type OfficeTableLayoutColumn = {
  key: string;
  width: number;
};

export type OfficeTableLayoutMap = Record<string, OfficeTableLayoutColumn[]>;

function isOfficeTableLayoutColumn(value: unknown): value is OfficeTableLayoutColumn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OfficeTableLayoutColumn>;
  return typeof candidate.key === "string" && typeof candidate.width === "number";
}

function normalizeOfficeTableLayoutColumns(value: Prisma.JsonValue | null | undefined): OfficeTableLayoutColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isOfficeTableLayoutColumn(entry)) {
      return [];
    }

    const key = entry.key.trim().toLowerCase();
    const width = Math.round(entry.width);

    if (!columnKeyPattern.test(key) || !Number.isFinite(width) || width < minimumColumnWidth || width > maximumColumnWidth) {
      return [];
    }

    return [{ key, width }];
  });
}

function validateTableKey(tableKey: string) {
  const normalized = tableKey.trim().toLowerCase();

  if (!tableKeyPattern.test(normalized)) {
    throw new Error("A supported table key is required.");
  }

  return normalized;
}

function validateColumns(columns: OfficeTableLayoutColumn[]) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("At least one column width is required.");
  }

  if (columns.length > maximumColumnCount) {
    throw new Error("Too many column widths were submitted.");
  }

  const seen = new Set<string>();

  return columns.map((column) => {
    const key = column.key.trim().toLowerCase();
    const width = Math.round(column.width);

    if (!columnKeyPattern.test(key)) {
      throw new Error("A supported column key is required.");
    }

    if (seen.has(key)) {
      throw new Error("Duplicate column keys are not allowed.");
    }

    if (!Number.isFinite(width) || width < minimumColumnWidth || width > maximumColumnWidth) {
      throw new Error("Column widths must stay within the supported range.");
    }

    seen.add(key);

    return {
      key,
      width
    };
  });
}

export async function getOfficeTableLayouts(input: {
  organizationId: string;
}): Promise<OfficeTableLayoutMap> {
  const rows = await prisma.organizationTableLayout.findMany({
    where: {
      organizationId: input.organizationId
    },
    orderBy: {
      tableKey: "asc"
    }
  });

  return Object.fromEntries(
    rows.flatMap((row) => {
      const columns = normalizeOfficeTableLayoutColumns(row.columnLayout as Prisma.JsonValue);
      return columns.length ? [[row.tableKey, columns] satisfies [string, OfficeTableLayoutColumn[]]] : [];
    })
  );
}

export async function saveOfficeTableLayout(input: {
  organizationId: string;
  actorMembershipId: string;
  tableKey: string;
  columns: OfficeTableLayoutColumn[];
}) {
  const tableKey = validateTableKey(input.tableKey);
  const columns = validateColumns(input.columns);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.organizationTableLayout.findUnique({
      where: {
        organizationId_tableKey: {
          organizationId: input.organizationId,
          tableKey
        }
      }
    });

    const saved = await tx.organizationTableLayout.upsert({
      where: {
        organizationId_tableKey: {
          organizationId: input.organizationId,
          tableKey
        }
      },
      create: {
        organizationId: input.organizationId,
        updatedByMembershipId: input.actorMembershipId,
        tableKey,
        columnLayout: columns as Prisma.InputJsonValue
      },
      update: {
        updatedByMembershipId: input.actorMembershipId,
        columnLayout: columns as Prisma.InputJsonValue
      }
    });

    await recordActivityLogEvent(tx, {
      organizationId: input.organizationId,
      membershipId: input.actorMembershipId,
      entityType: "organization_table_layout",
      entityId: saved.id,
      action: activityLogActions.settingsTableLayoutUpdated,
      payload: {
        objectLabel: `Table layout · ${tableKey}`,
        details: [`Saved ${columns.length} shared column width${columns.length === 1 ? "" : "s"}.`],
        changes: [
          {
            label: "Table",
            previousValue: existing?.tableKey ?? null,
            nextValue: tableKey
          }
        ]
      }
    });

    return {
      id: saved.id,
      tableKey: saved.tableKey,
      columns
    };
  });
}
