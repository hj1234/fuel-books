"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

export type BenchmarkPriceOut = {
  id: string;
  policy_id: string;
  airfield_code: string;
  effective_from: string; // YYYY-MM-DD
  fuel_type: string;
  price_per_unit: number;
  unit: string;
  currency: string;
  includes_vat: boolean;
  vat_rate: number;
};

type AircraftMeta = {
  aircraft_id: string;
  aircraft_registration: string;
  policy_id: string;
  home_base_airfield: string | null;
};

type SeriesKey = `${string}__${string}__${string}__${string}__${string}`;

function seriesKeyOf(p: BenchmarkPriceOut): SeriesKey {
  return `${p.policy_id}__${p.airfield_code}__${p.fuel_type}__${p.currency}__${p.unit}`;
}

function parseSeriesKey(key: SeriesKey) {
  const [policyId, airfield, fuel, currency, unit] = key.split("__");
  return {
    policyId: policyId ?? "",
    airfield: airfield ?? "",
    fuel: fuel ?? "",
    currency: currency ?? "",
    unit: unit ?? "",
  };
}

function seriesLabelFromKey(key: SeriesKey, aircraftByPolicy?: Map<string, AircraftMeta>) {
  const { policyId, airfield, fuel, currency, unit } = parseSeriesKey(key);
  const ac = aircraftByPolicy?.get(policyId);
  const lead = ac ? `${ac.aircraft_registration} · ${airfield}` : airfield;
  return `${lead} • ${fuel} • ${currency}/${unit}`;
}

function parseISODateDay(isoDay: string) {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const TOOLTIP_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function niceNumber(n: number) {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) < 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (Math.abs(n) < 10) return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (Math.abs(n) < 100) return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return n.toFixed(0);
}

function buildPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return (
    `M ${points[0]!.x} ${points[0]!.y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
  );
}

export function BenchmarkPricesChart({
  prices,
  selectedId,
  onSelect,
  aircraftByPolicy,
}: {
  prices: BenchmarkPriceOut[];
  selectedId?: string | null;
  onSelect?: (p: BenchmarkPriceOut | null) => void;
  aircraftByPolicy?: Map<string, AircraftMeta>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const height = 280;
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

  const allSeriesKeys = useMemo(() => {
    const keys = Array.from(new Set(prices.map(seriesKeyOf)));
    keys.sort((a, b) =>
      seriesLabelFromKey(a, aircraftByPolicy).localeCompare(seriesLabelFromKey(b, aircraftByPolicy)),
    );
    return keys;
  }, [prices, aircraftByPolicy]);

  const [selectedKey, setSelectedKey] = useState<SeriesKey | null>(null);

  useEffect(() => {
    if (allSeriesKeys.length === 0) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey((prev) => (prev && allSeriesKeys.includes(prev) ? prev : allSeriesKeys[0]!));
  }, [allSeriesKeys]);

  const seriesRows = useMemo(() => {
    if (!selectedKey) return [];
    const filtered = prices.filter((p) => seriesKeyOf(p) === selectedKey);

    // Within a day we just take the last one we encounter — IDs are now
    // opaque UUIDs and can't be ordered to pick "the newest".
    const byDay = new Map<string, BenchmarkPriceOut>();
    for (const p of filtered) {
      byDay.set(p.effective_from, p);
    }

    const rows = Array.from(byDay.values())
      .map((p) => ({ date: parseISODateDay(p.effective_from), value: p.price_per_unit, row: p }))
      .filter((r): r is { date: Date; value: number; row: BenchmarkPriceOut } => !!r.date && Number.isFinite(r.value));

    rows.sort((a, b) => a.date.getTime() - b.date.getTime());
    return rows;
  }, [prices, selectedKey]);

  const dims = useMemo(() => {
    const w = Math.max(0, width);
    const h = height;
    const pad = { l: 52, r: 16, t: 18, b: 38 };
    return { w, h, pad, plotW: Math.max(0, w - pad.l - pad.r), plotH: Math.max(0, h - pad.t - pad.b) };
  }, [width]);

  const scales = useMemo(() => {
    const times = seriesRows.map((p) => p.date.getTime());
    const values = seriesRows.map((p) => p.value);
    const minX = Math.min(...times);
    const maxX = Math.max(...times);
    let minY = Math.min(...values);
    let maxY = Math.max(...values);

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY))
      return null;

    if (minY === maxY) {
      minY = minY * 0.95;
      maxY = maxY * 1.05;
      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }
    } else {
      const range = maxY - minY;
      minY -= range * 0.06;
      maxY += range * 0.06;
    }

    const x = (t: number) => dims.pad.l + ((t - minX) / (maxX - minX || 1)) * dims.plotW;
    const y = (v: number) => dims.pad.t + (1 - (v - minY) / (maxY - minY || 1)) * dims.plotH;
    return { minX, maxX, minY, maxY, x, y };
  }, [seriesRows, dims]);

  const paths = useMemo(() => {
    if (!scales) return null;
    const pts = seriesRows.map((p) => ({ x: scales.x(p.date.getTime()), y: scales.y(p.value), row: p.row }));
    if (pts.length < 2) return { line: "", area: "", pts };
    const line = buildPath(pts);
    const baseY = dims.pad.t + dims.plotH;
    const area = `${line} L ${pts[pts.length - 1]!.x} ${baseY} L ${pts[0]!.x} ${baseY} Z`;
    return { line, area, pts };
  }, [seriesRows, scales, dims]);

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
    if (!scales || seriesRows.length === 0) return [];
    const first = seriesRows[0]!.date.getTime();
    const last = seriesRows[seriesRows.length - 1]!.date.getTime();
    const mid = first + (last - first) / 2;
    return [first, mid, last].map((t) => ({ t, x: scales.x(t), label: DATE_FMT.format(new Date(t)) }));
  }, [scales, seriesRows]);

  const title = selectedKey ? seriesLabelFromKey(selectedKey, aircraftByPolicy) : "Fuel prices";
  const hover = hoverIdx != null && paths?.pts ? paths.pts[hoverIdx] : null;
  const hoverCcy = hover?.row.currency ?? "";
  const hoverUnit = hover?.row.unit ?? "";

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

  return (
    <Card
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Prices through time</CardTitle>
            <CardDescription>{title}</CardDescription>
          </div>
          {allSeriesKeys.length > 0 ? (
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <span>Series</span>
              <Select
                className="h-9 text-xs"
                value={selectedKey ?? ""}
                onChange={(e) => setSelectedKey(e.target.value as SeriesKey)}
              >
                {allSeriesKeys.map((k) => (
                  <option key={k} value={k}>
                    {seriesLabelFromKey(k, aircraftByPolicy)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
      }
    >
      <div ref={containerRef} className="relative">
        {seriesRows.length === 0 ? (
          <div className="rounded-xl bg-surface-muted px-3 py-10 text-center text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
            No data to chart yet.
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
              aria-label="Fuel price chart"
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
                    {niceNumber(tk.value)}
                  </text>
                </g>
              ))}

              {paths?.area ? <path d={paths.area} fill={`url(#${gradientId})`} /> : null}
              {paths?.line ? (
                <path d={paths.line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

              {paths?.pts.map((p, idx) => {
                const active = selectedId != null && p.row.id === selectedId;
                const hovered = hoverIdx === idx;
                return (
                  <g key={idx}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={active || hovered ? 4.5 : 2.75}
                      fill="var(--surface)"
                      stroke="currentColor"
                      strokeWidth={active ? 2 : 1.5}
                    />
                    {active ? (
                      <circle cx={p.x} cy={p.y} r="9" fill="transparent" stroke="currentColor" strokeOpacity="0.25" />
                    ) : null}
                  </g>
                );
              })}

              {hover ? (
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={dims.pad.t}
                  y2={dims.pad.t + dims.plotH}
                  stroke="currentColor"
                  strokeOpacity="0.35"
                  strokeDasharray="2 3"
                />
              ) : null}

              <rect
                x={dims.pad.l}
                y={dims.pad.t}
                width={dims.plotW}
                height={dims.plotH}
                fill="transparent"
                onMouseMove={onMouseMove}
                onClick={() => {
                  if (hover) onSelect?.(hover.row);
                }}
                style={{ cursor: hover ? "pointer" : "crosshair" }}
              />
            </svg>

            {hover ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-surface px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-md)] ring-1 ring-[color:var(--border)]"
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="font-medium text-fg">
                  {niceNumber(hover.row.price_per_unit)} {hoverCcy}/{hoverUnit}
                </div>
                <div className="text-fg-muted">
                  {TOOLTIP_DATE_FMT.format(new Date(`${hover.row.effective_from}T00:00:00.000Z`))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
