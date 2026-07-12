import { useState, useCallback, useEffect } from 'react';
import { uid } from '../lib/tree-utils';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'layer-editor:project';

export interface Project {
  id: string;
  name: string;
}

function loadProjectFromStorage(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Project>;
      if (parsed.id && parsed.name) return parsed as Project;
    }
  } catch {
    // ignore
  }
  return { id: uid(), name: 'Untitled Project' };
}

function persistProjectToStorage(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // ignore
  }
}

/**
 * Ensure the project record exists in Supabase.
 *
 * Uses upsert with ignoreDuplicates so re-runs on every load are safe:
 *   - First time: inserts a new row with the given id and name.
 *   - Subsequent times: no-op (the row already exists).
 *
 * This guarantees that every localStorage project_id always has a
 * corresponding `projects` row before any `layers` rows reference it.
 */
async function ensureProjectInDb(project: Project): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('projects')
    .upsert(
      { id: project.id, name: project.name },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (error) {
    console.error('[useProject] Failed to ensure project record:', error);
  }
}

/**
 * Update the project name in Supabase.
 * Called only when the user explicitly renames the project.
 */
async function updateProjectNameInDb(id: string, name: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', id);
  if (error) {
    console.error('[useProject] Failed to update project name:', error);
  }
}

export function useProject() {
  const [project, setProject] = useState<Project>(() => loadProjectFromStorage());

  // On mount: ensure the project record exists in Supabase.
  // This is idempotent — safe to run on every page load.
  useEffect(() => {
    ensureProjectInDb(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount with the stable initial project

  const rename = useCallback((name: string) => {
    const trimmed = name.trim() || 'Untitled Project';
    setProject((prev) => {
      const next = { ...prev, name: trimmed };
      persistProjectToStorage(next);
      // Persist name change to Supabase independently of the layer save.
      updateProjectNameInDb(next.id, next.name);
      return next;
    });
  }, []);

  return { project, rename };
}
