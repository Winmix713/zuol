import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayerNode, SaveStatus } from '../types/layers';
import { supabase } from '../lib/supabase';

// ─── LocalStorage key helpers ────────────────────────────────────────────────

/**
 * Three namespaced keys per project so we never mix up projects or clobber
 * old synced state.
 *
 *  project:{id}:current      – latest client-side snapshot
 *  project:{id}:last-synced  – last snapshot successfully written to Supabase
 *  project:{id}:pending      – truthy when there are unsynced changes
 */
function lsKey(projectId: string, slot: 'current' | 'last-synced' | 'pending') {
  return `project:${projectId}:${slot}`;
}

function lsWrite(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota/private */ }
}

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Tree <-> flat DB rows ────────────────────────────────────────────────────

function flattenTree(
  nodes: LayerNode[],
  projectId: string,
  parentId: string | null = null
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  nodes.forEach((node, index) => {
    result.push({
      id:             node.id,
      project_id:     projectId,
      name:           node.name,
      type:           node.type,
      color:          node.color,
      parent_id:      parentId,
      order:          index,
      visible:        node.visible  ?? true,
      locked:         node.locked   ?? false,
      opacity:        node.opacity  ?? 100,
      blend_mode:     node.blend_mode ?? 'normal',
      label_color:    node.label_color ?? null,
      tags:           node.tags       ?? [],
      preview_region: node.preview_region ?? null,
      updated_at:     new Date().toISOString(),
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, projectId, node.id));
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
      children:       [],
      visible:        node.visible        ?? true,
      locked:         node.locked         ?? false,
      opacity:        node.opacity        ?? 100,
      blend_mode:     node.blend_mode     ?? 'normal',
      label_color:    node.label_color    ?? null,
      tags:           node.tags           ?? [],
      preview_region: node.preview_region ?? null,
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

  function sortChildren(nodes: LayerNode[]) {
    nodes.sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
    nodes.forEach((n) => n.children && sortChildren(n.children));
  }
  sortChildren(roots);

  return roots;
}

// ─── Save queue ───────────────────────────────────────────────────────────────
//
// The queue model:
//   - `pendingRef.current`  – the snapshot waiting to be saved (or null)
//   - `savingRef.current`   – whether a Supabase write is in flight
//   - when a save finishes: if pendingRef has been updated in the meantime,
//     immediately start another write (read-your-writes semantics).
//
// This guarantees the server always ends up with the latest state, even when
// the user makes rapid changes, and prevents a slow in-flight request from
// clobbering a newer state.

interface SaveQueueEntry {
  nodes:     LayerNode[];
  projectId: string;
  gen:       number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePersistenceReturn {
  saveStatus:   SaveStatus;
  isConfigured: boolean;
  loadFromDb:   (projectId: string) => Promise<LayerNode[] | null>;
  /** Schedule a save. Debounced by the caller; queued if offline. */
  save:         (nodes: LayerNode[], projectId: string) => Promise<void>;
  pendingCount: number;
  lastSavedAt:  Date | null;
  lastError:    string | null;
  /** Manually retry the last failed save. */
  retryLastSave: () => void;
}

export function usePersistence(): UsePersistenceReturn {
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSavedAt,  setLastSavedAt]  = useState<Date | null>(null);
  const [lastError,    setLastError]    = useState<string | null>(null);

  const savedTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef   = useRef<SaveQueueEntry | null>(null);
  const savingRef    = useRef(false);
  const genRef       = useRef(0);
  // Holds the last entry attempted so retryLastSave can re-enqueue it.
  const lastAttemptRef = useRef<SaveQueueEntry | null>(null);

  const isConfigured = supabase !== null;

  // On mount: count pending-save projects from a previous session.
  useEffect(() => {
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.endsWith(':pending')) {
          const v = lsRead<boolean>(key);
          if (v) count++;
        }
      }
    } catch { /* ignore */ }
    setPendingCount(count);
  }, []);

  // ── Actual Supabase write (not exported — called by the queue runner) ───────
  const writeToSupabase = useCallback(
    async (nodes: LayerNode[], projectId: string, gen: number): Promise<void> => {
      if (!supabase) return;

      setSaveStatus('saving');
      setLastError(null);

      try {
        const flat       = flattenTree(nodes, projectId);
        const currentIds = flat.map((r) => r.id as string);

        // Step 1: delete rows for this project that are no longer in the tree.
        if (currentIds.length > 0) {
          const { error: delError } = await supabase
            .from('layers')
            .delete()
            .eq('project_id', projectId)
            .not('id', 'in', `(${currentIds.map((id) => `'${id}'`).join(',')})`);
          if (delError) throw delError;
        } else {
          // Tree is empty — this is a valid state: wipe all rows for the project.
          const { error: delAllError } = await supabase
            .from('layers')
            .delete()
            .eq('project_id', projectId);
          if (delAllError) throw delAllError;
        }

        // Step 2: upsert the current tree (skip if empty — nothing to insert).
        if (flat.length > 0) {
          const { error: upsertError } = await supabase
            .from('layers')
            .upsert(flat, { onConflict: 'id' });
          if (upsertError) throw upsertError;
        }

        // Only update UI if this gen is still current (no newer save queued).
        if (gen !== genRef.current) return;

        // Mark last-synced snapshot and clear pending flag.
        lsWrite(lsKey(projectId, 'last-synced'), nodes);
        lsRemove(lsKey(projectId, 'pending'));
        setPendingCount((c) => Math.max(0, c - 1));

        const savedAt = new Date();
        setLastSavedAt(savedAt);
        setSaveStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(
          () => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)),
          2000
        );
      } catch (err) {
        console.error('[persistence] Save failed:', err);
        if (gen === genRef.current) {
          setSaveStatus('error');
          setLastError(err instanceof Error ? err.message : String(err));
        }
        // Keep the pending snapshot so it can be retried on reconnect.
      }
    },
    []
  );

  // ── Queue runner ─────────────────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (savingRef.current) return; // already in flight
    const entry = pendingRef.current;
    if (!entry) return;

    savingRef.current = true;
    pendingRef.current = null;
    lastAttemptRef.current = entry;

    await writeToSupabase(entry.nodes, entry.projectId, entry.gen);

    savingRef.current = false;

    // If a newer snapshot arrived while we were writing, flush again.
    if (pendingRef.current) flushQueue();
  }, [writeToSupabase]);

  // ── Public save() ────────────────────────────────────────────────────────────
  const save = useCallback(
    async (nodes: LayerNode[], projectId: string): Promise<void> => {
      // Always persist the latest snapshot to localStorage.
      lsWrite(lsKey(projectId, 'current'), nodes);

      if (!supabase) {
        setSaveStatus('idle');
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Mark as pending in localStorage so we can retry after reload.
        const wasPending = !!lsRead(lsKey(projectId, 'pending'));
        lsWrite(lsKey(projectId, 'pending'), true);
        if (!wasPending) setPendingCount((c) => c + 1);
        setSaveStatus('offline');
        return;
      }

      const gen = ++genRef.current;
      pendingRef.current = { nodes, projectId, gen };
      flushQueue();
    },
    [flushQueue]
  );

  // ── retryLastSave ─────────────────────────────────────────────────────────────
  const retryLastSave = useCallback(() => {
    const last = lastAttemptRef.current;
    if (!last) return;
    // Re-enqueue with a new generation number so it's treated as current.
    const gen = ++genRef.current;
    pendingRef.current = { ...last, gen };
    flushQueue();
  }, [flushQueue]);

  // ── loadFromDb ────────────────────────────────────────────────────────────────
  //
  // Return semantics:
  //   null   → Supabase not configured / offline with no cached data
  //            → caller should fall back to seed data
  //   []     → project exists but has no layers (user deleted all)
  //            → caller should use empty tree, NOT seed data
  //   [...] → tree loaded from DB or cache
  //
  const loadFromDb = useCallback(
    async (projectId: string): Promise<LayerNode[] | null> => {
      // Offline or not configured: use cached snapshot.
      if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const cached = lsRead<LayerNode[]>(lsKey(projectId, 'current'));
        // Return cached (even if empty array) when we have a snapshot, so
        // "user deleted all layers" is preserved across offline reloads.
        // Return null only when there is no snapshot at all.
        return cached !== null ? cached : null;
      }

      const { data, error } = await supabase
        .from('layers')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });

      if (error) {
        console.error('[persistence] Load failed:', error);
        const cached = lsRead<LayerNode[]>(lsKey(projectId, 'current'));
        return cached !== null ? cached : null;
      }

      // data is null when the query returns nothing; treat as empty tree.
      const rows = (data as LayerNode[]) ?? [];
      const tree = buildTree(rows);

      // Check for an unsynced pending snapshot that is NEWER than the server
      // state, and apply it so an offline edit is not lost on reconnect.
      const isPending = lsRead<boolean>(lsKey(projectId, 'pending'));
      if (isPending) {
        const pending = lsRead<LayerNode[]>(lsKey(projectId, 'current'));
        if (pending !== null) {
          // We have an unsynced local snapshot — return it and let the
          // debounced save flush it to the server immediately.
          return pending;
        }
      }

      // Update the local snapshot to reflect what the server has.
      lsWrite(lsKey(projectId, 'current'), tree);
      return tree;
    },
    []
  );

  // ── Online reconnect: flush any pending projects ──────────────────────────────
  useEffect(() => {
    function handleOnline() {
      if (!supabase) return;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.endsWith(':pending')) continue;
          const isPending = lsRead<boolean>(key);
          if (!isPending) continue;

          // Extract projectId from "project:{id}:pending"
          const parts = key.split(':');
          if (parts.length < 3) continue;
          const projectId = parts.slice(1, -1).join(':');

          const snapshot = lsRead<LayerNode[]>(lsKey(projectId, 'current'));
          if (snapshot && snapshot.length > 0) {
            save(snapshot, projectId);
          }
        }
      } catch { /* ignore */ }
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [save]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  return {
    saveStatus,
    isConfigured,
    loadFromDb,
    save,
    pendingCount,
    lastSavedAt,
    lastError,
    retryLastSave,
  };
}
