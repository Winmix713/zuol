import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Undo2,
  Redo2,
  Download,
  Layers as LayersIcon,
  Circle,
  Loader2,
  AlertTriangle,
  WifiOff } from
'lucide-react';
import { LayersPanel } from './src/components/LayersPanel';
import { CardPreview } from './src/components/CardPreview';
import { PropertyInspector } from './src/components/PropertyInspector';
import {
  useLayers,
  createSeedLayers,
  findNode,
  flattenNodes,
  setOpacity,
  setBlendMode,
  setColor,
  setLabelColor,
  setTags,
  batchPatch } from
'./src/hooks/useLayers';
import { useHistory } from './src/hooks/useHistory';
import { usePersistence } from './src/hooks/usePersistence';
import type {
  BlendMode,
  LabelColor,
  LayerNode,
  SaveStatus } from
'./src/types/layers';
import { nodeToExportJson, downloadFile } from './src/lib/codegen';
/** Apply a per-id updater to a set of ids, folding into a single history entry. */
function applyToIds(
nodes: LayerNode[],
ids: string[],
fn: (nodes: LayerNode[], id: string) => LayerNode[])
: LayerNode[] {
  return ids.reduce((acc, id) => fn(acc, id), nodes);
}
const SAVE_META: Record<
  SaveStatus,
  {
    label: string;
    className: string;
    icon: React.ReactNode;
  }> =
{
  idle: {
    label: 'All changes saved',
    className: 'text-text-muted',
    icon: <Circle size={8} className="fill-accent text-accent" />
  },
  saved: {
    label: 'Saved',
    className: 'text-text-secondary',
    icon: <Circle size={8} className="fill-accent text-accent" />
  },
  saving: {
    label: 'Saving…',
    className: 'text-text-secondary',
    icon: <Loader2 size={11} className="animate-spin text-accent-secondary" />
  },
  error: {
    label: 'Save failed',
    className: 'text-danger',
    icon: <AlertTriangle size={11} className="text-danger" />
  },
  offline: {
    label: 'Offline — changes queued',
    className: 'text-amber-400',
    icon: <WifiOff size={11} className="text-amber-400" />
  }
};
function SaveStatusPill({ status }: {status: SaveStatus;}) {
  const meta = SAVE_META[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-panel-elevated px-2.5 py-1 text-[11px] font-medium ${meta.className}`}>
      
      {meta.icon}
      {meta.label}
    </span>);

}
export function App() {
  const { layers, setLayers: baseSetLayers } = useLayers();
  const { saveStatus, isConfigured, loadFromDb, save } = usePersistence();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
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
  /* ── Inspector handlers (array of ids → single history entry) ── */
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
      (prev) =>
      batchPatch(prev, new Set(ids), {
        visible
      }),
      'Toggle visibility'
    ),
    [setLayersWithHistory]
  );
  const onSetLocked = useCallback(
    (ids: string[], locked: boolean) =>
    setLayersWithHistory(
      (prev) =>
      batchPatch(prev, new Set(ids), {
        locked
      }),
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
        return setTags(
          n,
          id,
          (node?.tags ?? []).filter((t) => t !== tag)
        );
      }),
      'Remove tag'
    ),
    [setLayersWithHistory]
  );
  /* ── Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromDb = isConfigured ? await loadFromDb() : null;
      if (cancelled) return;
      const next = fromDb && fromDb.length > 0 ? fromDb : createSeedLayers();
      baseSetLayers(next);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* ── Debounced save with visible status ── */
  useEffect(() => {
    if (isLoading || layers.length === 0) return;
    const t = setTimeout(() => save(layers), 400);
    return () => clearTimeout(t);
  }, [layers, isLoading, save]);
  /* ── Global layout shortcuts ── */
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
  const handleExport = useCallback(() => {
    const json = JSON.stringify(
      flattenNodes(layers).length ? layers.map(nodeToExportJson) : [],
      null,
      2
    );
    downloadFile('layers-export.json', json, 'application/json');
  }, [layers]);
  const gridCols = [
  leftOpen ? 'minmax(240px, 300px)' : '0px',
  'minmax(360px, 1fr)',
  rightOpen ? 'minmax(280px, 320px)' : '0px'].
  join(' ');
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
              boxShadow: 'inset 0 0 0 1px rgba(74,222,128,0.35)'
            }}>
            
            <LayersIcon size={15} className="text-accent" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-text-primary">
              Untitled Project
            </p>
            <p className="text-[10px] text-text-muted">Layers editor</p>
          </div>
        </div>

        <div className="mx-2 flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${canUndo ? 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}>
            
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${canRedo ? 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}>
            
            <Redo2 size={14} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SaveStatusPill status={saveStatus} />
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-panel-elevated px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
            <Download size={13} /> Export
          </button>
        </div>
      </header>

      {/* ── Workspace ── */}
      {isLoading ?
      <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div> :

      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: gridCols
        }}>
        
          {/* Left — Layers */}
          <aside
          className={`relative min-h-0 border-r border-white/[0.08] ${leftOpen ? '' : 'overflow-hidden'}`}
          aria-hidden={!leftOpen}>
          
            {leftOpen &&
          <LayersPanel
            layers={layers}
            setLayers={setLayersWithHistory}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds} />

          }
          </aside>

          {/* Center — Canvas */}
          <main className="relative min-h-0 overflow-hidden bg-canvas">
            {/* Sidebar toggles float over the canvas */}
            <button
            onClick={() => setLeftOpen((v) => !v)}
            aria-label={
            leftOpen ? 'Collapse layers panel' : 'Expand layers panel'
            }
            title="Toggle layers (Ctrl+\)"
            className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-panel-elevated/80 text-text-secondary backdrop-blur transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
              {leftOpen ?
            <PanelLeftClose size={15} /> :

            <PanelLeftOpen size={15} />
            }
            </button>
            <button
            onClick={() => setRightOpen((v) => !v)}
            aria-label={
            rightOpen ?
            'Collapse inspector panel' :
            'Expand inspector panel'
            }
            title="Toggle inspector"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-panel-elevated/80 text-text-secondary backdrop-blur transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
              {rightOpen ?
            <PanelRightClose size={15} /> :

            <PanelRightOpen size={15} />
            }
            </button>

            <div className="h-full w-full overflow-auto p-8">
              <CardPreview selectedIds={selectedIds} layers={layers} />
            </div>
          </main>

          {/* Right — Inspector */}
          <aside
          className={`relative min-h-0 border-l border-white/[0.08] ${rightOpen ? '' : 'overflow-hidden'}`}
          aria-hidden={!rightOpen}>
          
            {rightOpen &&
          <PropertyInspector
            selectedNodes={selectedNodes}
            onColorChange={onColorChange}
            onOpacityChange={onOpacityChange}
            onBlendModeChange={onBlendModeChange}
            onSetVisible={onSetVisible}
            onSetLocked={onSetLocked}
            onLabelColor={onLabelColor}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag} />

          }
          </aside>
        </div>
      }

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between border-t border-white/[0.08] bg-panel px-4 py-1.5 text-[10px] text-text-muted">
        <div className="flex items-center gap-3">
          <span>
            {selectedIds.size > 0 ?
            `${selectedIds.size} selected` :
            'No selection'}
          </span>
          {!isConfigured &&
          <span className="text-amber-400/80">
              Supabase not configured — using local seed data
            </span>
          }
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span>
            ⇧ range · ⌘/Ctrl multi · ⌘/Ctrl+G group · ⌘/Ctrl+D duplicate ·
            ⌘/Ctrl+\ toggle panel
          </span>
        </div>
      </footer>
    </div>);

}