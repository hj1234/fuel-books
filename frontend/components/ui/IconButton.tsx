"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "./cn";

export type IconButtonVariant = "ghost" | "secondary" | "danger";
export type IconButtonSize = "sm" | "md";

const SIZE: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-9 w-9 rounded-lg",
};

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-fg-muted hover:text-fg hover:bg-surface-muted",
  secondary:
    "bg-surface text-fg border border-border-default hover:bg-surface-muted",
  danger:
    "bg-transparent text-danger hover:bg-[color:var(--danger-soft)]",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", size = "md", label, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-150 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-60",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
