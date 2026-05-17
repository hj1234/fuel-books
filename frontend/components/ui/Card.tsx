import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Visual variant */
  variant?: "default" | "elevated" | "muted";
  /** Optional header row rendered above children with a divider. */
  header?: ReactNode;
  /** Optional footer row with a top divider. */
  footer?: ReactNode;
  /** Toggle padding on the body slot. Defaults true. */
  padded?: boolean;
};

const VARIANT: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-sm)]",
  elevated:
    "bg-surface-elevated ring-1 ring-[color:var(--border)] shadow-[var(--shadow-md)]",
  muted: "bg-surface-muted ring-1 ring-[color:var(--border)]",
};

export function Card({
  variant = "default",
  header,
  footer,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn("rounded-2xl overflow-hidden", VARIANT[variant], className)}
      {...rest}
    >
      {header ? (
        <header className="border-b border-[color:var(--border)] px-6 py-4">{header}</header>
      ) : null}
      <div className={cn(padded ? "px-6 py-5" : "")}>{children}</div>
      {footer ? (
        <footer className="border-t border-[color:var(--border)] px-6 py-4 bg-surface-muted/40">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

export function CardSection({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-t border-[color:var(--border)] first:border-t-0 px-6 py-5", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-sm font-semibold tracking-tight text-fg", className)}>{children}</h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("mt-1 text-sm text-fg-muted", className)}>{children}</p>;
}
