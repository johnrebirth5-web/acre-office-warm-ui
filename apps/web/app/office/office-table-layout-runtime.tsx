"use client";

import { useEffect, useRef } from "react";

type OfficeTableLayoutColumn = {
  key: string;
  width: number;
};

type OfficeTableLayoutMap = Record<string, OfficeTableLayoutColumn[]>;

type GridTableGroup = {
  kind: "grid";
  key: string;
  headerRows: HTMLElement[];
  elements: HTMLElement[];
};

type NativeTableGroup = {
  kind: "native";
  key: string;
  headerRows: HTMLTableRowElement[];
  tables: HTMLTableElement[];
};

type TableGroup = GridTableGroup | NativeTableGroup;

type DragState = {
  key: string;
  columnIndex: number;
  columns: OfficeTableLayoutColumn[];
  startX: number;
  startLeftWidth: number;
  startRightWidth: number;
};

const GRID_TABLE_ELEMENT_SELECTOR = [
  ".office-dashboard-transactions-head",
  ".office-dashboard-transactions-row",
  ".office-pipeline-table-head",
  ".office-pipeline-row",
  ".office-agents-roster-head",
  ".office-agents-roster-row",
  ".office-agents-team-table-head",
  ".office-agents-team-table-row",
  ".office-list-table-header[class*='office-list-table-header-']",
  ".office-list-table-row[class*='office-list-table-row-']",
  ".office-table-header[class*='office-table-row-']",
  ".office-table-row[class*='office-table-row-']"
].join(", ");

const GRID_HEADER_SELECTOR = [
  ".office-dashboard-transactions-head",
  ".office-pipeline-table-head",
  ".office-agents-roster-head",
  ".office-agents-team-table-head",
  ".office-list-table-header[class*='office-list-table-header-']",
  ".office-table-header[class*='office-table-row-']"
].join(", ");

const minimumColumnWidth = 72;

function sanitizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getHeaderText(node: HTMLElement) {
  return node.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function getColumnKey(cell: HTMLElement, index: number) {
  const explicitKey = cell.dataset.officeColumnKey;

  if (explicitKey) {
    return sanitizeToken(explicitKey);
  }

  const labelKey = sanitizeToken(getHeaderText(cell));

  if (labelKey) {
    return labelKey;
  }

  const semanticClass = Array.from(cell.classList).find(
    (className) =>
      (className.startsWith("office-") || className.startsWith("bm-")) &&
      !className.endsWith("status-badge") &&
      !className.endsWith("badge")
  );

  if (semanticClass) {
    return sanitizeToken(semanticClass);
  }

  return `column-${index + 1}`;
}

function isGridHeaderRow(element: HTMLElement) {
  return element.matches(GRID_HEADER_SELECTOR);
}

function deriveGridTableKey(element: HTMLElement) {
  for (const className of element.classList) {
    const listMatch = className.match(/^office-list-table-(?:header|row)-(.+)$/);

    if (listMatch) {
      return `grid:office-list-table:${listMatch[1]}`;
    }

    const tableRowMatch = className.match(/^office-table-row-(.+)$/);

    if (tableRowMatch) {
      return `grid:office-table-row:${tableRowMatch[1]}`;
    }

    if (className === "office-dashboard-transactions-head" || className === "office-dashboard-transactions-row") {
      return "grid:office-dashboard-transactions";
    }

    if (className === "office-pipeline-table-head" || className === "office-pipeline-row") {
      return "grid:office-pipeline";
    }

    if (className === "office-agents-roster-head" || className === "office-agents-roster-row") {
      return "grid:office-agents-roster";
    }

    if (className === "office-agents-team-table-head" || className === "office-agents-team-table-row") {
      return "grid:office-agents-team-table";
    }
  }

  return null;
}

function deriveNativeTableKey(table: HTMLTableElement) {
  const preferredClass = Array.from(table.classList).find((className) => /^(office|bm)-.*table/.test(className));
  return preferredClass ? `native:${preferredClass}` : null;
}

function getGridHeaderCells(headerRow: HTMLElement) {
  return Array.from(headerRow.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function getNativeHeaderCells(headerRow: HTMLTableRowElement) {
  return Array.from(headerRow.cells).filter((cell): cell is HTMLTableCellElement => cell instanceof HTMLTableCellElement);
}

function measureColumns(cells: HTMLElement[]) {
  return cells.map((cell, index) => ({
    key: getColumnKey(cell, index),
    width: Math.max(Math.round(cell.getBoundingClientRect().width), minimumColumnWidth)
  }));
}

function resolveColumnsForHeader(cells: HTMLElement[], persisted: OfficeTableLayoutColumn[] | undefined) {
  const measured = measureColumns(cells);

  if (!persisted?.length) {
    return measured;
  }

  const persistedByKey = new Map(persisted.map((column) => [column.key, column.width]));

  return measured.map((column) => ({
    key: column.key,
    width: Math.max(Math.round(persistedByKey.get(column.key) ?? column.width), minimumColumnWidth)
  }));
}

function buildGridTemplate(columns: OfficeTableLayoutColumn[]) {
  return columns.map((column) => `${Math.max(Math.round(column.width), minimumColumnWidth)}px`).join(" ");
}

function applyGridColumns(group: GridTableGroup, columns: OfficeTableLayoutColumn[]) {
  const gridTemplateColumns = buildGridTemplate(columns);
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

  group.elements.forEach((element) => {
    element.style.gridTemplateColumns = gridTemplateColumns;
    element.style.minWidth = `${totalWidth}px`;
    element.dataset.officeTableLayoutKey = group.key;
  });
}

function syncNativeColGroup(table: HTMLTableElement, columns: OfficeTableLayoutColumn[]) {
  let colGroup = table.querySelector(":scope > colgroup[data-office-table-layout='true']");

  if (!(colGroup instanceof HTMLTableColElement)) {
    colGroup = document.createElement("colgroup");
    colGroup.setAttribute("data-office-table-layout", "true");
    table.prepend(colGroup);
  }

  const nextColumnCount = columns.length;

  while (colGroup.children.length > nextColumnCount) {
    colGroup.lastElementChild?.remove();
  }

  while (colGroup.children.length < nextColumnCount) {
    colGroup.appendChild(document.createElement("col"));
  }

  Array.from(colGroup.children).forEach((columnNode, index) => {
    if (!(columnNode instanceof HTMLTableColElement)) {
      return;
    }

    const width = `${columns[index]?.width ?? minimumColumnWidth}px`;
    columnNode.style.width = width;
    columnNode.style.minWidth = width;
    columnNode.style.maxWidth = width;
  });

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  table.style.tableLayout = "fixed";
  table.style.width = `${totalWidth}px`;
  table.style.minWidth = `${totalWidth}px`;
}

function applyNativeColumns(group: NativeTableGroup, columns: OfficeTableLayoutColumn[]) {
  group.tables.forEach((table) => {
    syncNativeColGroup(table, columns);
    table.dataset.officeTableLayoutKey = group.key;
  });
}

function buildTableGroups(root: ParentNode): Map<string, TableGroup> {
  const groups = new Map<string, TableGroup>();

  root.querySelectorAll<HTMLElement>(GRID_TABLE_ELEMENT_SELECTOR).forEach((element) => {
    const key = deriveGridTableKey(element);

    if (!key) {
      return;
    }

    const existing = groups.get(key);

    if (existing?.kind === "grid") {
      existing.elements.push(element);

      if (isGridHeaderRow(element)) {
        existing.headerRows.push(element);
      }

      return;
    }

    groups.set(key, {
      kind: "grid",
      key,
      headerRows: isGridHeaderRow(element) ? [element] : [],
      elements: [element]
    });
  });

  root.querySelectorAll<HTMLTableElement>("table[class]").forEach((table) => {
    const key = deriveNativeTableKey(table);
    const headerRow = table.tHead?.rows.item(0);

    if (!key || !(headerRow instanceof HTMLTableRowElement)) {
      return;
    }

    const existing = groups.get(key);

    if (existing?.kind === "native") {
      existing.tables.push(table);
      existing.headerRows.push(headerRow);
      return;
    }

    groups.set(key, {
      kind: "native",
      key,
      headerRows: [headerRow],
      tables: [table]
    });
  });

  return groups;
}

function OfficeTableLayoutRuntime(props: {
  canManageTableLayouts: boolean;
}) {
  const layoutsRef = useRef<OfficeTableLayoutMap>({});
  const groupsRef = useRef<Map<string, TableGroup>>(new Map());
  const scanFrameRef = useRef<number | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const canManageRef = useRef(props.canManageTableLayouts);

  useEffect(() => {
    canManageRef.current = props.canManageTableLayouts;
  }, [props.canManageTableLayouts]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    function applyLayout(key: string, columns: OfficeTableLayoutColumn[]) {
      const group = groupsRef.current.get(key);

      if (!group || !columns.length) {
        return;
      }

      if (group.kind === "grid") {
        applyGridColumns(group, columns);
        return;
      }

      applyNativeColumns(group, columns);
    }

    function getHeaderColumnsForKey(key: string) {
      const group = groupsRef.current.get(key);

      if (!group) {
        return [];
      }

      if (group.kind === "grid") {
        const headerRow = group.headerRows[0];
        return headerRow ? resolveColumnsForHeader(getGridHeaderCells(headerRow), layoutsRef.current[key]) : [];
      }

      const headerRow = group.headerRows[0];
      return headerRow ? resolveColumnsForHeader(getNativeHeaderCells(headerRow), layoutsRef.current[key]) : [];
    }

    async function persistLayout(key: string, columns: OfficeTableLayoutColumn[]) {
      if (!canManageRef.current) {
        return;
      }

      try {
        const response = await fetch("/api/office/settings/table-layouts", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tableKey: key,
            columns
          })
        });

        if (!response.ok) {
          throw new Error("Failed to save the shared table layout.");
        }

        const payload = (await response.json()) as {
          layout?: {
            tableKey: string;
            columns: OfficeTableLayoutColumn[];
          };
        };

        if (payload.layout?.tableKey) {
          layoutsRef.current[payload.layout.tableKey] = payload.layout.columns;
          applyLayout(payload.layout.tableKey, payload.layout.columns);
        }
      } catch (error) {
        console.error(error);
      }
    }

    function stopDragging() {
      dragStateRef.current = null;
      document.body.classList.remove("office-table-column-resizing");
    }

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      const delta = event.clientX - dragState.startX;
      const total = dragState.startLeftWidth + dragState.startRightWidth;
      const nextLeftWidth = Math.max(minimumColumnWidth, Math.min(dragState.startLeftWidth + delta, total - minimumColumnWidth));
      const nextRightWidth = Math.max(minimumColumnWidth, total - nextLeftWidth);
      const nextColumns = dragState.columns.map((column) => ({ ...column }));

      nextColumns[dragState.columnIndex] = {
        ...nextColumns[dragState.columnIndex],
        width: nextLeftWidth
      };
      nextColumns[dragState.columnIndex + 1] = {
        ...nextColumns[dragState.columnIndex + 1],
        width: nextRightWidth
      };

      dragStateRef.current = {
        ...dragState,
        columns: nextColumns
      };

      applyLayout(dragState.key, nextColumns);
    }

    function handlePointerUp() {
      const dragState = dragStateRef.current;

      if (dragState) {
        layoutsRef.current[dragState.key] = dragState.columns;
        void persistLayout(dragState.key, dragState.columns);
      }

      stopDragging();
    }

    function startDragging(key: string, columnIndex: number, event: PointerEvent) {
      const columns = getHeaderColumnsForKey(key);
      const leftColumn = columns[columnIndex];
      const rightColumn = columns[columnIndex + 1];

      if (!leftColumn || !rightColumn) {
        return;
      }

      dragStateRef.current = {
        key,
        columnIndex,
        columns,
        startX: event.clientX,
        startLeftWidth: leftColumn.width,
        startRightWidth: rightColumn.width
      };

      document.body.classList.add("office-table-column-resizing");
      event.preventDefault();
    }

    function ensureResizeHandles(key: string, headerCells: HTMLElement[]) {
      if (!canManageRef.current || headerCells.length < 2) {
        return;
      }

      headerCells.forEach((cell, index) => {
        if (index === headerCells.length - 1) {
          return;
        }

        if (cell.querySelector(":scope > .office-table-resize-handle")) {
          return;
        }

        const handle = document.createElement("div");
        handle.className = "office-table-resize-handle";
        handle.setAttribute("aria-hidden", "true");
        handle.dataset.officeTableResizeKey = key;
        handle.dataset.officeTableResizeIndex = String(index);
        handle.addEventListener("pointerdown", (event) => {
          startDragging(key, index, event);
        });
        cell.appendChild(handle);
        cell.classList.add("office-table-resizable-cell");
      });
    }

    function rescanTables() {
      scanFrameRef.current = null;
      const groups = buildTableGroups(document);
      groupsRef.current = groups;

      groups.forEach((group, key) => {
        if (group.kind === "grid") {
          group.headerRows.forEach((headerRow) => {
            ensureResizeHandles(key, getGridHeaderCells(headerRow));
          });
        } else {
          group.headerRows.forEach((headerRow) => {
            ensureResizeHandles(key, getNativeHeaderCells(headerRow));
          });
        }

        const persisted = layoutsRef.current[key];

        if (!persisted?.length) {
          return;
        }

        const headerRow = group.headerRows[0];

        if (!headerRow) {
          return;
        }

        const cells = group.kind === "grid" ? getGridHeaderCells(headerRow) : getNativeHeaderCells(headerRow as HTMLTableRowElement);
        const resolvedColumns = resolveColumnsForHeader(cells, persisted);
        applyLayout(key, resolvedColumns);
      });
    }

    function scheduleRescan() {
      if (scanFrameRef.current !== null) {
        return;
      }

      scanFrameRef.current = window.requestAnimationFrame(() => {
        rescanTables();
      });
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);

    const observer = new MutationObserver(() => {
      scheduleRescan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    void fetch("/api/office/settings/table-layouts", {
      signal: abortController.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load shared table layouts.");
        }

        return (await response.json()) as {
          layouts?: OfficeTableLayoutMap;
        };
      })
      .then((payload) => {
        if (isCancelled) {
          return;
        }

        layoutsRef.current = payload.layouts ?? {};
        rescanTables();
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          console.error(error);
        }

        if (!isCancelled) {
          rescanTables();
        }
      });

    return () => {
      isCancelled = true;
      abortController.abort();
      observer.disconnect();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);

      if (scanFrameRef.current !== null) {
        window.cancelAnimationFrame(scanFrameRef.current);
      }

      stopDragging();
    };
  }, []);

  return null;
}

export { OfficeTableLayoutRuntime };
