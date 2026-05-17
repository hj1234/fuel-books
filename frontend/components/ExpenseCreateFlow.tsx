"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  DEFAULT_EXPENSE_DRAFT,
  ExpenseCreateForm,
  extractFieldErrors,
  formatApiErrorDetail,
  type ExpenseDraft,
  type FieldKey,
} from "@/components/ExpenseCreateForm";
import { RefundBreakdown } from "@/components/RefundBreakdown";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type PilotOption = { id: string; name: string; email: string | null };

type FuelExpenseRefundPreviewOut = {
  effective_date: string;
  refund_amount: number;
  refund_currency: string;
  derivation: string;
  explanation: string;
  details: Record<string, unknown> | null;
};

function validateDraft(d: ExpenseDraft): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};

  if (!d.pilotId) out.pilotId = "Pilot is required.";

  if (!d.volume.trim()) out.volume = "Volume is required.";
  else if (!(Number(d.volume) > 0)) out.volume = "Volume must be greater than 0.";

  if (!d.totalAmount.trim()) out.totalAmount = "Total amount is required.";
  else if (!(Number(d.totalAmount) > 0)) out.totalAmount = "Total amount must be greater than 0.";

  if (!d.currency.trim()) out.currency = "Currency is required.";
  if (!d.countryCode.trim()) out.countryCode = "Country is required.";
  if (!d.purchasedDate.trim()) out.purchasedDate = "Purchased date is required.";

  return out;
}

function buildPayload(d: ExpenseDraft) {
  return {
    purchased_at: new Date(`${d.purchasedDate}T00:00:00`).toISOString(),
    country_code: d.countryCode,
    airfield_code: d.airfieldCode || null,
    vendor: d.vendor || null,
    volume: Number(d.volume),
    unit: d.unit,
    total_amount: Number(d.totalAmount),
    currency: d.currency,
    vat_amount: d.vatAmount ? Number(d.vatAmount) : null,
    notes: d.notes || null,
    pilot_id: d.pilotId,
  };
}

export function ExpenseCreateFlow({
  aircraftId,
  pilots,
  countries,
  currencies,
  policyBaseCurrency,
}: {
  aircraftId: string;
  pilots: PilotOption[];
  countries: string[];
  currencies: string[];
  policyBaseCurrency: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ExpenseDraft>(() => {
    const countryCode = countries.includes("GB") ? "GB" : countries[0] ?? "GB";
    let currency = DEFAULT_EXPENSE_DRAFT.currency;
    if (currencies.length > 0) {
      const base = policyBaseCurrency.trim().toUpperCase();
      if (base && currencies.includes(base)) currency = base;
      else if (currencies.includes("GBP")) currency = "GBP";
      else currency = currencies[0]!;
    }
    return {
      ...DEFAULT_EXPENSE_DRAFT,
      countryCode,
      currency,
    };
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FuelExpenseRefundPreviewOut | null>(null);

  const pilotNameById = useMemo(() => new Map(pilots.map((p) => [p.id, p.name])), [pilots]);

  function onChange<K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function calculate() {
    setError(null);
    setFieldErrors({});
    setPreview(null);

    const local = validateDraft(draft);
    if (Object.keys(local).length) {
      setFieldErrors(local);
      setError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/fuel-expenses/calculate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload(draft)),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = body?.detail?.detail ?? body?.detail ?? body;
      setFieldErrors(extractFieldErrors(detail));
      setError(formatApiErrorDetail(detail));
      return;
    }

    const json = (await res.json().catch(() => null)) as FuelExpenseRefundPreviewOut | null;
    if (!json) {
      setError("Calculate failed");
      return;
    }
    setPreview(json);
  }

  async function saveExpense() {
    if (!preview) return;
    setError(null);
    setFieldErrors({});

    setLoading(true);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/fuel-expenses/calculate-and-create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload(draft)),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = body?.detail?.detail ?? body?.detail ?? body;
      setFieldErrors(extractFieldErrors(detail));
      setError(formatApiErrorDetail(detail));
      return;
    }

    router.push(`/aircraft/${aircraftId}/expenses?created=1`);
    router.refresh();
  }

  if (!preview) {
    return (
      <ExpenseCreateForm
        aircraftId={aircraftId}
        pilots={pilots}
        countries={countries}
        currencies={currencies}
        value={draft}
        onChange={onChange}
        onSubmit={calculate}
        loading={loading}
        error={error}
        fieldErrors={fieldErrors}
        submitLabel="Calculate"
      />
    );
  }

  const summaryItems: Array<{ label: string; value: string }> = [
    { label: "Purchased date", value: new Intl.DateTimeFormat("en-GB").format(new Date(draft.purchasedDate)) },
    { label: "Pilot", value: pilotNameById.get(draft.pilotId) ?? "—" },
    { label: "Country", value: draft.countryCode },
    { label: "Airfield", value: draft.airfieldCode || "—" },
    { label: "Volume", value: `${draft.volume} ${draft.unit}` },
    { label: "Total", value: `${draft.totalAmount} ${draft.currency}` },
  ];

  return (
    <div className="space-y-5">
      <Card variant="muted">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Summary</div>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summaryItems.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-fg-subtle">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-fg">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-fg-subtle">Refund</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--accent)] tabular-nums">
          {preview.refund_amount.toFixed(2)} {preview.refund_currency}
        </div>
        <p className="mt-2 text-sm text-fg-muted">{preview.explanation}</p>

        {preview.details ? (
          <details className="group mt-4 rounded-xl bg-surface-muted/60 ring-1 ring-[color:var(--border)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-fg select-none">
              <span>How this refund was calculated</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg-muted transition-transform duration-150 group-open:rotate-180"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="border-t border-[color:var(--border)] p-3 sm:p-4">
              <RefundBreakdown
                details={preview.details}
                refund={{ amount: preview.refund_amount, currency: preview.refund_currency }}
              />
            </div>
          </details>
        ) : null}
      </Card>

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setPreview(null)} disabled={loading}>
          Back
        </Button>
        <Button variant="primary" onClick={saveExpense} loading={loading}>
          {loading ? "Saving" : "Save expense"}
        </Button>
      </div>
    </div>
  );
}

