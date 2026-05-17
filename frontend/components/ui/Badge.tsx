import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-fg-muted ring-[color:var(--border)]",
  success: "bg-[color:var(--success-soft)] text-[color:var(--success-soft-fg)] ring-[color:var(--success-soft)]",
  warning: "bg-[color:var(--warning-soft)] text-[color:var(--warning-soft-fg)] ring-[color:var(--warning-soft)]",
  danger: "bg-[color:var(--danger-soft)] text-[color:var(--danger-soft-fg)] ring-[color:var(--danger-soft)]",
  info: "bg-[color:var(--info-soft)] text-[color:var(--info-soft-fg)] ring-[color:var(--info-soft)]",
  accent: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--accent-soft)]",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  leftIcon?: ReactNode;
  size?: "sm" | "md";
};

export function Badge({ tone = "neutral", leftIcon, size = "sm", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full ring-1 font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {leftIcon ? <span className="-ml-0.5 inline-flex items-center" aria-hidden="true">{leftIcon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
