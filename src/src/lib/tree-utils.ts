import type { LayerNode } from '../types/layers';

/**
 * Canonical, pure tree operations for the layer model. Every component and
 * hook goes through these helpers so behaviour is consistent at any depth.
 * All functions are immutable: they return new arrays/nodes and never mutate
 * their inputs.
 */

/** Safe UUID generation with a fallback for environments without crypto. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function findNode(nodes: LayerNode[], id: string): LayerNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Returns the id of the direct parent of `id`, or null if it's a root. */
export function getParentId(nodes: LayerNode[], id: string): string | null {
  function walk(list: LayerNode[], parent: string | null): string | null {
    for (const n of list) {
      if (n.id === id) return parent;
      if (n.children) {
        const r = walk(n.children, n.id);
        if (r !== undefined && r !== null) return r;
        if (r === null && findNode(n.children, id)) return r;
      }
    }
    return undefined as unknown as string | null;
  }
  const res = walk(nodes, null);
  return res === undefined ? null : res;
}

/** Ordered list of ancestor ids from root down to (but excluding) `id`. */
export function getNodePath(nodes: LayerNode[], id: string): string[] {
  const path: string[] = [];
  function walk(list: LayerNode[], trail: string[]): boolean {
    for (const n of list) {
      if (n.id === id) {
        path.push(...trail);
        return true;
      }
      if (n.children && walk(n.children, [...trail, n.id])) return true;
    }
    return false;
  }
  walk(nodes, []);
  return path;
}

/** Index of `id` among its siblings, or -1 if not found. */
export function getSiblingIndex(nodes: LayerNode[], id: string): number {
  function walk(list: LayerNode[]): number {
    const idx = list.findIndex((n) => n.id === id);
    if (idx !== -1) return idx;
    for (const n of list) {
      if (n.children) {
        const r = walk(n.children);
        if (r !== -1) return r;
      }
    }
    return -1;
  }
  return walk(nodes);
}

export function isDescendant(
nodes: LayerNode[],
ancestorId: string,
targetId: string)
: boolean {
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor?.children) return false;
  for (const c of ancestor.children) {
    if (c.id === targetId) return true;
    if (isDescendant(nodes, c.id, targetId)) return true;
  }
  return false;
}

/** Remove a single node anywhere in the tree, returning [tree, removedNode]. */
export function removeNode(
nodes: LayerNode[],
id: string)
: [LayerNode[], LayerNode | null] {
  let removed: LayerNode | null = null;
  const result: LayerNode[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      removed = n;
      continue;
    }
    if (n.children) {
      const [newChildren, r] = removeNode(n.children, id);
      if (r) removed = r;
      result.push({ ...n, children: newChildren });
    } else {
      result.push(n);
    }
  }
  return [result, removed];
}

/** Remove a set of ids anywhere in the tree, returning [tree, removedNodes]. */
export function removeNodes(
nodes: LayerNode[],
ids: Set<string>)
: [LayerNode[], LayerNode[]] {
  const removed: LayerNode[] = [];
  function walk(list: LayerNode[]): LayerNode[] {
    const out: LayerNode[] = [];
    for (const n of list) {
      if (ids.has(n.id)) {
        removed.push(n);
        continue;
      }
      if (n.children) {
        out.push({ ...n, children: walk(n.children) });
      } else {
        out.push(n);
      }
    }
    return out;
  }
  const tree = walk(nodes);
  return [tree, removed];
}

export function insertBefore(
nodes: LayerNode[],
targetId: string,
toInsert: LayerNode)
: LayerNode[] {
  const result: LayerNode[] = [];
  for (const n of nodes) {
    if (n.id === targetId) result.push(toInsert);
    if (n.children) {
      result.push({
        ...n,
        children: insertBefore(n.children, targetId, toInsert)
      });
    } else {
      result.push(n);
    }
  }
  return result;
}

