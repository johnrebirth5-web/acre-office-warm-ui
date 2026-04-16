"use client";

import type { PermissionKey } from "@acre/auth";
import type {
  OfficeAdminUserDetailSnapshot,
  PermissionOverrideValue,
  PermissionTreeStateNode,
} from "@acre/db";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Button,
  ConfirmActionDialog,
  ListPageStatsGrid,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@acre/ui";
import {
  buildPermissionOverrideMap,
  buildPermissionTreeMaps,
  buildPreviewPermissionTree,
  serializePermissionOverrideMap,
  type PermissionOverrideMap,
} from "../../../permissions-shared";

type OfficeSettingsUserPermissionsClientProps = {
  snapshot: OfficeAdminUserDetailSnapshot;
  canManagePermissions: boolean;
};

type PermissionScopeOption = {
  key: string;
  label: string;
  description: string;
  scope: "global" | "company";
  officeId: string | null;
  permissions: OfficeAdminUserDetailSnapshot["permissions"];
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function countPermissionNodes(node: PermissionTreeStateNode): number {
  return (
    1 +
    node.children.reduce(
      (total, child) => total + countPermissionNodes(child),
      0,
    )
  );
}

function splitPermissionColumns(nodes: PermissionTreeStateNode[]) {
  const columns: PermissionTreeStateNode[][] = [[], []];
  const weights = [0, 0];

  for (const node of nodes) {
    const targetColumn = weights[0] <= weights[1] ? 0 : 1;
    const weight = countPermissionNodes(node);
    columns[targetColumn].push(node);
    weights[targetColumn] += weight;
  }

  return columns;
}

function getPermissionSourceLabel(node: PermissionTreeStateNode) {
  if (node.overrideEffect === "allow") {
    return "User allow";
  }

  if (node.overrideEffect === "deny") {
    return "User deny";
  }

  return "";
}

function applyDesiredState(
  overrides: PermissionOverrideMap,
  node: PermissionTreeStateNode,
  desiredEnabled: boolean,
) {
  if (desiredEnabled === node.inheritedEnabled) {
    overrides.delete(node.key);
    return;
  }

  overrides.set(node.key, desiredEnabled ? "allow" : "deny");
}

function PermissionSection(props: {
  nodes: PermissionTreeStateNode[];
  disabled: boolean;
  onCheckedChange: (permissionKey: PermissionKey, checked: boolean) => void;
}) {
  return (
    <div className="office-user-permissions-column">
      {props.nodes.map((node, index) => (
        <article
          className={`office-user-permissions-section${index === 0 ? " is-first" : ""}`}
          key={node.key}
        >
          <PermissionRow
            disabled={props.disabled}
            level={0}
            node={node}
            onCheckedChange={props.onCheckedChange}
          />
        </article>
      ))}
    </div>
  );
}

function PermissionRow(props: {
  node: PermissionTreeStateNode;
  level: number;
  disabled: boolean;
  onCheckedChange: (permissionKey: PermissionKey, checked: boolean) => void;
}) {
  return (
    <div
      className={`office-user-permissions-node${props.level > 0 ? " is-nested" : ""}`}
    >
      <label className="office-user-permissions-row">
        <span className="office-permission-checkbox">
          <input
            checked={props.node.effectiveEnabled}
            disabled={props.disabled || !props.node.editable}
            onChange={(event) =>
              props.onCheckedChange(props.node.key, event.target.checked)
            }
            type="checkbox"
          />
          <span />
        </span>

        <span className="office-user-permissions-copy">
          <strong>{props.node.label}</strong>
        </span>

        <span className="office-user-permissions-meta">
          {props.node.overrideEffect ? (
            <StatusBadge
              tone={props.node.overrideEffect === "allow" ? "accent" : "danger"}
            >
              {getPermissionSourceLabel(props.node)}
            </StatusBadge>
          ) : null}
        </span>
      </label>

      {props.node.children.length > 0 ? (
        <div className="office-user-permissions-children">
          {props.node.children.map((child) => (
            <PermissionRow
              disabled={props.disabled}
              key={child.key}
              level={props.level + 1}
              node={child}
              onCheckedChange={props.onCheckedChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OfficeSettingsUserPermissionsClient({
  snapshot,
  canManagePermissions,
}: OfficeSettingsUserPermissionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissionScopes = useMemo<PermissionScopeOption[]>(
    () => [
      {
        key: "global",
        label: "Global role template",
        description: "Applies to every company this user can access.",
        scope: "global",
        officeId: null,
        permissions: snapshot.permissions,
      },
      ...snapshot.companyPermissions.map((entry) => ({
        key: `company:${entry.officeId}`,
        label: entry.officeName,
        description: `Overrides that only apply inside ${entry.officeName}.`,
        scope: "company" as const,
        officeId: entry.officeId,
        permissions: entry.permissions,
      })),
    ],
    [snapshot.companyPermissions, snapshot.permissions],
  );
  const requestedScopeKey = useMemo(() => {
    const scope = searchParams.get("scope");
    const officeId = searchParams.get("officeId");

    if (scope === "company" && officeId) {
      const companyScopeKey = `company:${officeId}`;

      if (
        permissionScopes.some(
          (permissionScope) => permissionScope.key === companyScopeKey,
        )
      ) {
        return companyScopeKey;
      }
    }

    return permissionScopes[0]?.key ?? "global";
  }, [permissionScopes, searchParams]);
  const [selectedScopeKey, setSelectedScopeKey] = useState(requestedScopeKey);
  const selectedScope =
    permissionScopes.find((scope) => scope.key === selectedScopeKey) ??
    permissionScopes[0];
  const [permissionOverrides, setPermissionOverrides] = useState(() =>
    buildPermissionOverrideMap(selectedScope?.permissions.overrides ?? []),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(
    null,
  );

  useEffect(() => {
    setSelectedScopeKey((current) =>
      current === requestedScopeKey &&
      permissionScopes.some((scope) => scope.key === current)
        ? current
        : requestedScopeKey,
    );
  }, [permissionScopes, requestedScopeKey]);

  useEffect(() => {
    if (!selectedScope) {
      return;
    }

    setPermissionOverrides(
      buildPermissionOverrideMap(selectedScope.permissions.overrides),
    );
    setSubmitError("");
    setActionNotice("");
  }, [selectedScope]);

  const previewTree = useMemo(
    () =>
      buildPreviewPermissionTree({
        nodes: selectedScope?.permissions.tree ?? snapshot.permissions.tree,
        overrides: permissionOverrides,
        role: selectedScope?.permissions.role ?? snapshot.permissions.role,
        inheritedPermissions:
          selectedScope?.permissions.inheritedPermissions ??
          snapshot.permissions.inheritedPermissions,
      }),
    [
      permissionOverrides,
      selectedScope,
      snapshot.permissions.inheritedPermissions,
      snapshot.permissions.role,
      snapshot.permissions.tree,
    ],
  );
  const previewMaps = useMemo(
    () => buildPermissionTreeMaps(previewTree),
    [previewTree],
  );
  const previewColumns = useMemo(
    () => splitPermissionColumns(previewTree),
    [previewTree],
  );
  const effectivePreviewCount = useMemo(() => {
    let count = 0;

    function visit(nodes: PermissionTreeStateNode[]) {
      for (const node of nodes) {
        if (node.effectiveEnabled) {
          count += 1;
        }

        visit(node.children);
      }
    }

    visit(previewTree);
    return count;
  }, [previewTree]);

  const serializedInitialOverrides = useMemo(
    () =>
      serializePermissionOverrideMap(
        buildPermissionOverrideMap(selectedScope?.permissions.overrides ?? []),
      ),
    [selectedScope],
  );
  const serializedDraftOverrides = useMemo(
    () => serializePermissionOverrideMap(permissionOverrides),
    [permissionOverrides],
  );
  const isDirty = serializedInitialOverrides !== serializedDraftOverrides;
  const detailHref = `/office/settings/users/${snapshot.profile.membershipId}`;

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  function togglePermission(permissionKey: PermissionKey, checked: boolean) {
    setPermissionOverrides((current) => {
      const next = new Map(current);
      const node = previewMaps.nodeByKey.get(permissionKey);

      if (!node) {
        return current;
      }

      if (checked) {
        for (const ancestorKey of previewMaps.ancestorKeysByKey.get(
          permissionKey,
        ) ?? []) {
          const ancestor = previewMaps.nodeByKey.get(ancestorKey);

          if (ancestor) {
            applyDesiredState(next, ancestor, true);
          }
        }

        applyDesiredState(next, node, true);
        return next;
      }

      for (const key of [
        permissionKey,
        ...(previewMaps.descendantKeysByKey.get(permissionKey) ?? []),
      ]) {
        const target = previewMaps.nodeByKey.get(key);

        if (target) {
          applyDesiredState(next, target, false);
        }
      }

      return next;
    });
  }

  async function handleSavePermissions() {
    setPendingAction("save");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(
        `/api/office/settings/users/${snapshot.profile.membershipId}/permissions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scope: selectedScope?.scope ?? "global",
            officeId: selectedScope?.officeId ?? undefined,
            overrides: [...permissionOverrides.entries()].map(
              ([permissionKey, effect]) => ({
                permissionKey,
                effect,
              }),
            ),
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Failed to update permission overrides.",
        );
      }

      setActionNotice(
        selectedScope?.scope === "company"
          ? `${selectedScope.label} permission overrides updated.`
          : "Global permission overrides updated.",
      );
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to update permission overrides.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPermissions() {
    setPendingAction("reset");
    setSubmitError("");
    setActionNotice("");

    try {
      const searchParams = new URLSearchParams();
      if (selectedScope?.scope === "company" && selectedScope.officeId) {
        searchParams.set("scope", "company");
        searchParams.set("officeId", selectedScope.officeId);
      }
      const suffix = searchParams.toString()
        ? `?${searchParams.toString()}`
        : "";
      const response = await fetch(
        `/api/office/settings/users/${snapshot.profile.membershipId}/permissions${suffix}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to reset permission overrides.");
      }

      setPermissionOverrides(new Map<PermissionKey, PermissionOverrideValue>());
      setActionNotice(
        selectedScope?.scope === "company"
          ? `${selectedScope.label} overrides reset to inherited defaults.`
          : "Global permission overrides reset to role defaults.",
      );
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to reset permission overrides.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="office-user-permissions-page">
      {submitError ? (
        <p className="office-inline-error">{submitError}</p>
      ) : null}
      {actionNotice ? (
        <p className="office-inline-success">{actionNotice}</p>
      ) : null}

      <SectionCard
        actions={
          <StatusBadge tone={isDirty ? "warning" : "success"}>
            {isDirty ? "Unsaved changes" : "Scope in sync"}
          </StatusBadge>
        }
        className="office-user-permissions-panel"
        subtitle={`For ${snapshot.profile.name}`}
        title="Permission overrides"
      >
        <ListPageStatsGrid className="office-user-permissions-stats">
          <StatCard
            className="office-user-permissions-stat"
            label="Scope"
            tone="accent"
            value={
              selectedScope?.scope === "company"
                ? selectedScope.label
                : "Global"
            }
          />
          <StatCard
            className="office-user-permissions-stat"
            label="Role template"
            tone="accent"
            value={
              selectedScope?.permissions.roleLabel ??
              snapshot.permissions.roleLabel
            }
          />
          <StatCard
            className="office-user-permissions-stat"
            label="Overrides"
            value={permissionOverrides.size}
          />
          <StatCard
            className="office-user-permissions-stat"
            label="Effective permissions"
            value={effectivePreviewCount}
          />
          <StatCard
            className="office-user-permissions-stat"
            label="Edit access"
            value={canManagePermissions ? "Writable" : "Read only"}
          />
        </ListPageStatsGrid>

        <div className="office-user-permissions-panel-head">
          <div className="office-user-permissions-panel-copy">
            <p>
              {canManagePermissions
                ? selectedScope?.scope === "company"
                  ? `Changes here only apply inside ${selectedScope.label}. Inherited permissions already include the global role template plus any global user overrides.`
                  : `Changes here override the ${selectedScope?.permissions.roleLabel ?? snapshot.permissions.roleLabel} template for this user across every company.`
                : selectedScope?.scope === "company"
                  ? `This page shows the effective permissions currently active for ${selectedScope.label}.`
                  : `This page shows the effective permissions currently active for this user under the ${selectedScope?.permissions.roleLabel ?? snapshot.permissions.roleLabel} template.`}
            </p>
            {permissionScopes.length > 1 ? (
              <div className="office-form-grid office-form-grid-2">
                <label className="office-detail-field">
                  <span>Permission scope</span>
                  <select
                    className="office-select"
                    onChange={(event) =>
                      setSelectedScopeKey(event.target.value)
                    }
                    value={selectedScope?.key ?? "global"}
                  >
                    {permissionScopes.map((scope) => (
                      <option key={scope.key} value={scope.key}>
                        {scope.scope === "company"
                          ? `Company · ${scope.label}`
                          : scope.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="office-detail-field">
                  <span>Scope detail</span>
                  <strong>
                    {selectedScope?.label ?? "Global role template"}
                  </strong>
                  <p>
                    {selectedScope?.description ??
                      "Applies to every company this user can access."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="office-user-permissions-columns">
          <PermissionSection
            disabled={!canManagePermissions}
            nodes={previewColumns[0]}
            onCheckedChange={togglePermission}
          />
          <PermissionSection
            disabled={!canManagePermissions}
            nodes={previewColumns[1]}
            onCheckedChange={togglePermission}
          />
        </div>

        <div className="office-user-permissions-footer">
          {canManagePermissions ? (
            <>
              <Button
                disabled={!isDirty || pendingAction === "save"}
                onClick={handleSavePermissions}
              >
                {pendingAction === "save" ? "Saving..." : "Save permissions"}
              </Button>
              <Link className="office-button-secondary" href={detailHref}>
                Cancel
              </Link>
              <Button
                disabled={
                  permissionOverrides.size === 0 || pendingAction === "reset"
                }
                onClick={() =>
                  setConfirmDialog({
                    title:
                      selectedScope?.scope === "company"
                        ? `Reset ${selectedScope.label} permission overrides?`
                        : "Reset all user permission overrides?",
                    description:
                      selectedScope?.scope === "company"
                        ? `This removes every company-specific override for ${selectedScope.label} and returns this scope to the inherited defaults.`
                        : "This removes every user-level override and returns this person to the current role-template defaults.",
                    confirmLabel: "Reset overrides",
                    onConfirm: () => {
                      void handleResetPermissions();
                    },
                  })
                }
                variant="secondary"
              >
                {pendingAction === "reset"
                  ? "Resetting..."
                  : "Reset to role defaults"}
              </Button>
            </>
          ) : (
            <Link className="office-button-secondary" href={detailHref}>
              Back to user
            </Link>
          )}
        </div>
      </SectionCard>

      <ConfirmActionDialog
        cancelLabel="Keep overrides"
        confirmLabel={confirmDialog?.confirmLabel}
        description={confirmDialog?.description ?? ""}
        isOpen={Boolean(confirmDialog)}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          const action = confirmDialog.onConfirm;
          setConfirmDialog(null);
          action();
        }}
        title={confirmDialog?.title ?? ""}
      />
    </div>
  );
}
