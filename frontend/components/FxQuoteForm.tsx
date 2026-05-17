"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { formatNumber } from "@/lib/format";

type FxQuoteOut = {
  effective_date: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  source: string;
  derived: boolean;
  derivation: string;
};

export function FxQuoteForm() {
  const [baseCurrency, setBaseCurrency] = useState("GBP");
  const [quoteCurrency, setQuoteCurrency] = useState("EUR");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<FxQuoteOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const url = `/api/fb/v1/fx-rates/quote?base_currency=${encodeURIComponent(
      baseCurrency,
    )}&quote_currency=${encodeURIComponent(quoteCurrency)}&date=${encodeURIComponent(date)}`;
    const res = await fetch(url, { method: "GET" });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Quote failed");
      return;
    }

    setResult((await res.json()) as FxQuoteOut);
  }

  return (
    <form onSubmit={onSubmit}>
      <Card
        header={
          <div>
            <CardTitle>FX quote</CardTitle>
            <CardDescription>Look up a stored or derived rate for a given pair and date.</CardDescription>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <FormField label="Base">
            {({ id }) => (
              <Input
                id={id}
                className="uppercase"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            )}
          </FormField>
          <FormField label="Quote">
            {({ id }) => (
              <Input
                id={id}
                className="uppercase"
                value={quoteCurrency}
                onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            )}
          </FormField>
          <FormField label="Date">
            {({ id }) => (
              <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            )}
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="primary" loading={loading} fullWidth>
              {loading ? "Quoting" : "Quote"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-xl bg-surface-muted px-4 py-3 ring-1 ring-[color:var(--border)]">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium text-fg">
                {result.base_currency}/{result.quote_currency}
              </div>
              <div className="text-lg font-semibold text-[color:var(--accent)] tabular-nums">
                {formatNumber(result.rate, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span>{result.effective_date}</span>
              <Badge tone="neutral">{result.source}</Badge>
              {result.derived ? <Badge tone="info">derived</Badge> : null}
            </div>
            {result.derived ? (
              <div className="mt-2 text-xs text-fg-muted">{result.derivation}</div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </form>
  );
}
