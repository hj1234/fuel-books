"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { IconButton } from "./IconButton";
import { cn } from "./cn";

export type ModalSize = "sm" | "md" | "lg";

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnBackdrop = true,
  hideCloseButton = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  hideCloseButton?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 motion-safe:animate-[fadeIn_120ms_ease-out] sm:items-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "w-full overflow-hidden rounded-2xl bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-lg)]",
          "motion-safe:animate-[slideUp_140ms_ease-out]",
          SIZE[size],
        )}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-4">
            <div className="min-w-0">
              {title ? (
                <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-fg-muted">{description}</p>
              ) : null}
            </div>
            {hideCloseButton ? null : (
              <IconButton size="sm" label="Close" onClick={onClose}>
                <X size={16} />
              </IconButton>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] bg-surface-muted/40 px-6 py-3">
            {footer}
          </div>
        ) : null}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
