import { useRef, useState, useCallback } from 'react';
import type { LayerNode } from '../types/layers';
import {
  findNode,
  removeNode,
  insertBefore,
  insertInto,
  isDescendant } from
'./useLayers';

interface UseDragDropReturn {
  dragId: string | null;
  overId: string | null;
  overMode: 'before' | 'into';
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string, canHaveChildren: boolean) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

export function useDragDrop(
layers: LayerNode[],
setLayers: React.Dispatch<React.SetStateAction<LayerNode[]>>)
: UseDragDropReturn {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overMode, setOverMode] = useState<'before' | 'into'>('before');
  const dragRef = useRef<string | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.stopPropagation();
    dragRef.current = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);

    // Transparent ghost
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px;opacity:0;pointer-events:none';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent, id: string, canHaveChildren: boolean) => {
      e.preventDefault();
      e.stopPropagation();

      if (!dragRef.current || id === dragRef.current) return;
      if (isDescendant(layers, dragRef.current, id)) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const mode = canHaveChildren && ratio > 0.35 && ratio < 0.65 ? 'into' : 'before';

      setOverId(id);
      setOverMode(mode);
      e.dataTransfer.dropEffect = 'move';
    },
    [layers]
  );

  const onDrop = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();

      const src = dragRef.current;
      if (!src || src === id) {
        reset();
        return;
      }
      if (isDescendant(layers, src, id)) {
        reset();
        return;
      }

      setLayers((prev) => {
        const [without, node] = removeNode(prev, src);
        if (!node) return prev;
        if (overMode === 'into') return insertInto(without, id, node);
        return insertBefore(without, id, node);
      });

      reset();
    },
    [layers, overMode, setLayers]
  );

  const onDragEnd = useCallback(() => reset(), []);

  function reset() {
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
    setOverMode('before');
  }

  return { dragId, overId, overMode, onDragStart, onDragOver, onDrop, onDragEnd };
}