import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  Children } from
'react';
import {
  ChevronRight,
  MoreHorizontal,
  Eye,
  EyeOff,
  Lock,
  Unlock } from
'lucide-react';
import type { LayerNode, BlendMode } from '../types/layers';
import { TypeIcon } from './TypeIcon';
import { DragHandle } from './DragHandle';
import { BLEND_MODES, BLEND_MODE_LABELS } from '../types/layers';
interface LayerRowProps {
  node: LayerNode;
  depth: number;
  index: number;
  siblingCount: number;
  selectedIds: Set<string>;
  onSelect: (id: string, evt?: React.MouseEvent) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  query: string;
  dragId: string | null;
  overId: string | null;
  overMode: 'before' | 'into';
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string, canHaveChildren: boolean) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onContextMenu: (
  e: React.MouseEvent | null,
  node: LayerNode,
  directAction?: 'rename')
  => void;
  renamingId: string | null;
  onRenameSubmit: (id: string, value: string | null) => void;
  focusedId: string | null;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onOpacityChange: (id: string, value: number) => void;
  onBlendModeChange: (id: string, value: BlendMode) => void;
  visibleIds: string[];
}
export function LayerRow({
  node,
  depth,
  index,
  siblingCount,
  selectedIds,
  onSelect,
  expanded,
  onToggle,
  query,
  dragId,
  overId,
  overMode,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onContextMenu,
  renamingId,
  onRenameSubmit,
  focusedId,
  onToggleVisible,
  onToggleLocked,
  onOpacityChange,
  onBlendModeChange,
  visibleIds
}: LayerRowProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isDragging = dragId === node.id;
  const isOver = overId === node.id;
  const isRenaming = renamingId === node.id;
  const isFocused = focusedId === node.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHover, setShowHover] = useState(false);
  const [editOpacity, setEditOpacity] = useState(false);
  const [editOpacityValue, setEditOpacityValue] = useState(
    String(node.opacity ?? 100)
  );
  const [showBlendMenu, setShowBlendMenu] = useState(false);
  const isVisible = node.visible !== false;
  const isLocked = node.locked === true;
  const opacity = node.opacity ?? 100;
  const blendMode = node.blend_mode ?? 'normal';
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);
  const matches = useCallback(
    (n: LayerNode): boolean =>
    n.name.toLowerCase().includes(query.toLowerCase()) || (
    n.children?.some(matches) ?? false),
    [query]
  );
  if (query && !matches(node)) return null;
  const canHaveChildren =
  hasChildren || node.type === 'FRAME' || node.type === 'GROUP';
  const highlightedName = query ?
  <span className="block truncate text-[13px] font-medium text-text-primary">
      {node.name.split(new RegExp(`(${query})`, 'gi')).map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ?
    <mark
      key={i}
      className="rounded bg-yellow-400/80 px-0.5 text-zinc-900">
      
            {part}
          </mark> :

    part

    )}
    </span> :

  <span className="block truncate text-[13px] font-medium text-text-primary">
      {node.name}
    </span>;

  const handleOpacityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(editOpacityValue, 10);
      if (!isNaN(val) && val >= 0 && val <= 100) onOpacityChange(node.id, val);
      setEditOpacity(false);
    }
    if (e.key === 'Escape') {
      setEditOpacityValue(String(opacity));
      setEditOpacity(false);
    }
  };
  return (
    <div
      style={{
        opacity: !isVisible ? 0.35 : isDragging ? 0.35 : 1
      }}
      className="select-none transition-opacity duration-150">
      
      {isOver && overMode === 'before' &&
      <div
        className="pointer-events-none mx-2 h-[2px] rounded-full bg-accent-secondary shadow-[0_0_8px_rgba(56,189,248,0.8)]"
        style={{
          marginLeft: `${10 + depth * 16}px`
        }} />

      }

      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-level={depth + 1}
        aria-setsize={siblingCount}
        aria-posinset={index + 1}
        aria-label={`${node.name}, ${node.type}`}
        id={`layer-${node.id}`}
        draggable={!isLocked}
        onDragStart={(e) => {
          if (isLocked) return;
          onDragStart(e, node.id);
        }}
        onDragOver={(e) => onDragOver(e, node.id, canHaveChildren)}
        onDrop={(e) => onDrop(e, node.id)}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node);
        }}
        onClick={(e) => onSelect(node.id, e)}
        onMouseEnter={() => setShowHover(true)}
        onMouseLeave={() => {
          setShowHover(false);
          setShowBlendMenu(false);
        }}
        className={`group relative flex w-full cursor-pointer items-center gap-2 rounded-[10px] py-[7px] pr-2 text-left transition-all duration-150 ${isSelected ? 'bg-accent/[0.08] shadow-[inset_0_0_0_1px_rgba(74,222,128,0.18)]' : 'hover:bg-white/[0.04]'} ${isOver && overMode === 'into' ? 'shadow-[inset_0_0_0_2px_rgba(56,189,248,0.55)]' : ''} ${isFocused && !isSelected ? 'ring-1 ring-inset ring-white/25' : ''}`}
        style={{
          paddingLeft: `${8 + depth * 16}px`
        }}>
        
        {isSelected &&
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_8px_rgba(74,222,128,0.7)]" />

        }

        <span
          role={hasChildren ? 'button' : undefined}
          aria-label={
          hasChildren ? isOpen ? 'Collapse' : 'Expand' : undefined
          }
          tabIndex={-1}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(node.id);
            }
          }}
          className="grid h-4 w-4 shrink-0 place-items-center">
          
          {hasChildren &&
          <ChevronRight
            size={13}
            className="text-text-muted transition-transform duration-200"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none'
            }} />

          }
        </span>

        <DragHandle
          onDragStart={onDragStart}
          nodeId={node.id}
          disabled={isLocked} />
        
        <TypeIcon
          type={node.type}
          color={node.color}
          labelColor={node.label_color} />
        

        <span className="min-w-0 flex-1 leading-tight">
          {isRenaming ?
          <input
            ref={inputRef}
            defaultValue={node.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => onRenameSubmit(node.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')
              onRenameSubmit(node.id, e.currentTarget.value);
              if (e.key === 'Escape') onRenameSubmit(node.id, null);
            }}
            className="w-full rounded bg-white/[0.06] px-1 text-[13px] font-medium text-text-primary outline-none ring-1 ring-accent/50 focus:ring-accent" /> :


          highlightedName
          }
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
              {node.type}
            </span>
            {node.tags && node.tags.length > 0 &&
            <div className="flex items-center gap-1 overflow-hidden">
                {node.tags.slice(0, 2).map((tag) =>
              <span
                key={tag}
                className="truncate rounded bg-white/[0.06] px-1 py-0.5 text-[8px] text-text-muted">
                
                    {tag}
                  </span>
              )}
                {node.tags.length > 2 &&
              <span className="text-[8px] text-text-muted">
                    +{node.tags.length - 2}
                  </span>
              }
              </div>
            }
          </div>
        </span>

        {/* opacity + blend appear only on hover / selection, per spec */}
        {(showHover || isSelected) &&
        <div className="flex items-center gap-1.5">
            {editOpacity ?
          <input
            type="text"
            value={editOpacityValue}
            onChange={(e) => setEditOpacityValue(e.target.value)}
            onKeyDown={handleOpacityKeyDown}
            onBlur={() => {
              const val = parseInt(editOpacityValue, 10);
              if (!isNaN(val) && val >= 0 && val <= 100)
              onOpacityChange(node.id, val);
              setEditOpacity(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-10 rounded bg-black/40 px-1 text-right text-[10px] text-text-secondary outline-none ring-1 ring-accent/50"
            aria-label="Opacity percent" /> :


          opacity !== 100 &&
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditOpacity(true);
            }}
            className="text-[10px] text-text-muted hover:text-text-secondary">
            
                  {opacity}%
                </button>

          }
            <div className="relative">
              <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBlendMenu((v) => !v);
              }}
              className="px-1 text-[9px] text-text-muted hover:text-text-secondary"
              aria-label="Blend mode">
              
                {BLEND_MODE_LABELS[blendMode as BlendMode] || 'Normal'}
              </button>
              {showBlendMenu &&
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-white/[0.08] bg-panel-elevated/95 py-1 shadow-xl backdrop-blur-sm">
              
                  {BLEND_MODES.map((mode) =>
              <button
                key={mode}
                onClick={(e) => {
                  e.stopPropagation();
                  onBlendModeChange(node.id, mode);
                  setShowBlendMenu(false);
                }}
                className={`block w-full px-3 py-1 text-left text-[11px] ${mode === blendMode ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/[0.06]'}`}>
                
                      {BLEND_MODE_LABELS[mode]}
                    </button>
              )}
                </div>
            }
            </div>
          </div>
        }

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(node.id);
            }}
            className={`grid h-5 w-5 place-items-center rounded-md hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${!isVisible ? 'text-danger opacity-100' : 'text-text-muted hover:text-text-secondary'}`}
            aria-label={isVisible ? `Hide ${node.name}` : `Show ${node.name}`}>
            
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked(node.id);
            }}
            className={`grid h-5 w-5 place-items-center rounded-md hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${isLocked ? 'text-amber-400 opacity-100' : 'text-text-muted hover:text-text-secondary'}`}
            aria-label={isLocked ? `Unlock ${node.name}` : `Lock ${node.name}`}>
            
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button
            className="grid h-5 w-5 place-items-center rounded-md hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label={`More options for ${node.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, node);
            }}>
            
            <MoreHorizontal size={12} className="text-text-muted" />
          </button>
        </div>
      </div>

      {hasChildren && (isOpen || query) &&
      <div role="group" aria-label={`Children of ${node.name}`}>
          {node.children!.map((child, i) =>
        <LayerRow
          key={child.id}
          node={child}
          depth={depth + 1}
          index={i}
          siblingCount={node.children!.length}
          selectedIds={selectedIds}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
          query={query}
          dragId={dragId}
          overId={overId}
          overMode={overMode}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          onContextMenu={onContextMenu}
          renamingId={renamingId}
          onRenameSubmit={onRenameSubmit}
          focusedId={focusedId}
          onToggleVisible={onToggleVisible}
          onToggleLocked={onToggleLocked}
          onOpacityChange={onOpacityChange}
          onBlendModeChange={onBlendModeChange}
          visibleIds={visibleIds} />

        )}
        </div>
      }
    </div>);

}