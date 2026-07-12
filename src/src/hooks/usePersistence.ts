import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayerNode, SaveStatus } from '../types/layers';
import { supabase } from '../lib/supabase';
import { flattenNodes } from '../lib/tree-utils';

/**
 * Flatten the tree into DB rows (parent_id + order), the shape the `layers`
 * table expects.
 */
function flattenTree(
nodes: LayerNode[],
parentId: string | null = null)
: Partial<LayerNode>[] {
  const result: Partial<LayerNode>[] = [];
  nodes.forEach((node, index) => {
    result.push({
      id: node.id,
      name: node.name,
      type: node.type,
      color: node.color,
      parent_id: parentId,
      order: index,
      visible: node.visible ?? true,
      locked: node.locked ?? false,
      opacity: node.opacity ?? 100,
      blend_mode: node.blend_mode ?? 'normal',
      label_color: node.label_color ?? null,
      tags: node.tags ?? [],
      preview_region: node.preview_region ?? null
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, node.id));
    }
  });
  return result;
}

export function buildTree(flat: LayerNode[]): LayerNode[] {
  const map = new Map<string, LayerNode>();
  const roots: LayerNode[] = [];

  flat.forEach((node) => {
    map.set(node.id, {
      ...node,
      children: [],
      visible: node.visible ?? true,
      locked: node.locked ?? false,
      opacity: node.opacity ?? 100,
      blend_mode: node.blend_mode ?? 'normal',
      label_color: node.label_color ?? null,
      tags: node.tags ?? [],
      preview_region: node.preview_region ?? null
    });
  });

  flat.forEach((node) => {
    const current = map.get(node.id)!;
    if (!node.parent_id) {
      roots.push(current);
    } else {
      map.get(node.parent_id)?.children?.push(current);
    }
  });

  return roots;
}

interface UsePersistenceReturn {
  saveStatus: SaveStatus;
  isConfigured: boolean;
  loadFromDb: () => Promise<LayerNode[] | null>;
  save: (nodes: LayerNode[]) => Promise<void>;
}

/**
 * Persistence layer with an explicit, user-visible SaveStatus. On save it
 * first DELETES rows that no longer exist client-side, then upserts the
 * current tree — so deleted layers don't resurrect on reload.
 */
export function usePersistence(): UsePersistenceReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isConfigured = supabase !== null;

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const loadFromDb = useCallback(async (): Promise<LayerNode[] | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.
    from('layers').
    select('*').
    order('order', { ascending: true });
    if (error) {
      console.error('Failed to load layers:', error);
      return null;
    }
    const tree = buildTree(data as LayerNode[] || []);
    return tree;
  }, []);

  const save = useCallback(async (nodes: LayerNode[]) => {
    if (!supabase) {
      // No backend — nothing to persist, but keep the UI honest.
      setSaveStatus('idle');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSaveStatus('offline');
      return;
    }

    setSaveStatus('saving');
    try {
      const flat = flattenTree(nodes);
      const currentIds = flat.map((n) => n.id as string);

      // 1. Delete rows that no longer exist client-side.
      if (currentIds.length > 0) {
        const inList = `(${currentIds.map((id) => `"${id}"`).join(',')})`;
        const { error: delError } = await supabase.
        from('layers').
        delete().
        not('id', 'in', inList);
        if (delError) throw delError;
      } else {
        const { error: delAllError } = await supabase.
        from('layers').
        delete().
        neq('id', '00000000-0000-0000-0000-000000000000');
        if (delAllError) throw delAllError;
      }

      // 2. Upsert the current tree.
      const { error: upsertError } = await supabase.
      from('layers').
      upsert(flat, { onConflict: 'id' });
      if (upsertError) throw upsertError;

      setSaveStatus('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setSaveStatus((s) => s === 'saved' ? 'idle' : s);
      }, 2000);
    } catch (err) {
      console.error('Failed to save layers:', err);
      setSaveStatus('error');
    }
  }, []);

  return { saveStatus, isConfigured, loadFromDb, save };
}