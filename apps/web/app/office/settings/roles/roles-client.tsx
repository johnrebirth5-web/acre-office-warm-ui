"use client";

import type { PermissionKey, UserRole } from "@acre/auth";
import type { OrganizationRoleTemplateSnapshot, OrganizationRoleTemplatesSnapshot, PermissionTreeStateNode } from "@acre/db";
import { Badge, Button, SectionCard } from "@acre/ui";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { buildPermissionTreeMaps, normalizePermissionKeys } from "../permissions-shared";

type OfficeSettingsRolesClientProps = {
  snapshot: OrganizationRoleTemplatesSnapshot;
  canManageSettings: boolean;
};

function serializePermissionKeys(keys: PermissionKey[]) {
  return normalizePermissionKeys(keys).join("|");
}

function RoleTemplateTree(props: {
  nodes: PermissionTreeStateNode[];
  selectedKeys: Set<PermissionKey>;
  disabled: boolean;
  onToggle: (permissionKey: PermissionKey, checked: boolean) => void;
}) {
  return (
    <div className="office-permission-tree">
      {props.nodes.map((node) => (
        <div className="office-permission-node" key={node.key}>
          <div className="office-permission-node-header">
            <label className="office-permission-checkbox">
              <input
                checked={props.selectedKeys.has(node.key)}
                disabled={props.disabled}
                onChange={(event) => props.onToggle(node.key, event.target.checked)}
                type="checkbox"
              />
              <span />
            </label>

            <div className="office-permission-node-copy">
              <div className="office-permission-node-heading">
                <strong>{node.label}</strong>
                <code>{node.key}</code>
              </div>
              <p>{node.description}</p>
              <div className="office-permission-node-badges">
                <Badge tone={props.selectedKeys.has(node.key) ? "success" : "neutral"}>
                  {props.selectedKeys.has(node.key) ? "Enabled" : "Disabled"}
                </Badge>
                <Badge tone="neutral">{node.group}</Badge>
              </div>
            </div>
          </div>

          {node.children.length > 0 ? (
            <div className="office-permission-tree office-permission-tree-nested">
              <RoleTemplateTree
                disabled={props.disabled}
                nodes={node.children}
                onToggle={props.onToggle}
                selectedKeys={props.selectedKeys}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OfficeSettingsRolesClient({ snapshot, canManageSettings }: OfficeSettingsRolesClientProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<UserRole, PermissionKey[]>>(
    () =>
      snapshot.roles.reduce(
        (accumulator, roleTemplate) => ({
          ...accumulator,
          [roleTemplate.role]: normalizePermissionKeys(roleTemplate.permissions)
        }),
        {} as Record<UserRole, PermissionKey[]>
      )
  );
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const treeMapsByRole = useMemo(
    () =>
      new Map<UserRole, ReturnType<typeof buildPermissionTreeMaps>>(
        snapshot.roles.map((roleTemplate) => [roleTemplate.role, buildPermissionTreeMaps(roleTemplate.tree)])
      ),
    [snapshot.roles]
  );

  function refreshCurrentPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  function resetDraft(roleTemplate: OrganizationRoleTemplateSnapshot) {
    setDrafts((current) => ({
      ...current,
      [roleTemplate.role]: normalizePermissionKeys(roleTemplate.permissions)
    }));
  }

  function updateRolePermissions(role: UserRole, nextPermissions: PermissionKey[]) {
    setDrafts((current) => ({
      ...current,
      [role]: normalizePermissionKeys(nextPermissions)
    }));
  }

  function togglePermission(roleTemplate: OrganizationRoleTemplateSnapshot, permissionKey: PermissionKey, checked: boolean) {
    const maps = treeMapsByRole.get(roleTemplate.role);

    if (!maps) {
      return;
    }

    const nextPermissions = new Set(drafts[roleTemplate.role] ?? roleTemplate.permissions);

    if (checked) {
      nextPermissions.add(permissionKey);

      for (const ancestorKey of maps.ancestorKeysByKey.get(permissionKey) ?? []) {
        nextPermissions.add(ancestorKey);
      }
    } else {
      nextPermissions.delete(permissionKey);

      for (const descendantKey of maps.descendantKeysByKey.get(permissionKey) ?? []) {
        nextPermissions.delete(descendantKey);
      }
    }

    updateRolePermissions(roleTemplate.role, [...nextPermissions]);
  }

  async function saveRoleTemplate(roleTemplate: OrganizationRoleTemplateSnapshot) {
    setPendingRole(roleTemplate.role);
    setSubmitError("");
    setActionNotice("");

    try {
      const response = await fetch(`/api/office/settings/roles/${roleTemplate.role}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          permissions: drafts[roleTemplate.role] ?? []
        })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update the role template.");
      }

      setActionNotice(`${roleTemplate.label} template updated.`);
      refreshCurrentPage();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update the role template.");
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <div className="office-settings-role-template-list">
      {submitError ? <p className="office-inline-error">{submitError}</p> : null}
      {actionNotice ? <p className="office-inline-success">{actionNotice}</p> : null}

      {snapshot.roles.map((roleTemplate) => {
        const draftPermissions = drafts[roleTemplate.role] ?? roleTemplate.permissions;
        const isDirty = serializePermissionKeys(draftPermissions) !== serializePermissionKeys(roleTemplate.permissions);
        const selectedKeys = new Set<PermissionKey>(draftPermissions);

        return (
          <SectionCard
            actions={
              <div className="office-settings-user-inline-badges">
                <Badge tone="accent">{roleTemplate.memberCount} members</Badge>
                <Badge tone="neutral">{draftPermissions.length} enabled</Badge>
              </div>
            }
            className="office-settings-role-template-card"
            key={roleTemplate.role}
            subtitle={roleTemplate.description}
            title={roleTemplate.label}
          >
            <div className="office-settings-user-detail-actions">
              {canManageSettings ? (
                <>
                  <Button disabled={!isDirty || pendingRole === roleTemplate.role} onClick={() => saveRoleTemplate(roleTemplate)}>
                    {pendingRole === roleTemplate.role ? "Saving..." : "Save template"}
                  </Button>
                  <Button disabled={!isDirty} onClick={() => resetDraft(roleTemplate)} variant="secondary">
                    Revert changes
                  </Button>
                </>
              ) : (
                <span className="office-table-action-muted">View only</span>
              )}
            </div>

            <RoleTemplateTree
              disabled={!canManageSettings || pendingRole === roleTemplate.role}
              nodes={roleTemplate.tree}
              onToggle={(permissionKey, checked) => togglePermission(roleTemplate, permissionKey, checked)}
              selectedKeys={selectedKeys}
            />
          </SectionCard>
        );
      })}
    </div>
  );
}
