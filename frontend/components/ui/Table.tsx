import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "./cn";

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("min-w-full text-sm", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-fg-subtle",
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-[color:var(--border)]", className)} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-surface-muted/60 align-top",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export type AlignProp = "left" | "right" | "center";

export function TH({
  className,
  align = "left",
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: AlignProp }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 font-semibold border-b border-[color:var(--border)]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({
  className,
  align = "left",
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: AlignProp }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-fg",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function TableFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