export function insertInto(
nodes: LayerNode[],
parentId: string,
toInsert: LayerNode)
: LayerNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, children: [...(n.children || []), toInsert] };
    }
    if (n.children) {
      return { ...n, children: insertInto(n.children, parentId, toInsert) };
    }
    return n;
  });
}

/**
 * Insert `toInsert` at a specific position. When `parentId` is null the node
 * is inserted at `index` among the roots; otherwise among that parent's
 * children.
 */
export function insertAt(
nodes: LayerNode[],
parentId: string | null,
index: number,
toInsert: LayerNode)
: LayerNode[] {
  if (parentId === null) {
    const copy = [...nodes];
    copy.splice(Math.max(0, Math.min(index, copy.length)), 0, toInsert);
    return copy;
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...(n.children || [])];
      children.splice(
        Math.max(0, Math.min(index, children.length)),
        0,
        toInsert
      );
      return { ...n, children };
    }
    if (n.children) {
      return { ...n, children: insertAt(n.children, parentId, index, toInsert) };
    }
    return n;
  });
}

/**
 * Move a set of nodes to a new parent at a given index, preserving their
 * relative selection order. Descendants of moved nodes are excluded to avoid
 * cycles.
 */
export function moveNodes(
nodes: LayerNode[],
ids: Set<string>,
targetParentId: string | null,
index: number)
: LayerNode[] {
  // Don't move a node into itself or its own descendant.
  const safeIds = new Set(
    [...ids].filter((id) => {
      if (targetParentId === null) return true;
      return id !== targetParentId && !isDescendant(nodes, id, targetParentId);
    })
  );
  if (safeIds.size === 0) return nodes;

  const orderedFlat = flattenNodes(nodes).
  filter((n) => safeIds.has(n.id)).
  map((n) => n.id);

  const [without, removed] = removeNodes(nodes, safeIds);
  const byId = new Map(removed.map((n) => [n.id, n]));
  const ordered = orderedFlat.
  map((id) => byId.get(id)).
  filter((n): n is LayerNode => Boolean(n));

  let result = without;
  ordered.forEach((node, i) => {
    result = insertAt(result, targetParentId, index + i, node);
  });
  return result;
}

export function renameNode(
nodes: LayerNode[],
id: string,
name: string)
: LayerNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name };
    if (n.children) return { ...n, children: renameNode(n.children, id, name) };
    return n;
  });
}

/** Generic per-node patch applied to one id anywhere in the tree. */
export function patchNode(
nodes: LayerNode[],
id: string,
patch: Partial<LayerNode>)
: LayerNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    if (n.children) return { ...n, children: patchNode(n.children, id, patch) };
    return n;
  });
}

/** Generic per-node patch applied to a set of ids anywhere in the tree. */
export function patchNodes(
nodes: LayerNode[],
ids: Set<string>,
patch: Partial<LayerNode>)
: LayerNode[] {
  return nodes.map((n) => {
    const updated = ids.has(n.id) ? { ...n, ...patch } : n;
    if (updated.children) {
      return { ...updated, children: patchNodes(updated.children, ids, patch) };
    }
    return updated;
  });
}

export function toggleVisibility(nodes: LayerNode[], id: string): LayerNode[] {
  const node = findNode(nodes, id);
  return patchNode(nodes, id, { visible: node?.visible === false });
}

export function toggleLock(nodes: LayerNode[], id: string): LayerNode[] {
  const node = findNode(nodes, id);
  return patchNode(nodes, id, { locked: !(node?.locked === true) });
}

/** Deep-clone a subtree assigning fresh ids to the node AND every descendant. */
export function cloneSubtreeWithNewIds(
node: LayerNode,
rename = false)
: LayerNode {
  return {
    ...node,
    id: uid(),
    name: rename ? `${node.name} Copy` : node.name,
    children: node.children?.map((c) => cloneSubtreeWithNewIds(c, false))
  };
}

