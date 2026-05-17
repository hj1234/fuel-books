"use client";

import { CalendarRange, RotateCcw, User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import {
  buildExpensesUrl,
  hasActiveFilters,
  parseExpensesQuery,
  type ExpensesQuery,
} from "@/lib/expensesQuery";

type PilotOption = { id: string; name: string };

export function ExpensesFilters({ pilots }: { pilots: PilotOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Memoise the parsed query so handlers see a stable snapshot per render.
  const query = useMemo(() => parseExpensesQuery(params), [params]);

  function patch(p: Partial<ExpensesQuery>) {
    const url = buildExpensesUrl(pathname, params, p);
    startTransition(() => router.push(url, { scroll: false }));
  }

  const presets = useMemo(() => buildPresets(), []);

  const activePresetId = useMemo(
    () => presets.find((p) => p.from === query.from && p.to === query.to)?.id ?? null,
    [presets, query.from, query.to],
  );

  return (
    <Card variant="muted">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <FilterField icon={<User size={14} />} label="Pilot" className="min-w-[11rem] max-w-[min(100%,16rem)] shrink-0">
          <Select
            value={query.pilot ?? ""}
            onChange={(e) =>
              patch({ pilot: e.target.value ? e.target.value : null })
            }
            disabled={pending}
            aria-label="Filter by pilot"
          >
            <option value="">All pilots</option>
            {pilots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FilterField>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
            <CalendarRange size={14} className="text-fg-muted" aria-hidden="true" />
            Period
          </span>
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => patch({ from: preset.from, to: preset.to })}
                disabled={pending}
                className={cn(
                  "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium ring-1 transition-colors",
                  isActive
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--accent-soft)]"
                    : "bg-surface text-fg-muted ring-[color:var(--border)] hover:text-fg",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            patch({ pilot: null, from: null, to: null, sort: undefined, dir: undefined })
          }
          disabled={!hasActiveFilters(query) || pending}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium",
            "text-fg-muted hover:bg-surface hover:text-fg",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-muted",
          )}
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset
        </button>
      </div>
    </Card>
  );
}

function FilterField({
  icon,
  label,
  className,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        <span className="text-fg-muted" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      {children}
    </label>
  );
}

type Preset = { id: string; label: string; from: string | null; to: string | null };

function buildPresets(now: Date = new Date()): Preset[] {
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);

  const lastMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = startOfMonth(lastMonthAnchor);
  const lastMonthEnd = endOfMonth(lastMonthAnchor);

  // "Last 3 months" = the trailing 3 calendar months ending today (inclusive).
  const last3Start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1));

  const ytdStart = startOfYear(now);

  return [
    { id: "this_month", label: "This month", from: iso(thisMonthStart), to: iso(thisMonthEnd) },
    { id: "last_month", label: "Last month", from: iso(lastMonthStart), to: iso(lastMonthEnd) },
    { id: "last_3", label: "Last 3 months", from: iso(last3Start), to: iso(thisMonthEnd) },
    { id: "ytd", label: "Year to date", from: iso(ytdStart), to: iso(now) },
    { id: "all", label: "All time", from: null, to: null },
  ];
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
