import type { ReactNode } from "react";

import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "py-8 px-6" : "py-14 px-6",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 inline-flex items-center justify-center rounded-full",
            "bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]",
            size === "sm" ? "h-10 w-10" : "h-12 w-12",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className={cn("text-fg font-medium", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </div>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
