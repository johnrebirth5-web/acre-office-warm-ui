import type { PermissionKey } from "@acre/auth";
import type { PermissionOverrideValue, PermissionTreeStateNode } from "@acre/db";

export type PermissionOverrideMap = Map<PermissionKey, PermissionOverrideValue>;

export type PermissionTreeMaps = {
  nodeByKey: Map<PermissionKey, PermissionTreeStateNode>;
  ancestorKeysByKey: Map<PermissionKey, PermissionKey[]>;
  descendantKeysByKey: Map<PermissionKey, PermissionKey[]>;
};

export function normalizePermissionKeys(keys: Iterable<PermissionKey>) {
  return [...new Set(keys)].sort((left, right) => left.localeCompare(right));
}

export function buildPermissionTreeMaps(nodes: PermissionTreeStateNode[]): PermissionTreeMaps {
  const nodeByKey = new Map<PermissionKey, PermissionTreeStateNode>();
  const ancestorKeysByKey = new Map<PermissionKey, PermissionKey[]>();
  const descendantKeysByKey = new Map<PermissionKey, PermissionKey[]>();

  function visit(node: PermissionTreeStateNode, ancestors: PermissionKey[]) {
    nodeByKey.set(node.key, node);
    ancestorKeysByKey.set(node.key, ancestors);

    for (const child of node.children) {
      visit(child, [...ancestors, node.key]);
    }
  }

  function collectDescendants(node: PermissionTreeStateNode): PermissionKey[] {
    const descendants = node.children.flatMap((child) => [child.key, ...collectDescendants(child)]);
    descendantKeysByKey.set(node.key, descendants);
    return descendants;
  }

  for (const node of nodes) {
    visit(node, []);
  }

  for (const node of nodes) {
    collectDescendants(node);
  }

  return {
    nodeByKey,
    ancestorKeysByKey,
    descendantKeysByKey
  };
}

export function buildPermissionOverrideMap(
  overrides: Array<{
    permissionKey: PermissionKey;
    effect: PermissionOverrideValue;
  }>
) {
  return new Map<PermissionKey, PermissionOverrideValue>(overrides.map((override) => [override.permissionKey, override.effect]));
}

export function serializePermissionOverrideMap(overrides: PermissionOverrideMap) {
  return [...overrides.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([permissionKey, effect]) => `${permissionKey}:${effect}`)
    .join("|");
}

export function applyOverridesToPermissionTree(
  nodes: PermissionTreeStateNode[],
  overrides: PermissionOverrideMap
): PermissionTreeStateNode[] {
  return nodes.map((node) => {
    const overrideEffect = overrides.get(node.key) ?? null;
    const effectiveEnabled =
      overrideEffect === "allow" ? true : overrideEffect === "deny" ? false : node.inheritedEnabled;

    return {
      ...node,
      children: applyOverridesToPermissionTree(node.children, overrides),
      overrideEffect,
      effectiveEnabled
    };
  });
}

export function collectEnabledPermissionKeys(nodes: PermissionTreeStateNode[]) {
  const keys: PermissionKey[] = [];

  function visit(node: PermissionTreeStateNode) {
    if (node.effectiveEnabled) {
      keys.push(node.key);
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return normalizePermissionKeys(keys);
}
