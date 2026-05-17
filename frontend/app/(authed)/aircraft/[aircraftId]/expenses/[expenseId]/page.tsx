import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RefundBreakdown } from "@/components/RefundBreakdown";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, formatMoney } from "@/lib/format";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

type PilotOut = { id: string; aircraft_id: string; name: string; email: string | null };

type FuelExpenseCalculationOut = {
  id: number;
  created_at: string;
  effective_date: string;
  refund_amount: number;
  refund_currency: string;
  derivation: string;
  explanation: string;
  details: Record<string, unknown> | null;
};

type FuelExpenseOut = {
  id: string;
  aircraft_id: string;
  pilot_id: string | null;
  purchased_at: string;
  country_code: string;
  airfield_code: string | null;
  vendor: string | null;
  volume: number;
  unit: string;
  total_amount: number;
  currency: string;
  vat_amount: number | null;
  notes: string | null;
  latest_calculation: FuelExpenseCalculationOut | null;
};

export const dynamic = "force-dynamic";

export default async function ExpenseCalculationPage({
  params,
}: {
  params: Promise<{ aircraftId: string; expenseId: string }>;
}) {
  const { aircraftId, expenseId } = await params;

  let expense: FuelExpenseOut;
  try {
    expense = await fbFetch<FuelExpenseOut>(`/v1/fuel-expenses/${expenseId}`, { method: "GET" });
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status === 404) notFound();
    throw e;
  }

  if (expense.aircraft_id !== aircraftId) {
    notFound();
  }

  const pilots = await fbFetch<PilotOut[]>(`/v1/aircraft/${aircraftId}/pilots`, { method: "GET" });
  const pilot = expense.pilot_id ? pilots.find((p) => p.id === expense.pilot_id) ?? null : null;

  const calc = expense.latest_calculation;
  const details = calc?.details ?? null;
  const legacyNoSnapshot = calc != null && details == null;

  const backLink = (
    <Link
      href={`/aircraft/${aircraftId}/expenses`}
      className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)] hover:bg-surface-muted hover:text-fg"
    >
      <ChevronLeft size={14} aria-hidden="true" />
      Back
    </Link>
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Fuel expenses"
        title="How this refund was calculated"
        description="Figures and steps are frozen from when the calculation was saved. Policy rules, FX, and benchmarks may have changed since."
        actions={backLink}
      />

      <Card>
        <CardTitle className="text-base">{formatDate(expense.purchased_at)}</CardTitle>
        <CardDescription className="mt-1 space-y-1">
          <div>
            {pilot ? (
              <span className="font-medium text-fg">{pilot.name}</span>
            ) : (
              <span className="text-fg-subtle">No pilot</span>
            )}
            <span className="text-fg-subtle"> · </span>
            <span className="text-fg-muted">
              {expense.country_code}
              {expense.airfield_code ? ` · ${expense.airfield_code}` : ""}
            </span>
          </div>
          <div className="text-fg">
            {formatMoney(expense.total_amount, expense.currency)}
            {expense.vat_amount != null ? (
              <span className="text-fg-muted">
                {" "}
                (VAT {formatMoney(expense.vat_amount, expense.currency)})
              </span>
            ) : null}
            <span className="text-fg-muted">
              {" "}
              · {expense.volume} {expense.unit}
            </span>
          </div>
        </CardDescription>
      </Card>

      {calc ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-muted/80 px-4 py-3 ring-1 ring-[color:var(--border)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              Refund (saved)
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-[color:var(--accent)]">
              {formatMoney(calc.refund_amount, calc.refund_currency)}
            </div>
            <p className="mt-2 text-sm text-fg-muted">{calc.explanation}</p>
            <p className="mt-1 font-mono text-[11px] text-fg-subtle">{calc.derivation}</p>
          </div>

          {legacyNoSnapshot ? (
            <p className="text-sm text-fg-muted">
              A step-by-step breakdown was not stored for this calculation (it was created before snapshots were
              saved). Create a new calculation by editing and saving the expense to capture a breakdown going forward.
            </p>
          ) : null}

          <RefundBreakdown
            details={details}
            refund={{ amount: calc.refund_amount, currency: calc.refund_currency }}
          />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">No calculation has been saved for this expense yet.</p>
      )}
    </div>
  );
}
