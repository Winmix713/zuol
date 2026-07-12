import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Undo2,
  Redo2,
  Download,
  Upload,
  Layers as LayersIcon,
  Circle,
  Loader2,
  AlertTriangle,
  WifiOff,
  Pencil,
  Check,
  X,
  ClipboardPaste,
} from 'lucide-react';
import { LayersPanel } from './src/components/LayersPanel';
import { CardPreview } from './src/components/CardPreview';
import { PropertyInspector } from './src/components/PropertyInspector';
import { ConfirmModal } from './src/components/ConfirmModal';
import { ToastProvider, useToast } from './src/components/Toast';
import {
  useLayers,
  createSeedLayers,
  findNode,
  setOpacity,
  setBlendMode,
  setColor,
  setLabelColor,
  setTags,
  batchPatch,
  batchDelete,
} from './src/hooks/useLayers';
import { useHistory } from './src/hooks/useHistory';
import { usePersistence } from './src/hooks/usePersistence';
import { useProject } from './src/hooks/useProject';
import type { BlendMode, LabelColor, LayerNode, SaveStatus } from './src/types/layers';
import {
  buildExportPayload,
  downloadFile,
  importFromFile,
  importFromClipboard,
  prepareForMerge,
} from './src/lib/codegen';

/** Apply a per-id updater to a set of ids, folding into a single history entry. */
function applyToIds(
  nodes: LayerNode[],
  ids: string[],
  fn: (nodes: LayerNode[], id: string) => LayerNode[]
): LayerNode[] {
  return ids.reduce((acc, id) => fn(acc, id), nodes);
}

const SAVE_META: Record<SaveStatus, { label: string; className: string; icon: React.ReactNode }> = {
  idle: {
    label: 'All changes saved',
    className: 'text-text-muted',
    icon: <Circle size={8} className="fill-accent text-accent" />,
  },
  saved: {
    label: 'Saved',
    className: 'text-text-secondary',
    icon: <Circle size={8} className="fill-accent text-accent" />,
  },
  saving: {
    label: 'Saving…',
    className: 'text-text-secondary',
    icon: <Loader2 size={11} className="animate-spin text-accent-secondary" />,
  },
  error: {
    label: 'Save failed',
    className: 'text-danger',
    icon: <AlertTriangle size={11} className="text-danger" />,
  },
  offline: {
    label: 'Offline — changes queued',
    className: 'text-amber-400',
    icon: <WifiOff size={11} className="text-amber-400" />,
  },
};

