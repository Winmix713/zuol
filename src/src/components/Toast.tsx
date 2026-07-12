import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Duration in ms before auto-dismiss. 0 = never auto-dismiss. */
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3500) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, t);
      }
    },
    [dismiss]
  );

  // Cleanup all timers on unmount
  useEffect(
    () => () => timers.current.forEach(clearTimeout),
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Stack UI ─────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} className="text-accent shrink-0" />,
  error:   <XCircle size={15} className="text-danger shrink-0" />,
  warning: <AlertTriangle size={15} className="text-amber-400 shrink-0" />,
  info:    <Info size={15} className="text-sky-400 shrink-0" />,
};

const BORDER: Record<ToastType, string> = {
  success: 'border-accent/25',
  error:   'border-danger/25',
  warning: 'border-amber-400/25',
  info:    'border-sky-400/25',
};

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="assertive"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border ${BORDER[t.type]} bg-panel-elevated px-4 py-3 shadow-xl shadow-black/30 backdrop-blur text-[12px] text-text-primary min-w-[240px] max-w-[360px]`}
          style={{ animation: 'toast-in 0.18s ease' }}
        >
          {ICONS[t.type]}
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="ml-1 shrink-0 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
