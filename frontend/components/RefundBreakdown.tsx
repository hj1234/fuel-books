"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Coins,
  Percent,
  Receipt,
  Scale,
  Shield,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { formatMoney, formatNumber, formatUnitPrice } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BreakdownRow = {
  label: string;
  value: string;
  /** Math operator rendered as a faint prefix on the value (e.g. `× 1.17`). */
  op?: "+" | "−" | "×" | "÷";
  /** Smaller line of supporting context shown under the label. */
  hint?: string;
};

type BreakdownResult = {
  label: string;
  value: string;
  hint?: string;
};

type BreakdownCard = {
  /** Step number; omitted for nested side-calculations like the benchmark cap. */
  number?: number;
  /** Visually indented + softer treatment when true. */
  nested?: boolean;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  rows: BreakdownRow[];
  result: BreakdownResult;
  badge?: { tone: BadgeTone; text: string };
};

type SetupItem = { icon: LucideIcon; label: string; value: string };

export type Breakdown = {
  setup: SetupItem[];
  cards: BreakdownCard[];
};

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function humanCalcType(raw: string | null): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/^CountryCalcType\./, "");
  switch (stripped) {
    case "PERCENT_TOTAL":
      return "Percentage of total";
    case "BENCHMARK_CAPPED":
      return "Benchmark-capped actuals";
    case "BENCHMARK_ONLY":
      return "Benchmark only";
    default:
      return stripped
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function fxHint(base: string | null, quote: string | null, date: string | null): string | undefined {
  if (!base || !quote) return undefined;
  return date ? `${base} → ${quote} · ${date}` : `${base} → ${quote}`;
}

function fmtPercent(rate: number): string {
  // Example: 0.85 → "85%", 0.075 → "7.5%"
  const pct = rate * 100;
  const decimals = Math.abs(pct - Math.round(pct)) < 1e-9 ? 0 : 2;
  return `${formatNumber(pct, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export function extractBreakdown(
  details: Record<string, unknown> | null,
  refund?: { amount: number; currency: string },
): Breakdown | null {
  const d = asRecord(details);
  if (!d) return null;

  const policy = asRecord(d.policy);
  const rateRule = asRecord(d.rate_rule);
  const expenseInputs = asRecord(d.expense_inputs);
  const actuals = asRecord(d.actuals);
  const actualReimb = actuals ? asRecord(actuals.actual_reimbursable) : null;
  const actualConv = actuals ? asRecord(actuals.converted_to_policy) : null;
  const fxActual = actualConv ? asRecord(actualConv.fx) : null;

  const benchmark = asRecord(d.benchmark);
  const benchConv = benchmark ? asRecord(benchmark.converted_to_policy) : null;
  const fxBench = benchConv ? asRecord(benchConv.fx) : null;

  const calculation = asRecord(d.calculation);

  const policyBase = policy ? asString(policy.base_currency) : null;
  const calcTypeRaw = rateRule ? asString(rateRule.calc_type) : null;
  const calcType = calcTypeRaw ? calcTypeRaw.replace(/^CountryCalcType\./, "") : null;
  const humanRule = humanCalcType(calcTypeRaw);

  const reimburseVat = rateRule ? rateRule.reimburse_vat === true : null;
  const percentRate = rateRule ? asNumber(rateRule.percent_rate) : null;
  const benchMultiplier = rateRule ? asNumber(rateRule.benchmark_multiplier) : null;

  const expTotal = expenseInputs ? asNumber(expenseInputs.total_amount) : null;
  const expCcy = expenseInputs ? asString(expenseInputs.currency) : null;
  const expVat = expenseInputs ? asNumber(expenseInputs.vat_amount) : null;

  const eligibleSpend = actualReimb ? asNumber(actualReimb.amount) : null;
  const eligibleCcy = actualReimb ? asString(actualReimb.currency) : null;

  const actualPolicyAmt = actualConv ? asNumber(actualConv.amount) : null;
  const actualPolicyCcy = actualConv ? asString(actualConv.currency) : null;
  const actualFxRate = fxActual ? asNumber(fxActual.rate) : null;
  const actualFxBase = fxActual ? asString(fxActual.base_currency) : null;
  const actualFxQuote = fxActual ? asString(fxActual.quote_currency) : null;
  const actualFxEff = fxActual ? asString(fxActual.effective_date) : null;

  const liters = (() => {
    const vol = asRecord(d.volume);
    return vol ? asNumber(vol.liters) : null;
  })();

  const benchAirfield = benchmark ? asString(benchmark.airfield_code) : null;
  const benchIncludesVat: boolean | null =
    benchmark == null
      ? null
      : benchmark.includes_vat_requested === true
        ? true
        : benchmark.includes_vat_requested === false
          ? false
          : null;
  const benchDerived: boolean | null =
    benchmark == null
      ? null
      : benchmark.derived === true
        ? true
        : benchmark.derived === false
          ? false
          : null;
  const benchPrice = benchmark ? asNumber(benchmark.price_per_unit) : null;
  const benchCcy = benchmark ? asString(benchmark.currency) : null;
  const benchTotalAmt = (() => {
    const bt = benchmark ? asRecord(benchmark.benchmark_total) : null;
    return bt ? asNumber(bt.amount) : null;
  })();

  const benchPolicyAmt = benchConv ? asNumber(benchConv.amount) : null;
  const benchPolicyCcy = benchConv ? asString(benchConv.currency) : null;
  const benchCap = benchmark ? asNumber(benchmark.cap_amount) : null;
  const benchFxRate = fxBench ? asNumber(fxBench.rate) : null;
  const benchFxBase = fxBench ? asString(fxBench.base_currency) : null;
  const benchFxQuote = fxBench ? asString(fxBench.quote_currency) : null;
  const benchFxEff = fxBench ? asString(fxBench.effective_date) : null;

  const capped: boolean | null = calculation
    ? calculation.capped === true
      ? true
      : calculation.capped === false
        ? false
        : null
    : null;

  // ---- Setup grid ----
  const setup: SetupItem[] = [];
  if (humanRule) {
    setup.push({ icon: Scale, label: "Rule", value: humanRule });
  }
  if (reimburseVat === true) {
    setup.push({ icon: Receipt, label: "VAT", value: "Reimbursed" });
  } else if (reimburseVat === false) {
    setup.push({ icon: Receipt, label: "VAT", value: "Excluded" });
  }
  if (policyBase) {
    setup.push({ icon: Coins, label: "Policy currency", value: policyBase });
  }

  // ---- Cards ----
  const cards: BreakdownCard[] = [];
  let stepNumber = 1;

  // Step 1 — Eligible spend
  if (expTotal != null && expCcy) {
    const rows: BreakdownRow[] = [
      { label: "Total paid", value: formatMoney(expTotal, expCcy) },
    ];
    const hasVat = expVat != null && expVat > 0;
    let resultHint: string | undefined;
    if (hasVat) {
      if (reimburseVat === false) {
        rows.push({ label: "VAT", value: formatMoney(expVat, expCcy), op: "−" });
      } else if (reimburseVat === true) {
        resultHint = `Includes reimbursed VAT ${formatMoney(expVat, expCcy)}`;
      } else {
        // Unknown VAT policy — at least surface the VAT figure neutrally.
        rows.push({ label: "VAT", value: formatMoney(expVat, expCcy), hint: "VAT policy unknown" });
      }
    }
    cards.push({
      number: stepNumber++,
      title: "Eligible spend",
      icon: Wallet,
      rows,
      result: {
        label: "Eligible",
        value: formatMoney(eligibleSpend ?? expTotal, eligibleCcy ?? expCcy),
        hint: resultHint,
      },
    });
  }

  // Step 2 — Convert eligible to policy currency (only when there's actually a conversion)
  if (
    actualPolicyAmt != null &&
    actualPolicyCcy &&
    eligibleSpend != null &&
    eligibleCcy &&
    actualPolicyCcy !== eligibleCcy
  ) {
    const rows: BreakdownRow[] = [
      { label: "Eligible spend", value: formatMoney(eligibleSpend, eligibleCcy) },
    ];
    if (actualFxRate != null) {
      rows.push({
        label: "FX rate",
        value: formatNumber(actualFxRate, { maximumFractionDigits: 6 }),
        op: "×",
        hint: fxHint(actualFxBase, actualFxQuote, actualFxEff),
      });
    }
    cards.push({
      number: stepNumber++,
      title: `Convert to ${actualPolicyCcy}`,
      icon: ArrowLeftRight,
      rows,
      result: {
        label: `Eligible (${actualPolicyCcy})`,
        value: formatMoney(actualPolicyAmt, actualPolicyCcy),
      },
    });
  }

  // Benchmark — nested side calculation
  if (benchmark && (benchPolicyAmt != null || benchCap != null) && (benchPolicyCcy || policyBase)) {
    const resolvedPolicyCcy = benchPolicyCcy ?? policyBase ?? "";
    const rows: BreakdownRow[] = [];

    if (benchAirfield) {
      const tags: string[] = [];
      if (benchIncludesVat === true) tags.push("incl. VAT");
      if (benchIncludesVat === false) tags.push("excl. VAT");
      if (benchDerived === true) tags.push("derived");
      rows.push({
        label: "Airfield",
        value: benchAirfield,
        hint: tags.length ? tags.join(" · ") : undefined,
      });
    }
    if (liters != null) {
      rows.push({ label: "Volume", value: `${formatNumber(liters, { maximumFractionDigits: 3 })} L` });
    }
    if (benchPrice != null && benchCcy) {
      rows.push({
        label: "Benchmark price",
        value: `${formatUnitPrice(benchPrice)} ${benchCcy}/L`,
      });
    }
    if (benchTotalAmt != null && benchCcy) {
      rows.push({
        label: "Benchmark subtotal",
        value: formatMoney(benchTotalAmt, benchCcy),
      });
    }
    if (
      benchFxRate != null &&
      benchPolicyAmt != null &&
      benchPolicyCcy &&
      benchCcy &&
      benchPolicyCcy !== benchCcy
    ) {
      rows.push({
        label: "FX rate",
        value: formatNumber(benchFxRate, { maximumFractionDigits: 6 }),
        op: "×",
        hint: fxHint(benchFxBase, benchFxQuote, benchFxEff),
      });
      rows.push({
        label: `Subtotal (${benchPolicyCcy})`,
        value: formatMoney(benchPolicyAmt, benchPolicyCcy),
      });
    }
    if (benchMultiplier != null && benchMultiplier !== 1) {
      rows.push({
        label: "Multiplier",
        value: formatNumber(benchMultiplier, { maximumFractionDigits: 4 }),
        op: "×",
      });
    }

    cards.push({
      nested: true,
      title: "Benchmark cap",
      subtitle: "Side calculation",
      icon: BarChart3,
      rows,
      result: {
        label: "Cap value",
        value: formatMoney(benchCap ?? benchPolicyAmt ?? 0, resolvedPolicyCcy),
      },
    });
  }

  // Final step — apply rule / cap
  const refundCcy =
    refund?.currency ?? actualPolicyCcy ?? benchPolicyCcy ?? policyBase ?? eligibleCcy ?? expCcy ?? "";
  const refundAmt =
    refund?.amount ??
    (calcType === "PERCENT_TOTAL" && actualPolicyAmt != null && percentRate != null
      ? actualPolicyAmt * percentRate
      : benchmark && actualPolicyAmt != null && benchCap != null
        ? Math.min(actualPolicyAmt, benchCap)
        : actualPolicyAmt ?? eligibleSpend ?? 0);

  if (calcType === "PERCENT_TOTAL" && actualPolicyAmt != null && actualPolicyCcy && percentRate != null) {
    cards.push({
      number: stepNumber++,
      title: "Apply percent rate",
      icon: Percent,
      rows: [
        {
          label: `Eligible (${actualPolicyCcy})`,
          value: formatMoney(actualPolicyAmt, actualPolicyCcy),
        },
        {
          label: "Reimbursement rate",
          value: fmtPercent(percentRate),
          op: "×",
          hint: `× ${formatNumber(percentRate, { maximumFractionDigits: 4 })}`,
        },
      ],
      result: { label: "Refund", value: formatMoney(refundAmt, refundCcy) },
    });
  } else if (
    benchmark &&
    actualPolicyAmt != null &&
    actualPolicyCcy &&
    benchCap != null
  ) {
    cards.push({
      number: stepNumber++,
      title: "Take the lower amount",
      icon: Shield,
      rows: [
        { label: `Actuals (${actualPolicyCcy})`, value: formatMoney(actualPolicyAmt, actualPolicyCcy) },
        { label: "Benchmark cap", value: formatMoney(benchCap, actualPolicyCcy) },
      ],
      result: { label: "Refund", value: formatMoney(refundAmt, refundCcy) },
      badge:
        capped === true
          ? { tone: "warning", text: "Capped to benchmark" }
          : capped === false
            ? { tone: "success", text: "Below cap" }
            : undefined,
    });
  } else if (refund) {
    // Fallback so the user always sees the headline figure inside the breakdown.
    cards.push({
      number: stepNumber++,
      title: "Refund",
      icon: Wallet,
      rows: [],
      result: { label: "Refund", value: formatMoney(refund.amount, refund.currency) },
    });
  }

  if (cards.length === 0 && setup.length === 0) return null;

  return { setup, cards };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function RefundBreakdown({
  details,
  refund,
}: {
  details: Record<string, unknown> | null;
  refund?: { amount: number; currency: string };
}) {
  const breakdown = useMemo(() => extractBreakdown(details, refund), [details, refund]);
  if (!breakdown) return null;

  return (
    <div className="space-y-3.5">
      {breakdown.setup.length > 0 ? <SetupGrid items={breakdown.setup} /> : null}

      {breakdown.cards.length > 0 ? (
        <ol className="space-y-0">
          {breakdown.cards.map((card, idx) => {
            const isLast = idx === breakdown.cards.length - 1;
            return (
              <li key={idx} className={cn("relative", card.nested && "pl-5 sm:pl-9")}>
                <CardView card={card} />
                {!isLast ? <Connector indented={card.nested || breakdown.cards[idx + 1]?.nested} /> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function SetupGrid({ items }: { items: SetupItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 rounded-xl bg-surface p-3 ring-1 ring-[color:var(--border)] sm:grid-cols-3 sm:gap-4 sm:p-3.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]"
              aria-hidden="true"
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
                {item.label}
              </div>
              <div className="truncate text-sm font-medium text-fg">{item.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Connector({ indented }: { indented?: boolean }) {
  return (
    <div
      className={cn("flex items-center justify-center py-1", indented && "ml-5 sm:ml-9")}
      aria-hidden="true"
    >
      <div className="h-3 w-px bg-[color:var(--border)]" />
    </div>
  );
}

function CardView({ card }: { card: BreakdownCard }) {
  const Icon = card.icon;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl ring-1",
        card.nested
          ? "bg-surface-muted/60 ring-[color:var(--border)]"
          : "bg-surface ring-[color:var(--border)]",
      )}
    >
      <header className="flex items-center gap-3 px-4 py-2.5">
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
            card.number != null
              ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--accent-soft)]"
              : "bg-surface text-fg-muted ring-[color:var(--border)]",
          )}
          aria-hidden={card.number == null ? "true" : undefined}
        >
          {card.number != null ? (
            <span className="text-[11px] font-semibold tabular-nums">{card.number}</span>
          ) : (
            <Icon size={14} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h4 className="truncate text-sm font-semibold text-fg">{card.title}</h4>
          {card.subtitle ? (
            <span className="hidden text-[10px] uppercase tracking-[0.12em] text-fg-subtle sm:inline">
              {card.subtitle}
            </span>
          ) : null}
          {card.number != null ? (
            <span className="ml-1 hidden items-center text-fg-subtle sm:inline-flex" aria-hidden="true">
              <Icon size={13} />
            </span>
          ) : null}
        </div>
        {card.badge ? <Badge tone={card.badge.tone}>{card.badge.text}</Badge> : null}
      </header>

      {card.rows.length > 0 ? (
        <div className="divide-y divide-[color:var(--border)]/60 border-t border-[color:var(--border)]">
          {card.rows.map((row, idx) => (
            <RowView key={idx} row={row} />
          ))}
        </div>
      ) : null}

      <ResultRow result={card.result} hasRows={card.rows.length > 0} />
    </div>
  );
}

function RowView({ row }: { row: BreakdownRow }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <div className="text-sm text-fg-muted">{row.label}</div>
        {row.hint ? <div className="text-[11px] text-fg-subtle">{row.hint}</div> : null}
      </div>
      <div className="shrink-0 text-sm tabular-nums text-fg">
        {row.op ? <span className="mr-1 text-fg-subtle">{row.op}</span> : null}
        {row.value}
      </div>
    </div>
  );
}

function ResultRow({ result, hasRows }: { result: BreakdownResult; hasRows: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 bg-[color:var(--accent-soft)] px-4 py-2.5",
        hasRows && "border-t border-[color:var(--border)]",
      )}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">
          {result.label}
        </div>
        {result.hint ? <div className="text-[11px] text-fg-subtle">{result.hint}</div> : null}
      </div>
      <div className="shrink-0 text-[15px] font-semibold tabular-nums text-[color:var(--accent)]">
        {result.value}
      </div>
    </div>
  );
}
