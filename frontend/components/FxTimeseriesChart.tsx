"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { formatDate, formatNumber } from "@/lib/format";

type FxTimeseriesPoint = {
  effective_date: string;
  rate: number;
};

type FxTimeseriesOut = {
  base_currency: string;
  quote_currency: string;
  start_date: string;
  end_date: string;
  derived: boolean;
  derivation: string;
  source: string;
  points: FxTimeseriesPoint[];
};

const RANGE_OPTIONS = [
  { id: "1M", label: "1M", days: 30 },
  { id: "3M", label: "3M", days: 91 },
  { id: "6M", label: "6M", days: 182 },
  { id: "1Y", label: "1Y", days: 365 },
  { id: "5Y", label: "5Y", days: 365 * 5 },
] as const;

type RangeId = (typeof RANGE_OPTIONS)[number]["id"];

const TOOLTIP_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const AXIS_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODateDay(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function niceRate(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(2);
  if (abs >= 10) return n.toFixed(3);
  if (abs >= 1) return n.toFixed(4);
  return n.toFixed(5);
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M ${points[0]!.x} ${points[0]!.y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

export function FxTimeseriesChart({
  currencies,
  defaultBase = "GBP",
  defaultQuote = "EUR",
}: {
  currencies: string[];
  defaultBase?: string;
  defaultQuote?: string;
}) {
  const sortedCurrencies = useMemo(() => {
    const set = new Set<string>(currencies);
    set.add("EUR");
    if (defaultBase) set.add(defaultBase);
    if (defaultQuote) set.add(defaultQuote);
    return Array.from(set).sort();
  }, [currencies, defaultBase, defaultQuote]);

  const initialBase = sortedCurrencies.includes(defaultBase)
    ? defaultBase
    : sortedCurrencies[0] ?? "EUR";
  const initialQuote = sortedCurrencies.includes(defaultQuote)
    ? defaultQuote
    : sortedCurrencies.find((c) => c !== initialBase) ?? "EUR";

  const [base, setBase] = useState<string>(initialBase);
  const [quote, setQuote] = useState<string>(initialQuote);
  const [rangeId, setRangeId] = useState<RangeId>("1Y");

  const [data, setData] = useState<FxTimeseriesOut | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const sameCurrency = base === quote;

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const days = RANGE_OPTIONS.find((r) => r.id === rangeId)?.days ?? 365;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    return { startDate: isoDay(start), endDate: isoDay(end) };
  }, [rangeId]);

  useEffect(() => {
    if (!base || !quote || sameCurrency) return;

    let aborted = false;
    const ac = new AbortController();

    const url =
      `/api/fb/v1/fx-rates/timeseries?base_currency=${encodeURIComponent(base)}` +
      `&quote_currency=${encodeURIComponent(quote)}` +
      `&start_date=${encodeURIComponent(startDate)}` +
      `&end_date=${encodeURIComponent(endDate)}`;

    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(url, { method: "GET", signal: ac.signal });
        if (aborted) return;
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setData(null);
          setFetchError(body?.detail?.detail ?? body?.detail ?? "Failed to load FX timeseries");
          return;
        }
        const json = (await res.json()) as FxTimeseriesOut;
        if (aborted) return;
        setData(json);
      } catch (e) {
        if (!aborted && (e as { name?: string } | null)?.name !== "AbortError") {
          setFetchError("Failed to load FX timeseries");
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
      ac.abort();
    };
  }, [base, quote, sameCurrency, startDate, endDate]);

  const error = sameCurrency ? "Pick two different currencies." : fetchError;
  const displayData = sameCurrency ? null : data;

  const swap = useCallback(() => {
    setBase((prev) => {
      const newBase = quote;
      setQuote(prev);
      return newBase;
    });
  }, [quote]);

  const series = useMemo(() => {
    const points = displayData?.points ?? [];
    return points
      .map((p) => ({ date: parseISODateDay(p.effective_date), value: p.rate }))
      .filter((r): r is { date: Date; value: number } => !!r.date && Number.isFinite(r.value))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [displayData]);

  const summary = useMemo(() => {
    if (series.length === 0) return null;
    const first = series[0]!.value;
    const last = series[series.length - 1]!.value;
    const min = series.reduce((m, p) => Math.min(m, p.value), Infinity);
    const max = series.reduce((m, p) => Math.max(m, p.value), -Infinity);
    const changeAbs = last - first;
    const changePct = first === 0 ? 0 : (changeAbs / first) * 100;
    return { first, last, min, max, changeAbs, changePct };
  }, [series]);

  return (
    <Card
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>FX timeseries</CardTitle>
            <CardDescription>
              {base && quote
                ? `1 ${base} priced in ${quote}${displayData?.derived ? " (derived via EUR)" : ""}`
                : "Pick two currencies to chart a rate over time."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Base" className="w-28">
              {({ id }) => (
                <Select
                  id={id}
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  className="h-9 text-xs"
                >
                  {sortedCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <button
              type="button"
              onClick={swap}
              className="h-9 self-end rounded-lg px-2 text-xs text-fg-muted ring-1 ring-[color:var(--border)] transition hover:bg-surface-muted"
              aria-label="Swap base and quote currencies"
              title="Swap currencies"
            >
              ⇄
            </button>
            <FormField label="Quote" className="w-28">
              {({ id }) => (
                <Select
                  id={id}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  className="h-9 text-xs"
                >
                  {sortedCurrencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <RangePicker value={rangeId} onChange={setRangeId} />
          </div>
        </div>
      }
    >
      <FxChartBody
        series={series}
        loading={loading}
        error={error}
        base={base}
        quote={quote}
        meta={displayData}
        summary={summary}
      />
    </Card>
  );
}

function RangePicker({
  value,
  onChange,
}: {
  value: RangeId;
  onChange: (v: RangeId) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="inline-flex h-9 items-center rounded-lg p-0.5 text-xs ring-1 ring-[color:var(--border)]"
    >
      {RANGE_OPTIONS.map((r) => {
        const active = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            aria-pressed={active}
            className={
              "h-8 rounded-md px-2 transition " +
              (active
                ? "bg-surface text-fg shadow-[var(--shadow-sm)]"
                : "text-fg-muted hover:text-fg")
            }
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function FxChartBody({
  series,
  loading,
  error,
  base,
  quote,
  meta,
  summary,
}: {
  series: Array<{ date: Date; value: number }>;
  loading: boolean;
  error: string | null;
  base: string;
  quote: string;
  meta: FxTimeseriesOut | null;
  summary:
    | {
        first: number;
        last: number;
        min: number;
        max: number;
        changeAbs: number;
        changePct: number;
      }
    | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const height = 300;
  const gradientId = useId();

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dims = useMemo(() => {
    const w = Math.max(0, width);
    const h = height;
    const pad = { l: 56, r: 16, t: 18, b: 38 };
    return { w, h, pad, plotW: Math.max(0, w - pad.l - pad.r), plotH: Math.max(0, h - pad.t - pad.b) };
  }, [width]);

  const scales = useMemo(() => {
    if (series.length === 0) return null;
    const times = series.map((p) => p.date.getTime());
    const values = series.map((p) => p.value);
    const minX = Math.min(...times);
    const maxX = Math.max(...times);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);

    if (minY === maxY) {
      minY = minY * 0.99;
      maxY = maxY * 1.01;
      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }
    } else {
      const range = maxY - minY;
      minY -= range * 0.08;
      maxY += range * 0.08;
    }

    const x = (t: number) => dims.pad.l + ((t - minX) / (maxX - minX || 1)) * dims.plotW;
    const y = (v: number) => dims.pad.t + (1 - (v - minY) / (maxY - minY || 1)) * dims.plotH;
    return { minX, maxX, minY, maxY, x, y };
  }, [series, dims]);

  const paths = useMemo(() => {
    if (!scales) return null;
    const pts = series.map((p) => ({ x: scales.x(p.date.getTime()), y: scales.y(p.value), row: p }));
    if (pts.length < 2) return { line: "", area: "", pts };
    const line = buildPath(pts);
    const baseY = dims.pad.t + dims.plotH;
    const area = `${line} L ${pts[pts.length - 1]!.x} ${baseY} L ${pts[0]!.x} ${baseY} Z`;
    return { line, area, pts };
  }, [series, scales, dims]);

  const yTicks = useMemo(() => {
    if (!scales) return [];
    const mid = (scales.minY + scales.maxY) / 2;
    return [
      { value: scales.maxY, y: dims.pad.t },
      { value: mid, y: dims.pad.t + dims.plotH / 2 },
      { value: scales.minY, y: dims.pad.t + dims.plotH },
    ];
  }, [scales, dims]);

  const xTicks = useMemo(() => {
    if (!scales || series.length === 0) return [];
    const first = series[0]!.date.getTime();
    const last = series[series.length - 1]!.date.getTime();
    const mid = first + (last - first) / 2;
    return [first, mid, last].map((t) => ({ t, x: scales.x(t), label: AXIS_DATE_FMT.format(new Date(t)) }));
  }, [scales, series]);

  const hover = hoverIdx != null && paths?.pts ? paths.pts[hoverIdx] : null;

  function onMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!paths || paths.pts.length === 0) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left + dims.pad.l;
    let nearest = 0;
    let dist = Infinity;
    for (let i = 0; i < paths.pts.length; i++) {
      const d = Math.abs(paths.pts[i]!.x - x);
      if (d < dist) {
        dist = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const empty = !loading && !error && series.length === 0;
  const changeTone =
    summary == null
      ? "neutral"
      : summary.changeAbs > 0
        ? "success"
        : summary.changeAbs < 0
          ? "danger"
          : "neutral";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="text-2xl font-semibold tabular-nums text-fg">
          {summary ? niceRate(summary.last) : "—"}
          <span className="ml-2 text-sm font-normal text-fg-muted">
            {quote}/{base}
          </span>
        </div>
        {summary ? (
          <Badge tone={changeTone}>
            {summary.changeAbs >= 0 ? "+" : ""}
            {niceRate(summary.changeAbs)} ({summary.changePct >= 0 ? "+" : ""}
            {formatNumber(summary.changePct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
          </Badge>
        ) : null}
        {meta ? (
          <div className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
            <Badge tone="neutral">{meta.source}</Badge>
            {meta.derived ? <Badge tone="info">derived</Badge> : null}
            <span className="hidden sm:inline">{meta.derivation}</span>
          </div>
        ) : null}
      </div>

      <div ref={containerRef} className="relative">
        {error ? (
          <div className="rounded-xl bg-[color:var(--danger-soft)] px-3 py-10 text-center text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
            {error}
          </div>
        ) : loading && series.length === 0 ? (
          <div className="rounded-xl bg-surface-muted px-3 py-10 text-center text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
            Loading rates…
          </div>
        ) : empty ? (
          <div className="rounded-xl bg-surface-muted px-3 py-10 text-center text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
            No FX data available for {base}/{quote} in the selected range.
          </div>
        ) : width < 240 ? (
          <div className="rounded-xl bg-surface-muted px-3 py-10 text-center text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
            Resize to view chart.
          </div>
        ) : (
          <>
            <svg
              width={dims.w}
              height={dims.h}
              role="img"
              aria-label={`FX rate chart for ${base}/${quote}`}
              className="block text-[color:var(--accent)]"
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {yTicks.map((tk, idx) => (
                <g key={idx}>
                  <line
                    x1={dims.pad.l}
                    x2={dims.pad.l + dims.plotW}
                    y1={tk.y}
                    y2={tk.y}
                    stroke="var(--border)"
                    strokeDasharray="2 4"
                  />
                  <text
                    x={dims.pad.l - 8}
                    y={tk.y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--fg-subtle)"
                  >
                    {niceRate(tk.value)}
                  </text>
                </g>
              ))}

              {paths?.area ? <path d={paths.area} fill={`url(#${gradientId})`} /> : null}
              {paths?.line ? (
                <path
                  d={paths.line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : null}

              {xTicks.map((tk, idx) => (
                <g key={idx}>
                  <line
                    x1={tk.x}
                    x2={tk.x}
                    y1={dims.pad.t + dims.plotH}
                    y2={dims.pad.t + dims.plotH + 5}
                    stroke="var(--border)"
                  />
                  <text
                    x={tk.x}
                    y={dims.pad.t + dims.plotH + 22}
                    textAnchor={idx === 0 ? "start" : idx === xTicks.length - 1 ? "end" : "middle"}
                    fontSize="10"
                    fill="var(--fg-subtle)"
                  >
                    {tk.label}
                  </text>
                </g>
              ))}

              {hover ? (
                <>
                  <line
                    x1={hover.x}
                    x2={hover.x}
                    y1={dims.pad.t}
                    y2={dims.pad.t + dims.plotH}
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeDasharray="2 3"
                  />
                  <circle
                    cx={hover.x}
                    cy={hover.y}
                    r="4"
                    fill="var(--surface)"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </>
              ) : null}

              <rect
                x={dims.pad.l}
                y={dims.pad.t}
                width={dims.plotW}
                height={dims.plotH}
                fill="transparent"
                onMouseMove={onMouseMove}
                style={{ cursor: "crosshair" }}
              />
            </svg>

            {hover ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-md)] ring-1 ring-[color:var(--border)]"
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="font-medium text-fg tabular-nums">
                  {niceRate(hover.row.value)} {quote}/{base}
                </div>
                <div className="text-fg-muted">
                  {TOOLTIP_DATE_FMT.format(hover.row.date)}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 text-xs text-fg-muted sm:grid-cols-4">
          <Stat label="Open" value={`${niceRate(summary.first)} ${quote}`} />
          <Stat label="Close" value={`${niceRate(summary.last)} ${quote}`} />
          <Stat label="Low" value={`${niceRate(summary.min)} ${quote}`} />
          <Stat label="High" value={`${niceRate(summary.max)} ${quote}`} />
        </div>
      ) : null}

      {meta && series.length > 0 ? (
        <p className="text-[11px] text-fg-subtle">
          {series.length} observations · {formatDate(meta.start_date)} → {formatDate(meta.end_date)}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-muted px-3 py-2 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="text-sm font-medium tabular-nums text-fg">{value}</div>
    </div>
  );
}
