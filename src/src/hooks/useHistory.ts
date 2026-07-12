import { useState, useCallback, useEffect } from 'react';
import type { LayerNode } from '../types/layers';

interface HistoryState {
  past: LayerNode[][];
  future: LayerNode[][];
}

const MAX_HISTORY = 50;

export function useHistory(
layers: LayerNode[],
setLayers: React.Dispatch<React.SetStateAction<LayerNode[]>>)
{
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [historyList, setHistoryList] = useState<{label: string;layers: LayerNode[];}[]>([]);

  const setLayersWithHistory = useCallback(
    (action: React.SetStateAction<LayerNode[]>, label = 'Change') => {
      setLayers((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;

        if (JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }

        setHistory((h) => {
          const newPast = [...h.past, prev].slice(-MAX_HISTORY);
          return { past: newPast, future: [] };
        });

        setHistoryList((list) => {
          const newList = [...list, { label, layers: next }].slice(-MAX_HISTORY);
          return newList;
        });

        return next;
      });
    },
    [setLayers]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;

      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, -1);
      const newFuture = [layers, ...h.future].slice(0, MAX_HISTORY);

      setLayers(previous);
      setHistoryList((list) => list.slice(0, -1));

      return { past: newPast, future: newFuture };
    });
  }, [layers, setLayers]);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;

      const next = h.future[0];
      const newFuture = h.future.slice(1);
      const newPast = [...h.past, layers].slice(-MAX_HISTORY);

      setLayers(next);
      setHistoryList((list) => [...list, { label: 'Redo', layers: next }]);

      return { past: newPast, future: newFuture };
    });
  }, [layers, setLayers]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [undo, redo]);

  return {
    setLayersWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    historyList
  };
}