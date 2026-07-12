import { useState } from 'react';
import type { LayerNode, BlendMode, LabelColor } from '../types/layers';
import { TYPE_COLORS } from '../types/layers';
import {
  uid,
  patchNode,
  patchNodes,
  removeNodes as tuRemoveNodes,
  groupNodesAtParent as _groupAtParent } from
'../lib/tree-utils';

/**
 * Build the seed tree. IDs are real UUIDs (compatible with the uuid PK), and
 * each region-bearing layer carries an explicit `preview_region` binding so
 * the card preview links by id/metadata rather than by name.
 */
export function createSeedLayers(): LayerNode[] {
  const mk = (
  name: string,
  type: LayerNode['type'],
  extra: Partial<LayerNode> = {})
  : LayerNode => ({
    id: uid(),
    name,
    type,
    color: TYPE_COLORS[type],
    visible: true,
    locked: false,
    opacity: 100,
    blend_mode: 'normal',
    label_color: null,
    tags: [],
    preview_region: null,
    ...extra
  });

  return [
  mk('Desktop Frame', 'FRAME', {
    preview_region: 'frame',
    children: [
    mk('Header Group', 'GROUP', {
      preview_region: 'header',
      tags: ['nav'],
      children: [
      mk('Logo', 'SHAPE', { preview_region: 'logo' }),
      mk('Navigation Menu', 'TEXT', { preview_region: 'nav' })]

    }),
    mk('Hero Section', 'GROUP', {
      preview_region: 'hero',
      children: [
      mk('Hero Title', 'TEXT', { preview_region: 'heroTitle' }),
      mk('Hero Background', 'SHAPE', {
        preview_region: 'heroBg',
        opacity: 60
      })]

    }),
    mk('Content Area', 'SHAPE', { preview_region: 'creatorCard' }),
    mk('Effects', 'GROUP', {
      preview_region: 'glow',
      children: [
      mk('Glow Effect', 'SHAPE', {
        preview_region: 'glow',
        blend_mode: 'screen',
        label_color: 'green'
      }),
      mk('Drop Shadow', 'SHAPE', {
        preview_region: 'shadow',
        opacity: 40,
        locked: true
      })]

    })]

  })];

}

export function useLayers() {
  const [layers, setLayers] = useState<LayerNode[]>([]);
  return { layers, setLayers };
}

/* ── Re-export the canonical tree operations so existing imports keep working ── */
export {
  findNode,
  removeNode,
  removeNodes,
  insertBefore,
  insertInto,
  insertAt,
  moveNodes,
  isDescendant,
  renameNode,
  toggleVisibility,
  toggleLock,
  duplicateNode,
  duplicateNodes,
  groupNodesAtParent,
  ungroupNode,
  countLayers,
  flattenVisible,
  flattenNodes,
  getCommonValue,
  MIXED } from
'../lib/tree-utils';

/* ── Single-node property setters ── */

export function setOpacity(nodes: LayerNode[], id: string, opacity: number) {
  return patchNode(nodes, id, { opacity });
}

export function setBlendMode(
nodes: LayerNode[],
id: string,
blend_mode: BlendMode)
{
  return patchNode(nodes, id, { blend_mode });
}

export function setColor(nodes: LayerNode[], id: string, color: string) {
  return patchNode(nodes, id, { color });
}

export function setLabelColor(
nodes: LayerNode[],
id: string,
label_color: LabelColor | null)
{
  return patchNode(nodes, id, { label_color });
}

export function setTags(nodes: LayerNode[], id: string, tags: string[]) {
  return patchNode(nodes, id, { tags });
}

/* ── Batch operations (multi-select) ── */

export function batchPatch(
nodes: LayerNode[],
ids: Set<string>,
patch: Partial<LayerNode>)
{
  return patchNodes(nodes, ids, patch);
}

export function batchToggleVisibility(
nodes: LayerNode[],
ids: Set<string>,
visible: boolean)
{
  return patchNodes(nodes, ids, { visible });
}

export function batchToggleLock(
nodes: LayerNode[],
ids: Set<string>,
locked: boolean)
{
  return patchNodes(nodes, ids, { locked });
}

export function batchDelete(nodes: LayerNode[], ids: Set<string>) {
  const [tree] = tuRemoveNodes(nodes, ids);
  return tree;
}

/** Compatibility wrapper: group by a caller-supplied groupId string. */
export function groupNodes(
nodes: LayerNode[],
ids: Set<string>,
groupId: string)
{
  const { tree } = _groupAtParent(nodes, ids, groupId);
  return tree;
}