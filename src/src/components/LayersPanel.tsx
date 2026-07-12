import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Layers,
  PlusCircle,
  FolderPlus,
  Search,
  X,
  Ungroup,
  Group as GroupIcon,
  Eye,
  Unlock,
  Undo2,
  Redo2,
  SlidersHorizontal,
  Copy,
  ChevronsDownUp,
  ChevronsUpDown } from
'lucide-react';
import type {
  LayerNode,
  LayerType,
  BlendMode,
  LabelColor } from
'../types/layers';
import { TYPE_COLORS } from '../types/layers';
import { useDragDrop } from '../hooks/useDragDrop';
import {
  removeNode,
  renameNode,
  duplicateNode,
  duplicateNodes,
  countLayers,
  flattenVisible,
  flattenNodes,
  toggleVisibility,
  toggleLock,
  setOpacity,
  setBlendMode,
  setLabelColor,
  setTags,
  batchDelete,
  groupNodesAtParent,
  ungroupNode } from
'../hooks/useLayers';
import { uid, findNode as findNodeInTree } from '../lib/tree-utils';
import { LayerRow } from './LayerRow';
import { ContextMenu } from './ContextMenu';
interface LayersPanelProps {
  layers: LayerNode[];
  setLayers: (action: React.SetStateAction<LayerNode[]>, label?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** When provided, delete triggers the parent's confirmation modal. */
  onRequestDelete?: (ids: Set<string>) => void;
}
export function LayersPanel({
  layers,
  setLayers,
  undo,
  redo,
  canUndo,
  canRedo,
  selectedIds,
  onSelectionChange,
  onRequestDelete,
}: LayersPanelProps) {
  const setSelectedIds = (
  updater: ((prev: Set<string>) => Set<string>) | Set<string>) =>
  {
    const next = typeof updater === 'function' ? updater(selectedIds) : updater;
    onSelectionChange(next);
  };
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    node: LayerNode;
  } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilters, setTypeFilters] = useState<Set<LayerType>>(new Set());
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  const total = useMemo(() => countLayers(layers), [layers]);
  const visibleIds = useMemo(
    () => flattenVisible(layers, expanded),
    [layers, expanded]
  );
  const allExpandable = useMemo(
    () =>
    flattenNodes(layers).
    filter((n) => n.children && n.children.length > 0).
    map((n) => n.id),
    [layers]
  );
  useEffect(() => {
    if (layers.length === 0) return;
    setExpanded((prev) =>
    prev.size > 0 ? prev : new Set(layers.map((n) => n.id))
    );
  }, [layers.length]);
  const dnd = useDragDrop(layers, (action) => setLayers(action, 'Drag'));
  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const expandAll = useCallback(
    () => setExpanded(new Set(allExpandable)),
    [allExpandable]
  );
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  /* ── Range selection (Shift) over the flat visible list ── */
  const anchorRef = useRef<string | null>(null);
  const selectRange = useCallback(
    (toId: string) => {
      const from = anchorRef.current ?? focusedId ?? toId;
      const a = visibleIds.indexOf(from);
      const b = visibleIds.indexOf(toId);
      if (a === -1 || b === -1) {
        setSelectedIds(new Set([toId]));
        return;
      }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelectedIds(new Set(visibleIds.slice(lo, hi + 1)));
    },
    [visibleIds, focusedId]
  );
  const handleDelete = useCallback(
    (id: string) => {
      // Close any open context menu before proceeding.
      setCtxMenu(null);

      // Find the node — if it's locked, skip the delete silently.
      const node = findNodeInTree(layers, id);
      if (node?.locked) return;

      if (onRequestDelete) {
        onRequestDelete(new Set([id]));
        setFocusedId(null);
        return;
      }
      setLayers((prev) => {
        const [next] = removeNode(prev, id);
        return next;
      }, 'Delete');
      setSelectedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setFocusedId(null);
    },
    [layers, setLayers, onRequestDelete]
  );
  const handleBatchDelete = useCallback(
    (idSet: Set<string>) => {
      // Close any open context menu before proceeding.
      setCtxMenu(null);

      // Filter out locked nodes so they are never deleted.
      const unlocked = new Set<string>();
      idSet.forEach((id) => {
        const node = findNodeInTree(layers, id);
        if (node && !node.locked) unlocked.add(id);
      });
      if (unlocked.size === 0) return;

      if (onRequestDelete) {
        onRequestDelete(unlocked);
        setFocusedId(null);
        return;
      }
      setLayers((prev) => batchDelete(prev, unlocked), 'Delete layers');
      setSelectedIds(new Set());
      setFocusedId(null);
    },
    [layers, setLayers, onRequestDelete]
  );
  const handleDuplicate = useCallback(
    (id: string) => setLayers((prev) => duplicateNode(prev, id), 'Duplicate'),
    [setLayers]
  );
  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setLayers((prev) => duplicateNodes(prev, selectedIds), 'Duplicate');
  }, [selectedIds, setLayers]);
  const handleGroupSelected = useCallback(() => {
    if (selectedIds.size < 2) return;
    const groupId = uid();
    setLayers(
      (prev) => groupNodesAtParent(prev, selectedIds, groupId).tree,
      'Group'
    );
    setSelectedIds(new Set([groupId]));
    setExpanded((p) => new Set([...p, groupId]));
    setFocusedId(groupId);
  }, [selectedIds, setLayers]);
  const handleUngroupSelected = useCallback(() => {
    const groups = [...selectedIds].filter((id) => {
      const node = flattenNodes(layers).find((n) => n.id === id);
      return node?.type === 'GROUP';
    });
    if (groups.length === 0) return;
    setLayers((prev) => {
      let next = prev;
      groups.forEach((gid) => {
        next = ungroupNode(next, gid);
      });
      return next;
    }, 'Ungroup');
    setSelectedIds(new Set());
  }, [selectedIds, layers, setLayers]);
  const handleAdd = useCallback(() => {
    const newId = uid();
    const newNode: LayerNode = {
      id: newId,
      name: 'New Layer',
      type: 'SHAPE',
      color: TYPE_COLORS.SHAPE,
      visible: true,
      locked: false,
      opacity: 100,
      blend_mode: 'normal',
      tags: []
    };
    setLayers((prev) => [...prev, newNode], 'Add layer');
    setSelectedIds(new Set([newId]));
    setFocusedId(newId);
    setTimeout(() => setRenamingId(newId), 50);
  }, [setLayers]);
  const handleSelect = useCallback(
    (id: string, evt?: React.MouseEvent) => {
      if (evt?.shiftKey) {
        selectRange(id);
      } else if (evt?.metaKey || evt?.ctrlKey) {
        setSelectedIds((s) => {
          const n = new Set(s);
          n.has(id) ? n.delete(id) : n.add(id);
          return n;
        });
        anchorRef.current = id;
      } else {
        setSelectedIds(new Set([id]));
        anchorRef.current = id;
      }
      setFocusedId(id);
    },
    [selectRange]
  );
  /* ── Keyboard shortcuts scoped to the tree ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!treeRef.current?.contains(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;
      const idx = visibleIds.indexOf(focusedId ?? '');
      // Cmd/Ctrl + A — select the whole visible tree.
      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSelectedIds(new Set(visibleIds));
        return;
      }
      // Cmd/Ctrl + D — duplicate selection.
      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      // Cmd/Ctrl + G / Shift+Cmd/Ctrl + G — group / ungroup.
      if (mod && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (e.shiftKey) handleUngroupSelected();else
        handleGroupSelected();
        return;
      }
      switch (e.key) {
        case 'ArrowDown':{
            e.preventDefault();
            const next = visibleIds[Math.min(idx + 1, visibleIds.length - 1)];
            if (next) {
              if (e.shiftKey) selectRange(next);else
              {
                setSelectedIds(new Set([next]));
                anchorRef.current = next;
              }
              setFocusedId(next);
              document.getElementById(`layer-${next}`)?.scrollIntoView({
                block: 'nearest'
              });
            }
            break;
          }
        case 'ArrowUp':{
            e.preventDefault();
            const prev = visibleIds[Math.max(idx - 1, 0)];
            if (prev) {
              if (e.shiftKey) selectRange(prev);else
              {
                setSelectedIds(new Set([prev]));
                anchorRef.current = prev;
              }
              setFocusedId(prev);
              document.getElementById(`layer-${prev}`)?.scrollIntoView({
                block: 'nearest'
              });
            }
            break;
          }
        case 'ArrowRight':
          e.preventDefault();
          if (focusedId) setExpanded((p) => new Set([...p, focusedId]));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedId)
          setExpanded((p) => {
            const n = new Set(p);
            n.delete(focusedId);
            return n;
          });
          break;
        case 'F2':
          e.preventDefault();
          if (focusedId) setRenamingId(focusedId);
          break;
        case 'Escape':
          if (renamingId) break;
          setSelectedIds(new Set());
          break;
        case 'Delete':
        case 'Backspace':
          if (renamingId) break;
          e.preventDefault();
          if (selectedIds.size > 0) handleBatchDelete(selectedIds);else
          if (focusedId) handleDelete(focusedId);
          break;
        default:
          break;
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [
  visibleIds,
  focusedId,
  selectedIds,
  renamingId,
  selectRange,
  handleDuplicateSelected,
  handleGroupSelected,
  handleUngroupSelected,
  handleBatchDelete,
  handleDelete]
  );
  const handleContextMenu = useCallback(
    (e: React.MouseEvent | null, node: LayerNode, directAction?: 'rename') => {
      if (directAction === 'rename') {
        setRenamingId(node.id);
        return;
      }
      if (!e) return;
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        node
      });
      if (!selectedIds.has(node.id)) onSelectionChange(new Set([node.id]));
    },
    [selectedIds, onSelectionChange]
  );
  const handleRenameSubmit = useCallback(
    (id: string, value: string | null) => {
      if (value && value.trim())
      setLayers((prev) => renameNode(prev, id, value.trim()), 'Rename');
      setRenamingId(null);
    },
    [setLayers]
  );
  const handleToggleVisible = useCallback(
    (id: string) =>
    setLayers((prev) => toggleVisibility(prev, id), 'Toggle visible'),
    [setLayers]
  );
  const handleToggleLocked = useCallback(
    (id: string) => setLayers((prev) => toggleLock(prev, id), 'Toggle lock'),
    [setLayers]
  );
  const handleOpacityChange = useCallback(
    (id: string, opacity: number) =>
    setLayers((prev) => setOpacity(prev, id, opacity), 'Change opacity'),
    [setLayers]
  );
  const handleBlendModeChange = useCallback(
    (id: string, blend_mode: BlendMode) =>
    setLayers(
      (prev) => setBlendMode(prev, id, blend_mode),
      'Change blend mode'
    ),
    [setLayers]
  );
  const handleLabelColor = useCallback(
    (id: string, color: LabelColor | null) =>
    setLayers((prev) => setLabelColor(prev, id, color), 'Mark color'),
    [setLayers]
  );
  const handleTagsChange = useCallback(
    (id: string, tags: string[]) =>
    setLayers((prev) => setTags(prev, id, tags), 'Edit tags'),
    [setLayers]
  );
  const filteredLayers = useMemo(() => {
    let result = layers;
    if (typeFilters.size > 0) {
      const f = (nodes: LayerNode[]): LayerNode[] =>
      nodes.
      filter(
        (n) =>
        typeFilters.has(n.type) ||
        n.children && f(n.children).length > 0
      ).
      map((n) => ({
        ...n,
        children: n.children ? f(n.children) : n.children
      }));
      result = f(result);
    }
    if (visibleOnly) {
      const f = (nodes: LayerNode[]): LayerNode[] =>
      nodes.
      filter(
        (n) =>
        n.visible !== false || n.children && f(n.children).length > 0
      ).
      map((n) => ({
        ...n,
        children: n.children ? f(n.children) : n.children
      }));
      result = f(result);
    }
    if (unlockedOnly) {
      const f = (nodes: LayerNode[]): LayerNode[] =>
      nodes.
      filter(
        (n) =>
        n.locked !== true || n.children && f(n.children).length > 0
      ).
      map((n) => ({
        ...n,
        children: n.children ? f(n.children) : n.children
      }));
      result = f(result);
    }
    return result;
  }, [layers, typeFilters, visibleOnly, unlockedOnly]);
  const commonProps = {
    selectedIds,
    onSelect: handleSelect,
    expanded,
    onToggle: toggle,
    query,
    ...dnd,
    onContextMenu: handleContextMenu,
    renamingId,
    onRenameSubmit: handleRenameSubmit,
    focusedId,
    onToggleVisible: handleToggleVisible,
    onToggleLocked: handleToggleLocked,
    onOpacityChange: handleOpacityChange,
    onBlendModeChange: handleBlendModeChange,
    visibleIds
  };
  const hasGroupInSelection = useMemo(
    () =>
    flattenNodes(layers).some(
      (n) => selectedIds.has(n.id) && n.type === 'GROUP'
    ),
    [layers, selectedIds]
  );
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-panel">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-[9px]"
          style={{
            background: 'linear-gradient(140deg, #4ADE8033, #4ADE8010)',
            boxShadow: 'inset 0 0 0 1px rgba(74,222,128,0.35)'
          }}>
          
          <Layers size={16} className="text-accent" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          Layers
        </span>
        <span
          aria-label={`${total} layers total`}
          className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
          
          {total}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={expandAll}
            aria-label="Expand all"
            title="Expand all"
            className="grid h-6 w-6 place-items-center rounded-lg text-text-muted transition-all hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
            <ChevronsUpDown size={13} />
          </button>
          <button
            onClick={collapseAll}
            aria-label="Collapse all"
            title="Collapse all"
            className="grid h-6 w-6 place-items-center rounded-lg text-text-muted transition-all hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
            <ChevronsDownUp size={13} />
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={`grid h-6 w-6 place-items-center rounded-lg transition-all ${canUndo ? 'text-text-muted hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}>
            
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className={`grid h-6 w-6 place-items-center rounded-lg transition-all ${canRedo ? 'text-text-muted hover:bg-white/[0.06] hover:text-text-primary' : 'cursor-not-allowed text-zinc-700'}`}>
            
            <Redo2 size={13} />
          </button>
          <button
            onClick={handleAdd}
            aria-label="Add layer"
            title="Add layer"
            className="grid h-7 w-7 place-items-center rounded-lg text-text-muted transition-all hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
            
            <PlusCircle size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="group flex items-center gap-2 rounded-[11px] border border-white/[0.06] bg-black/40 px-3 py-2 transition-all focus-within:border-accent/40 focus-within:shadow-[0_0_0_3px_rgba(74,222,128,0.12)]">
          <Search
            size={14}
            className="text-text-muted transition-colors group-focus-within:text-accent" />
          
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search layers…"
            aria-label="Search layers"
            className="w-full bg-transparent text-[12px] text-text-secondary placeholder:text-text-muted focus:outline-none" />
          
          {query &&
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="text-text-muted hover:text-text-secondary">
            
              <X size={14} />
            </button>
          }
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
            aria-pressed={showFilters}
            className={`transition-colors hover:text-text-secondary ${showFilters ? 'text-accent' : 'text-text-muted'}`}>
            
            <SlidersHorizontal size={14} />
          </button>
        </div>
      </div>

      {showFilters &&
      <div className="space-y-2 px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {(['FRAME', 'GROUP', 'SHAPE', 'TEXT'] as LayerType[]).map(
            (type) =>
            <button
              key={type}
              onClick={() =>
              setTypeFilters((s) => {
                const n = new Set(s);
                n.has(type) ? n.delete(type) : n.add(type);
                return n;
              })
              }
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${typeFilters.has(type) ? 'bg-accent/20 text-accent ring-1 ring-accent/30' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'}`}>
              
                  {type}
                </button>

          )}
          </div>
          <div className="flex items-center gap-2">
            <button
            onClick={() => setVisibleOnly(!visibleOnly)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${visibleOnly ? 'bg-accent/20 text-accent ring-1 ring-accent/30' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'}`}>
            
              <Eye size={11} /> Visible only
            </button>
            <button
            onClick={() => setUnlockedOnly(!unlockedOnly)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${unlockedOnly ? 'bg-accent/20 text-accent ring-1 ring-accent/30' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'}`}>
            
              <Unlock size={11} /> Unlocked only
            </button>
          </div>
        </div>
      }

      <div aria-hidden="true" className="mx-4 h-px bg-white/[0.06]" />

      {/* Tree */}
      <div
        ref={treeRef}
        role="tree"
        aria-label="Layer tree"
        aria-multiselectable="true"
        tabIndex={0}
        onFocus={() => {
          if (!focusedId)
          setFocusedId(Array.from(selectedIds)[0] ?? visibleIds[0] ?? null);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-2 py-2 focus:outline-none [scrollbar-width:thin]">
        
        {layers.length === 0 ?
        <p className="py-8 text-center text-[12px] text-text-muted">
            No layers yet — press{' '}
            <kbd className="rounded bg-white/[0.06] px-1 text-text-secondary">
              +
            </kbd>{' '}
            to add one
          </p> :

        filteredLayers.map((node, i) =>
        <LayerRow
          key={node.id}
          node={node}
          depth={0}
          index={i}
          siblingCount={filteredLayers.length}
          {...commonProps} />

        )
        }
      </div>

      {/* Footer / actions */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
        <span className="text-[10px] text-text-muted">
          {selectedIds.size > 0 ?
          `${selectedIds.size} selected` :
          'Nothing selected'}
        </span>
        <div className="flex items-center gap-1">
          {selectedIds.size >= 1 &&
          <button
            onClick={handleDuplicateSelected}
            title="Duplicate (Ctrl+D)"
            className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1 text-[10px] text-text-muted hover:bg-white/[0.08] hover:text-text-secondary">
            
              <Copy size={11} /> Dup
            </button>
          }
          {selectedIds.size > 1 &&
          <button
            onClick={handleGroupSelected}
            title="Group (Ctrl+G)"
            className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1 text-[10px] text-text-muted hover:bg-white/[0.08] hover:text-text-secondary">
            
              <GroupIcon size={11} /> Group
            </button>
          }
          {hasGroupInSelection &&
          <button
            onClick={handleUngroupSelected}
            title="Ungroup (Shift+Ctrl+G)"
            className="flex items-center gap-1 rounded bg-white/[0.04] px-2 py-1 text-[10px] text-text-muted hover:bg-white/[0.08] hover:text-text-secondary">
            
              <Ungroup size={11} /> Ungroup
            </button>
          }
        </div>
      </div>

      {ctxMenu &&
      <ContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        node={ctxMenu.node}
        onClose={() => setCtxMenu(null)}
        onRename={(id) => setRenamingId(id)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onLabelColor={handleLabelColor}
        onTagsChange={handleTagsChange} />

      }
    </div>);

}
