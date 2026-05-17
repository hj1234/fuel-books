"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const d = new Date(Date.UTC(year, monthIdx + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function InvoiceMonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(next: string) {
    if (!MONTH_RE.test(next)) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("month", next);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={
        "inline-flex items-center gap-1 rounded-lg bg-surface ring-1 ring-[color:var(--border)] p-1"
      }
      data-pending={pending ? "true" : "false"}
    >
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => go(shiftMonth(month, -1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <input
        type="month"
        value={month}
        onChange={(e) => go(e.target.value)}
        aria-label="Invoice month"
        className="h-8 rounded-md bg-transparent px-2 text-sm text-fg outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30"
      />
      <button
        type="button"
        aria-label="Next month"
        onClick={() => go(shiftMonth(month, 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
