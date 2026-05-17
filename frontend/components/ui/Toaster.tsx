"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "./IconButton";
import { cn } from "./cn";
import { toastBus, type ToastItem, type ToastVariant } from "./toast";

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const VARIANT_RING: Record<ToastVariant, string> = {
  success: "ring-[color:var(--success-soft)] text-[color:var(--success-soft-fg)]",
  error: "ring-[color:var(--danger-soft)] text-[color:var(--danger-soft-fg)]",
  info: "ring-[color:var(--info-soft)] text-[color:var(--info-soft-fg)]",
  warning: "ring-[color:var(--warning-soft)] text-[color:var(--warning-soft-fg)]",
};

const VARIANT_ICON_BG: Record<ToastVariant, string> = {
  success: "bg-[color:var(--success-soft)] text-[color:var(--success)]",
  error: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  info: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
  warning: "bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => toastBus.subscribe(setItems), []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items
      .filter((i) => i.durationMs > 0)
      .map((i) => {
        const remaining = i.durationMs - (Date.now() - i.createdAt);
        const wait = Math.max(0, remaining);
        return window.setTimeout(() => toastBus.dismiss(i.id), wait);
      });
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:top-4 sm:left-auto sm:px-0"
    >
      {items.map((item) => {
        const Icon = VARIANT_ICON[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-surface ring-1 px-3.5 py-3 text-sm shadow-[var(--shadow-md)]",
              "max-w-sm motion-safe:animate-[toastIn_180ms_ease-out]",
              VARIANT_RING[item.variant],
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                VARIANT_ICON_BG[item.variant],
              )}
              aria-hidden="true"
            >
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-sm font-medium text-fg">{item.message}</div>
              {item.description ? (
                <div className="mt-0.5 text-[12px] text-fg-muted">{item.description}</div>
              ) : null}
            </div>
            <IconButton
              size="sm"
              label="Dismiss"
              onClick={() => toastBus.dismiss(item.id)}
              className="-mr-1 -mt-1"
            >
              <X size={14} />
            </IconButton>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
