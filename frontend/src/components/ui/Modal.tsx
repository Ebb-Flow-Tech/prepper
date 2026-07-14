'use client';

import { useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Max width class for the modal. Defaults to 'max-w-md' */
  maxWidth?: string;
  /** Max height class for the modal. Defaults to 'max-h-[90vh]' */
  maxHeight?: string;
  /** When true, blocks backdrop click, Escape key, and hides the close button */
  disableClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  maxHeight = 'max-h-[90vh]',
  disableClose = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close modal, and focus trap for Tab key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!disableClose) onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (focusable.length === 0) return;
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    },
    [onClose, disableClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop - click to close (blocked when disableClose) */}
      <div
        className="absolute inset-0 bg-[var(--color-scrim)]"
        aria-hidden="true"
        onClick={disableClose ? undefined : onClose}
      />

      {/* Modal content — 16px radius, overlay surface, elevation-3 (§9, §12.6) */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full overflow-y-auto rounded-2xl bg-popover p-6',
          'shadow-elevation-3 focus:outline-none',
          maxWidth,
          maxHeight
        )}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          {/* Section title: 20/500 (§5.2) */}
          <h2
            id="modal-title"
            className="text-xl font-medium tracking-[-0.01em] text-foreground"
          >
            {title}
          </h2>
          {!disableClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--color-text-tertiary)] transition-colors duration-[120ms] hover:bg-accent hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        {children}
      </div>
    </div>
  );
}
