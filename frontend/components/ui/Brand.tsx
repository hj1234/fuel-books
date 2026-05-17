import Link from "next/link";

import { cn } from "./cn";

export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md text-primary-fg",
        "bg-[var(--primary)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 13l4-1.5L12 4l1.5 1L10 12l5 1.5 3-2.5 1 1-3 4-2-.5-3 6-1-1 1.5-5L7 16l-1.5 2.5L4 18l1-3-2-2z" />
      </svg>
    </span>
  );
}

export function BrandLockup({
  href = "/aircraft",
  size = 28,
  className,
}: {
  href?: string | null;
  size?: number;
  className?: string;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} />
      <span className="text-[15px] font-semibold tracking-tight text-fg">Fuel Books</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center gap-2 outline-none">
      {inner}
    </Link>
  );
}
