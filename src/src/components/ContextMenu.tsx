import React, { useEffect, useState, useRef } from 'react';
import { PenLine, Copy, Trash2, Tag, X, Code, Braces } from 'lucide-react';
import type { LayerNode, LabelColor } from '../types/layers';
import { LABEL_COLORS } from '../types/layers';
import { generateCss, nodeToExportJson, copyToClipboard } from '../lib/codegen';
interface ContextMenuProps {
  x: number;
  y: number;
  node: LayerNode;
  onClose: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLabelColor: (id: string, color: LabelColor | null) => void;
  onTagsChange: (id: string, tags: string[]) => void;
}
export function ContextMenu({
  x,
  y,
  node,
  onClose,
  onRename,
  onDelete,
  onDuplicate,
  onLabelColor,
  onTagsChange
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [newTag, setNewTag] = useState('');
  const tags = node.tags ?? [];
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const items: Array<{
    label: string;
    icon: React.ReactNode;
    action: () => void;
    danger?: boolean;
  } | null> = [
  {
    label: 'Rename',
    icon: <PenLine size={13} />,
    action: () => {
      onRename(node.id);
      onClose();
    }
  },
  {
    label: 'Duplicate',
    icon: <Copy size={13} />,
    action: () => {
      onDuplicate(node.id);
      onClose();
    }
  },
  null,
  {
    label: 'Copy CSS',
    icon: <Code size={13} />,
    action: () => {
      copyToClipboard(generateCss(node));
      onClose();
    }
  },
  {
    label: 'Copy as JSON',
    icon: <Braces size={13} />,
    action: () => {
      copyToClipboard(JSON.stringify(nodeToExportJson(node), null, 2));
      onClose();
    }
  },
  null,
  {
    label: 'Delete',
    icon: <Trash2 size={13} />,
    action: () => {
      onDelete(node.id);
      onClose();
    },
    danger: true
  }];

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const updated = [...tags, newTag.trim()];
    onTagsChange(node.id, updated);
    setNewTag('');
  };
  const handleRemoveTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    onTagsChange(node.id, updated);
  };
  const labelColors: LabelColor[] = [
  'red',
  'amber',
  'green',
  'sky',
  'pink',
  'gray'];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Layer options"
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#17171A]/95 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      style={{
        left: x,
        top: y
      }}>
      
      {items.map((item, i) =>
      item === null ?
      <div key={i} className="my-1 h-px bg-white/[0.06]" /> :

      <button
        key={item.label}
        role="menuitem"
        onClick={item.action}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium transition-colors duration-100 ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100'}`}>
        
            {item.icon}
            {item.label}
          </button>

      )}

      <div className="my-1 h-px bg-white/[0.06]" />

      <div className="px-3 py-1.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          <Tag size={10} />
          Mark color
        </div>
        <div className="flex items-center gap-1.5">
          {labelColors.map((color) =>
          <button
            key={color}
            onClick={() => {
              onLabelColor(node.id, node.label_color === color ? null : color);
            }}
            className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${node.label_color === color ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-black/50' : ''}`}
            style={{
              background: LABEL_COLORS[color]
            }}
            aria-label={`Mark ${color}`} />

          )}
          {node.label_color &&
          <button
            onClick={() => onLabelColor(node.id, null)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300">
            
              Clear
            </button>
          }
        </div>
      </div>

      <div className="my-1 h-px bg-white/[0.06]" />

      <div className="px-3 py-1.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          <Tag size={10} />
          Tags
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) =>
          <span
            key={tag}
            className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300">
            
              {tag}
              <button
              onClick={() => handleRemoveTag(tag)}
              className="text-zinc-500 hover:text-zinc-100">
              
                <X size={10} />
              </button>
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTag();
            }}
            placeholder="Add tag..."
            className="w-full rounded bg-black/40 px-2 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400/50" />
          
          <button
            onClick={handleAddTag}
            className="rounded bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-200">
            
            Add
          </button>
        </div>
      </div>
    </div>);

}