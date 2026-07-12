import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' renders the confirm button in red. Default 'default'. */
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button by default (safe default)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape key cancels
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-panel-elevated shadow-2xl shadow-black/50 p-6 mx-4">
        <div className="flex items-start gap-3 mb-4">
          {variant === 'danger' && (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-danger/10 border border-danger/20">
              <AlertTriangle size={15} className="text-danger" />
            </span>
          )}
          <div>
            <h2
              id="confirm-title"
              className="text-[14px] font-semibold text-text-primary leading-tight"
            >
              {title}
            </h2>
            <p className="mt-1 text-[12px] text-text-secondary leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
              variant === 'danger'
                ? 'bg-danger/80 text-white hover:bg-danger focus-visible:ring-danger/50'
                : 'bg-accent/80 text-black hover:bg-accent focus-visible:ring-accent/50'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
