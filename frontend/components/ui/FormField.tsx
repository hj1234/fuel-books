"use client";

import { AlertCircle } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "./cn";

type FormFieldContextProps = {
  id: string;
  invalid: boolean;
  describedBy?: string;
};

export function FormField({
  label,
  helper,
  error,
  required,
  htmlFor,
  className,
  children,
  hint,
}: {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  hint?: ReactNode;
  children: ReactNode | ((ctx: FormFieldContextProps) => ReactNode);
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const ctx: FormFieldContextProps = {
    id,
    invalid,
    describedBy: error ? errorId : helper ? helperId : undefined,
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className="flex items-center gap-1 text-xs font-medium text-fg-muted"
        >
          {label}
          {required ? <span className="text-danger" aria-hidden="true">*</span> : null}
          {hint ? <span className="ml-auto text-[11px] font-normal text-fg-subtle">{hint}</span> : null}
        </label>
      ) : null}
      {typeof children === "function" ? children(ctx) : children}
      {error ? (
        <div id={errorId} className="flex items-start gap-1.5 text-[12px] text-danger">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : helper ? (
        <div id={helperId} className="text-[12px] text-fg-subtle">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export const fieldBaseClasses = cn(
  "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg",
  "placeholder:text-fg-subtle",
  "outline-none transition-colors duration-150",
  "border-[color:var(--border)]",
  "focus:border-[color:var(--accent)]",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted",
  "data-[invalid=true]:border-danger data-[invalid=true]:focus:border-danger",
);
