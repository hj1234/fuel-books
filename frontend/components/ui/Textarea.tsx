"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

import { fieldBaseClasses } from "./FormField";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-invalid={invalid ? "true" : undefined}
      aria-invalid={invalid || undefined}
      className={cn(fieldBaseClasses, "min-h-[80px] py-2", className)}
      {...rest}
    />
  );
});
