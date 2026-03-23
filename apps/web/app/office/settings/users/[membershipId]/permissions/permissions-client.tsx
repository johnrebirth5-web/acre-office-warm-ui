"use client";

import type { PermissionKey } from "@acre/auth";
import type { OfficeAdminUserDetailSnapshot, PermissionOverrideValue, PermissionTreeStateNode } from "@acre/db";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { Badge, Button, ConfirmActionDialog, StatusBadge } from "@acre/ui";
import {
  buildPermissionOverrideMap,
  buildPermissionTreeMaps,
  buildPreviewPermissionTree,
  serializePermissionOverrideMap,
  type PermissionOverrideMap
} from "../../../permissions-shared";

type OfficeSettingsUserPermissionsClientProps = {
  snapshot: OfficeAdminUserDetailSnapshot;
  canManagePermissions: boolean;
};

type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function countPermissionNodes(node: PermissionTreeStateNode): number {
  return 1 + node.children.reduce((total, child) => total + countPermissionNodes(child), 0);
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
  desiredEnabled: boolean
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
        <article className={`office-user-permissions-section${index === 0 ? " is-first" : ""}`} key={node.key}>
          <PermissionRow disabled={props.disabled} level={0} node={node} onCheckedChange={props.onCheckedChange} />
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
    <div className={`office-user-permissions-node${props.level > 0 ? " is-nested" : ""}`}>
      <label className="office-user-permissions-row">
        <span className="office-permission-checkbox">
          <input
            checked={props.node.effectiveEnabled}
            disabled={props.disabled || !props.node.editable}
            onChange={(event) => props.onCheckedChange(props.node.key, event.target.checked)}
            type="checkbox"
          />
          <span />
        </span>

        <span className="office-user-permissions-copy">
          <strong>{props.node.label}</strong>
        </span>

        <span className="office-user-permissions-meta">
          {props.node.overrideEffect ? (
            <StatusBadge tone={props.node.overrideEffect === "allow" ? "accent" : "danger"}>
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
  canManagePermissions
}: OfficeSettingsUserPermissionsClientProps) {
  const router = useRouter();
  const [permissionOverrides, setPermissionOverrides] = useState(() => buildPermissionOverrideMap(snapshot.permissions.overrides));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const previewTree = useMemo(
    () =>
      buildPreviewPermissionTree({
        nodes: snapshot.permissions.tree,
        overrides: permissionOverrides,
        role: snapshot.permissions.role,
        inheritedPermissions: snapshot.permissions.inheritedPermissions
      }),
    [permissionOverrides, snapshot.permissions.inheritedPermissions, snapshot.permissions.role, snapshot.permissions.tree]
  );
  const previewMaps = useMemo(() => buildPermissionTreeMaps(previewTree), [previewTree]);
  const previewColumns = useMemo(() => splitPermissionColumns(previewTree), [previewTree]);
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
    () => serializePermissionOverrideMap(buildPermissionOverrideMap(snapshot.permissions.overrides)),
    [snapshot.permissions.overrides]
  );
  const serializedDraftOverrides = useMemo(() => serializePermissionOverrideMap(permissionOverrides), [permissionOverrides]);
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
        for (const ancestorKey of previewMaps.ancestorKeysByKey.get(permissionKey) ?? []) {
          const ancestor = previewMaps.nodeByKey.get(ancestorKey);

          if (ancestor) {
            applyDesiredState(next, ancestor, true);
          }
        }

        applyDesiredState(next, node, true);
        return next;
      }

      for (const key of [permissionKey, ...(previewMaps.descendantKeysByKey.get(permissionKey) ?? [])]) {
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
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/permissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          overrides: [...permissionOverrides.entries()].map(([permissionKey, effect]) => ({
            permissionKey,
            effect
          }))
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update permission overrides.");
      }

      setActionNotice("User permission overrides updated.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update permission overrides.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResetPermissions() {
    setPendingAction("reset");
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/users/${snapshot.profile.membershipId}/permissions`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to reset permission overrides.");
      }

      setPermissionOverrides(new Map<PermissionKey, PermissionOverrideValue>());
      setActionNotice("Permission overrides reset to role defaults.");
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to reset permission overrides.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="office-user-permissions-page">
      {submitError ? <p className="office-inline-error">{submitError}</p> : null}
      {actionNotice ? <p className="office-inline-success">{actionNotice}</p> : null}

      <section className="office-user-permissions-panel">
        <div className="office-user-permissions-hero">
          <div className="office-user-permissions-heading">
            <h1>Permissions</h1>
            <p className="office-user-permissions-for">For {snapshot.profile.name}</p>
          </div>

          <Link className="office-button office-button-secondary office-button-sm" href={detailHref}>
            Close
          </Link>
        </div>

        <div className="office-user-permissions-panel-head">
          <div className="office-user-permissions-panel-copy">
            <div className="office-settings-user-inline-badges">
              <Badge tone="accent">{snapshot.permissions.roleLabel}</Badge>
              <Badge tone="neutral">{permissionOverrides.size} overrides</Badge>
              <Badge tone="success">{effectivePreviewCount} effective permissions</Badge>
              {isDirty ? <Badge tone="warning">Unsaved changes</Badge> : null}
            </div>
            <p>
              {canManagePermissions
                ? `Changes here override the ${snapshot.permissions.roleLabel} template for this user only. Checked items are the permissions this user can use right now.`
                : `This page shows the effective permissions currently active for this user under the ${snapshot.permissions.roleLabel} template.`}
            </p>
          </div>
        </div>

        <div className="office-user-permissions-columns">
          <PermissionSection disabled={!canManagePermissions} nodes={previewColumns[0]} onCheckedChange={togglePermission} />
          <PermissionSection disabled={!canManagePermissions} nodes={previewColumns[1]} onCheckedChange={togglePermission} />
        </div>

        <div className="office-user-permissions-footer">
          {canManagePermissions ? (
            <>
              <Button disabled={!isDirty || pendingAction === "save"} onClick={handleSavePermissions}>
                {pendingAction === "save" ? "Saving..." : "Save permissions"}
              </Button>
              <Link className="office-button office-button-secondary" href={detailHref}>
                Cancel
              </Link>
              <Button
                disabled={permissionOverrides.size === 0 || pendingAction === "reset"}
                onClick={() =>
                  setConfirmDialog({
                    title: "Reset all user permission overrides?",
                    description:
                      "This removes every user-level override and returns this person to the current role-template defaults.",
                    confirmLabel: "Reset overrides",
                    onConfirm: () => {
                      void handleResetPermissions();
                    }
                  })
                }
                variant="secondary"
              >
                {pendingAction === "reset" ? "Resetting..." : "Reset to role defaults"}
              </Button>
            </>
          ) : (
            <Link className="office-button office-button-secondary" href={detailHref}>
              Back to user
            </Link>
          )}
        </div>
      </section>

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