function SaveStatusPill({
  status,
  pendingCount,
  lastError,
  onRetry,
}: {
  status: SaveStatus;
  pendingCount: number;
  lastError: string | null;
  onRetry: () => void;
}) {
  const meta = SAVE_META[status];
  const label =
    status === 'offline' && pendingCount > 0
      ? `Offline — ${pendingCount} queued`
      : meta.label;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-panel-elevated px-2.5 py-1 text-[11px] font-medium ${meta.className}`}
      title={status === 'error' && lastError ? lastError : undefined}
    >
      {meta.icon}
      {label}
      {status === 'error' && (
        <button
          onClick={onRetry}
          className="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold text-danger underline underline-offset-2 hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/50"
          aria-label="Retry save"
        >
          Retry
        </button>
      )}
    </span>
  );
}

// ─── Project name inline editor ───────────────────────────────────────────────

function ProjectNameEditor({
  name,
  onRename,
}: {
  name: string;
  onRename: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(name);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, name]);

  function commit() {
    const v = draft.trim() || name;
    onRename(v);
    setEditing(false);
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => { e.preventDefault(); commit(); }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
          }}
          className="w-36 rounded-md border border-accent/40 bg-black/40 px-2 py-0.5 text-[13px] font-semibold text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
          aria-label="Project name"
        />
        <button
          type="submit"
          aria-label="Save project name"
          className="grid h-6 w-6 place-items-center rounded text-accent hover:bg-white/[0.06]"
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel rename"
          className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-white/[0.06]"
        >
          <X size={13} />
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Rename project"
      className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-white/[0.06] transition-colors"
    >
      <span className="text-[13px] font-semibold text-text-primary leading-tight">
        {name}
      </span>
      <Pencil
        size={11}
        className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
}

// ─── Hidden file input helper ─────────────────────────────────────────────────

function useFileInput(onFile: (file: File) => void) {
  const ref = useRef<HTMLInputElement>(null);

  const open = useCallback(() => ref.current?.click(), []);

  const element = (
    <input
      ref={ref}
      type="file"
      accept=".json,application/json"
      className="sr-only"
      aria-hidden="true"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        // Reset so the same file can be re-imported
        e.target.value = '';
      }}
    />
  );

  return { open, element };
}

// ─── Main App (inner, needs toast) ───────────────────────────────────────────

function AppInner() {
  const { toast } = useToast();
  const { layers, setLayers: baseSetLayers } = useLayers();
  const {
    saveStatus,
    isConfigured,
    loadFromDb,
    save,
    pendingCount,
    lastError,
    retryLastSave,
  } = usePersistence();
  const { project, rename: renameProject } = useProject();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: Set<string>;
    label: string;
  } | null>(null);

  // Import mode: 'merge' | 'replace'
  const [pendingImport, setPendingImport] = useState<{
    layers: LayerNode[];
    warnings: { path: string; message: string }[];
  } | null>(null);

  const { setLayersWithHistory, undo, redo, canUndo, canRedo } = useHistory(
    layers,
    (action) => baseSetLayers(action)
  );

  const selectedNodes = useMemo(() => {
    const nodes: LayerNode[] = [];
    selectedIds.forEach((id) => {
      const found = findNode(layers, id);
      if (found) nodes.push(found);
    });
    return nodes;
  }, [selectedIds, layers]);

  /* ── Inspector handlers ── */
  const onColorChange = useCallback(
    (ids: string[], color: string) =>
      setLayersWithHistory(
        (prev) => applyToIds(prev, ids, (n, id) => setColor(n, id, color)),
        'Change fill'
      ),
    [setLayersWithHistory]
  );
  const onOpacityChange = useCallback(
    (ids: string[], opacity: number) =>
      setLayersWithHistory(
        (prev) => applyToIds(prev, ids, (n, id) => setOpacity(n, id, opacity)),
        'Change opacity'
      ),
    [setLayersWithHistory]
  );
  const onBlendModeChange = useCallback(
    (ids: string[], mode: BlendMode) =>
      setLayersWithHistory(
        (prev) => applyToIds(prev, ids, (n, id) => setBlendMode(n, id, mode)),
        'Change blend mode'
      ),
    [setLayersWithHistory]
  );
  const onSetVisible = useCallback(
    (ids: string[], visible: boolean) =>
      setLayersWithHistory(
        (prev) => batchPatch(prev, new Set(ids), { visible }),
        'Toggle visibility'
      ),
    [setLayersWithHistory]
  );
  const onSetLocked = useCallback(
    (ids: string[], locked: boolean) =>
      setLayersWithHistory(
        (prev) => batchPatch(prev, new Set(ids), { locked }),
        'Toggle lock'
      ),
    [setLayersWithHistory]
  );
  const onLabelColor = useCallback(
    (ids: string[], color: LabelColor | null) =>
      setLayersWithHistory(
        (prev) => applyToIds(prev, ids, (n, id) => setLabelColor(n, id, color)),
        'Mark color'
      ),
    [setLayersWithHistory]
  );
  const onAddTag = useCallback(
    (ids: string[], tag: string) =>
      setLayersWithHistory(
        (prev) =>
          applyToIds(prev, ids, (n, id) => {
            const node = findNode(n, id);
            const existing = node?.tags ?? [];
            if (existing.includes(tag)) return n;
            return setTags(n, id, [...existing, tag]);
          }),
        'Add tag'
      ),
    [setLayersWithHistory]
  );
  const onRemoveTag = useCallback(
    (ids: string[], tag: string) =>
      setLayersWithHistory(
        (prev) =>
          applyToIds(prev, ids, (n, id) => {
            const node = findNode(n, id);
            return setTags(n, id, (node?.tags ?? []).filter((t) => t !== tag));
          }),
        'Remove tag'
      ),
    [setLayersWithHistory]
  );

  // Tracks whether the initial load has completed. The debounced save must
  // NOT fire before this is true, to avoid persisting the intermediate empty
  // state that exists between mount and the first baseSetLayers() call.
  const hasLoadedOnce = useRef(false);

  /* ── Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Always try to load from DB/cache if configured, even when offline
      // (loadFromDb falls back to the cached snapshot in that case).
      const fromDb = isConfigured
        ? await loadFromDb(project.id)
        : null;

      if (cancelled) return;

      if (fromDb !== null) {
        // fromDb === [] means "user saved an empty tree" — respect it.
        // fromDb === [...] means normal content.
        baseSetLayers(fromDb);
      } else {
        // null → no DB / no cache → first-time user, load seed data.
        baseSetLayers(createSeedLayers());
      }

      hasLoadedOnce.current = true;
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Debounced save ── */
  // Intentionally only re-run when `layers` changes, not when project.name
  // changes — renaming a project must NOT trigger a layer save.
  // `project.id` is stable (set once from localStorage and never changed),
  // so it is safe to capture it via the ref below.
  const projectIdRef = useRef(project.id);
  useEffect(() => { projectIdRef.current = project.id; }, [project.id]);

  useEffect(() => {
    // Guard: do not save until the initial load has completed.
    // Using hasLoadedOnce (not layers.length) so that "user deleted all
    // layers" (empty tree) is still persisted as a valid state.
    if (!hasLoadedOnce.current) return;
    const t = setTimeout(() => save(layers, projectIdRef.current), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, save]);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '\\') {
        e.preventDefault();
        setLeftOpen((v) => !v);
      }
      if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setLeftOpen(false);
        setRightOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Export ── */
  const handleExport = useCallback(() => {
    const payload = buildExportPayload(layers, project.name);
    downloadFile(
      `${project.name.replace(/\s+/g, '-').toLowerCase()}-export.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    toast('Exported successfully', 'success');
  }, [layers, project, toast]);

  /* ── Import ── */
  const handleImportFile = useCallback(
    async (file: File) => {
      const result = await importFromFile(file);
      if (!result.ok) {
        toast(
          result.errors[0]?.message ?? 'Import failed — invalid file.',
          'error',
          5000
        );
        return;
      }
      if (result.warnings.length > 0) {
        toast(`Imported with ${result.warnings.length} warning(s).`, 'warning', 4000);
      }
      setPendingImport({ layers: result.layers, warnings: result.warnings });
    },
    [toast]
  );

  const handleImportClipboard = useCallback(async () => {
    const result = await importFromClipboard();
    if (!result.ok) {
      toast(result.errors[0]?.message ?? 'Clipboard import failed.', 'error', 5000);
      return;
    }
    if (result.warnings.length > 0) {
      toast(`Imported with ${result.warnings.length} warning(s).`, 'warning', 4000);
    }
    setPendingImport({ layers: result.layers, warnings: result.warnings });
  }, [toast]);

  const { open: openFileInput, element: fileInputEl } = useFileInput(handleImportFile);

  /* ── Confirm import ── */
  const confirmImportMerge = useCallback(() => {
    if (!pendingImport) return;
    // Deep-remap every node ID so imported subtrees never collide with
    // IDs already present in the editor tree.
    const remapped = prepareForMerge(pendingImport.layers);
    setLayersWithHistory(
      (prev) => [...prev, ...remapped],
      'Import (merge)'
    );
    toast(`Merged ${remapped.length} layer(s).`, 'success');
    setPendingImport(null);
  }, [pendingImport, setLayersWithHistory, toast]);

  const confirmImportReplace = useCallback(() => {
    if (!pendingImport) return;
    setLayersWithHistory(() => pendingImport.layers, 'Import (replace)');
    toast(`Replaced with ${pendingImport.layers.length} layer(s).`, 'success');
    setPendingImport(null);
    setSelectedIds(new Set());
  }, [pendingImport, setLayersWithHistory, toast]);

  /* ── Confirm delete (from LayersPanel) ── */
  const requestDelete = useCallback(
    (ids: Set<string>) => {
      const count = ids.size;
      setConfirmDelete({
        ids,
        label: count === 1 ? '1 layer' : `${count} layers`,
      });
    },
    []
  );

  const layout = [
    leftOpen ? 'minmax(240px, 300px)' : '0px',
    'minmax(360px, 1fr)',
    rightOpen ? 'minmax(280px, 320px)' : '0px',
  ].join(' ');

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas text-text-primary">
      {/* ── Topbar ── */}
      <header className="flex items-center gap-3 border-b border-white/[0.08] bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-[9px]"
            style={{
              background: 'linear-gradient(140deg, #4ADE8033, #4ADE8010)',
              boxShadow: 'inset 0 0 0 1px rgba(74,222,128,0.35)',
            }}
          >
            <LayersIcon size={15} className="text-accent" />
          </span>
          <div className="leading-tight">
            <ProjectNameEditor name={project.name} onRename={renameProject} />
            <p className="text-[10px] text-text-muted pl-1">Layers editor</p>
          </div>
        </div>

        <div className="mx-2 flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${canUndo ? 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${canRedo ? 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SaveStatusPill
            status={saveStatus}
            pendingCount={pendingCount}
            lastError={lastError}
            onRetry={retryLastSave}
          />

          {/* Import buttons */}
          <button
            onClick={openFileInput}
            title="Import JSON file"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-panel-elevated px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={handleImportClipboard}
            title="Import from clipboard"
            aria-label="Import from clipboard"
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-panel-elevated text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <ClipboardPaste size={13} />
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-panel-elevated px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Download size={13} /> Export
          </button>
        </div>

        {fileInputEl}
      </header>

      {/* ── Workspace ── */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: layout }}>
          {/* Left — Layers */}
          <aside
            className={`relative min-h-0 border-r border-white/[0.08] ${leftOpen ? '' : 'overflow-hidden'}`}
            aria-hidden={!leftOpen}
          >
            {leftOpen && (
              <LayersPanel
                layers={layers}
                setLayers={setLayersWithHistory}
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onRequestDelete={requestDelete}
              />
            )}
          </aside>

          {/* Center — Canvas */}
          <main className="relative min-h-0 overflow-hidden bg-canvas">
            <button
              onClick={() => setLeftOpen((v) => !v)}
              aria-label={leftOpen ? 'Collapse layers panel' : 'Expand layers panel'}
              title="Toggle layers (Ctrl+\)"
              className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-panel-elevated/80 text-text-secondary backdrop-blur transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
            <button
              onClick={() => setRightOpen((v) => !v)}
              aria-label={rightOpen ? 'Collapse inspector panel' : 'Expand inspector panel'}
              title="Toggle inspector"
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-panel-elevated/80 text-text-secondary backdrop-blur transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            </button>

            <div className="h-full w-full overflow-auto p-8">
              <CardPreview selectedIds={selectedIds} layers={layers} />
            </div>
          </main>

          {/* Right — Inspector */}
          <aside
            className={`relative min-h-0 border-l border-white/[0.08] ${rightOpen ? '' : 'overflow-hidden'}`}
            aria-hidden={!rightOpen}
          >
            {rightOpen && (
              <PropertyInspector
                selectedNodes={selectedNodes}
                onColorChange={onColorChange}
                onOpacityChange={onOpacityChange}
                onBlendModeChange={onBlendModeChange}
                onSetVisible={onSetVisible}
                onSetLocked={onSetLocked}
                onLabelColor={onLabelColor}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
              />
            )}
          </aside>
        </div>
      )}

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between border-t border-white/[0.08] bg-panel px-4 py-1.5 text-[10px] text-text-muted">
        <div className="flex items-center gap-3">
          <span>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'No selection'}
          </span>
          {!isConfigured && (
            <span className="text-amber-400/80">
              Supabase not configured — using local seed data
            </span>
          )}
          {pendingCount > 0 && (
            <span className="text-amber-400/80">
              {pendingCount} unsynchronised project(s)
            </span>
          )}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span>
            ⇧ range · ⌘ multi · ⌘G group · ⌘D duplicate · ⌘\ toggle panel
          </span>
        </div>
      </footer>

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete.label}?`}
          message="This action cannot be undone. The selected layers and all their children will be permanently removed."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            setLayersWithHistory(
              (prev) => batchDelete(prev, confirmDelete.ids),
              'Delete layers'
            );
            setSelectedIds((s) => {
              const n = new Set(s);
              confirmDelete.ids.forEach((id) => n.delete(id));
              return n;
            });
            toast(
              `Deleted ${confirmDelete.label}.`,
              'success'
            );
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Import mode picker modal ── */}
      {pendingImport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingImport(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-panel-elevated shadow-2xl shadow-black/50 p-6 mx-4">
            <h2
              id="import-title"
              className="text-[14px] font-semibold text-text-primary mb-1"
            >
              Import {pendingImport.layers.length} layer(s)
            </h2>
            <p className="text-[12px] text-text-secondary mb-4 leading-relaxed">
              How would you like to import these layers?
            </p>
            {pendingImport.warnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-400">
                {pendingImport.warnings.length} warning(s) — some values were corrected during import.
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmImportMerge}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-left text-[12px] font-medium text-text-primary hover:bg-white/[0.08] transition-colors"
              >
                Merge — add to existing layers
              </button>
              <button
                onClick={confirmImportReplace}
                className="w-full rounded-lg border border-danger/20 bg-danger/5 px-4 py-2.5 text-left text-[12px] font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                Replace — overwrite all current layers
              </button>
              <button
                onClick={() => setPendingImport(null)}
                className="w-full rounded-lg px-4 py-2 text-center text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root export with ToastProvider ──────────────────────────────────────────

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