/**
 * Duplicate a node in place — inserted directly after the original, at the
 * same depth. All descendant ids are regenerated to avoid collisions.
 */
export function duplicateNode(nodes: LayerNode[], id: string): LayerNode[] {
  const result: LayerNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      result.push({ ...n, children: duplicateNode(n.children, id) });
    } else {
      result.push(n);
    }
    if (n.id === id) {
      result.push(cloneSubtreeWithNewIds(n, true));
    }
  }
  return result;
}

/** Duplicate every id in the set, each after its original, at any depth. */
export function duplicateNodes(
nodes: LayerNode[],
ids: Set<string>)
: LayerNode[] {
  const result: LayerNode[] = [];
  for (const n of nodes) {
    const child = n.children ?
    { ...n, children: duplicateNodes(n.children, ids) } :
    n;
    result.push(child);
    if (ids.has(n.id)) {
      result.push(cloneSubtreeWithNewIds(n, true));
    }
  }
  return result;
}

/**
 * Group the selected nodes into a new GROUP. The group is created at the
 * common parent of the first selected node, inserted at the position of the
 * first selected sibling, and the moved nodes keep their document order.
 */
export function groupNodesAtParent(
nodes: LayerNode[],
ids: Set<string>,
groupId: string)
: {tree: LayerNode[];groupId: string;} {
  if (ids.size === 0) return { tree: nodes, groupId };

  const orderedIds = flattenNodes(nodes).
  filter((n) => ids.has(n.id)).
  map((n) => n.id);
  const firstId = orderedIds[0];

  const parentId = getParentId(nodes, firstId);
  const insertIndex = getSiblingIndex(nodes, firstId);

  const [without, removed] = removeNodes(nodes, ids);
  const byId = new Map(removed.map((n) => [n.id, n]));
  const groupChildren = orderedIds.
  map((id) => byId.get(id)).
  filter((n): n is LayerNode => Boolean(n));

  const group: LayerNode = {
    id: groupId,
    name: 'Group',
    type: 'GROUP',
    color: '#38BDF8',
    visible: true,
    locked: false,
    opacity: 100,
    blend_mode: 'normal',
    children: groupChildren
  };

  const tree = insertAt(without, parentId, insertIndex, group);
  return { tree, groupId };
}

/** Ungroup: replace a group with its children, spliced into its position. */
export function ungroupNode(nodes: LayerNode[], groupId: string): LayerNode[] {
  function walk(list: LayerNode[]): LayerNode[] {
    const out: LayerNode[] = [];
    for (const n of list) {
      if (n.id === groupId && n.children) {
        out.push(...n.children);
      } else if (n.children) {
        out.push({ ...n, children: walk(n.children) });
      } else {
        out.push(n);
      }
    }
    return out;
  }
  return walk(nodes);
}

export function countLayers(nodes: LayerNode[]): number {
  return nodes.reduce(
    (acc, n) => acc + 1 + (n.children ? countLayers(n.children) : 0),
    0
  );
}

export function flattenNodes(nodes: LayerNode[]): LayerNode[] {
  const result: LayerNode[] = [];
  function walk(list: LayerNode[]) {
    for (const n of list) {
      result.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

export function flattenVisible(
nodes: LayerNode[],
expanded: Set<string>)
: string[] {
  const result: string[] = [];
  function walk(list: LayerNode[]) {
    for (const n of list) {
      result.push(n.id);
      if (n.children && expanded.has(n.id)) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

/**
 * Compute a common value across nodes, or the 'mixed' sentinel when they
 * differ. Used by the inspector for multi-selection editing.
 */
export const MIXED = Symbol('mixed');
export function getCommonValue<T>(
nodes: LayerNode[],
getValue: (node: LayerNode) => T)
: T | typeof MIXED {
  if (nodes.length === 0) return MIXED;
  const first = getValue(nodes[0]);
  return nodes.every((n) => getValue(n) === first) ? first : MIXED;
}