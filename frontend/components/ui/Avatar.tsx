import { cn } from "./cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

function initialsFrom(input: string, max = 2, from: "start" | "end" = "start") {
  const cleaned = input.trim();
  if (!cleaned) return "·";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    const single = parts[0]!;
    // For things like "G-ABCD", strip the dash and take chars from the
    // requested end (start by default; end is useful for tail-identifying
    // strings like aircraft registrations where prefixes are shared).
    const compact = single.replace(/[^A-Za-z0-9]/g, "");
    if (compact.length === 0) return "·";
    const sliced = from === "end" ? compact.slice(-max) : compact.slice(0, max);
    return sliced.toUpperCase();
  }
  const picked = from === "end" ? parts.slice(-max) : parts.slice(0, max);
  return picked
    .map((p) => p[0]!)
    .join("")
    .toUpperCase();
}

/** Deterministic color hash so each avatar gets a stable tint. */
function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  // 4 curated tints (subtle, work in light/dark).
  const tints = [
    {
      bg: "bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
    },
    {
      bg: "bg-[color:var(--info-soft)] text-[color:var(--info-soft-fg)]",
    },
    {
      bg: "bg-[color:var(--warning-soft)] text-[color:var(--warning-soft-fg)]",
    },
    {
      bg: "bg-[color:var(--success-soft)] text-[color:var(--success-soft-fg)]",
    },
  ];
  return tints[Math.abs(hash) % tints.length]!;
}

export function Avatar({
  name,
  size = "md",
  className,
  square,
  from = "start",
}: {
  name: string;
  size?: AvatarSize;
  className?: string;
  square?: boolean;
  from?: "start" | "end";
}) {
  const initials = initialsFrom(name, 2, from);
  const tint = tintFor(name);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-wide select-none",
        square ? "rounded-md" : "rounded-full",
        "ring-1 ring-[color:var(--border)]",
        SIZE[size],
        tint.bg,
        className,
      )}
    >
      {initials}
    </span>
  );
}
