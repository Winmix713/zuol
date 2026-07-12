import React from 'react';
import { GripVertical, Lock } from 'lucide-react';

interface DragHandleProps {
  onDragStart: (e: React.DragEvent, id: string) => void;
  nodeId: string;
  disabled?: boolean;
}

export function DragHandle({ onDragStart, nodeId, disabled }: DragHandleProps) {
  if (disabled) {
    return (
      <span className="flex shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-40">
        <Lock size={12} className="text-zinc-500" />
      </span>);

  }
  return (
    <span
      role="button"
      aria-label="Drag to reorder"
      draggable
      onDragStart={(e) => onDragStart(e, nodeId)}
      className="flex shrink-0 cursor-grab opacity-0 transition-opacity duration-150 group-hover:opacity-60 hover:!opacity-100 active:cursor-grabbing"
      tabIndex={-1}>
      
      <GripVertical size={14} className="text-zinc-400" />
    </span>);

}