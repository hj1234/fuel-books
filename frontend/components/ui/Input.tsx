"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { fieldBaseClasses } from "./FormField";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      data-invalid={invalid ? "true" : undefined}
      aria-invalid={invalid || undefined}
      className={cn(fieldBaseClasses, "h-10", className)}
      {...rest}
    />
  );
});
