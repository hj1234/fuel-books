"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BenchmarkPriceCreateForm() {
  const router = useRouter();
  const [policyId, setPolicyId] = useState("");
  const [airfieldCode, setAirfieldCode] = useState("EGLL");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [fuelType, setFuelType] = useState("AVGAS");
  const [pricePerUnit, setPricePerUnit] = useState("0");
  const [unit, setUnit] = useState("L");
  const [currency, setCurrency] = useState("GBP");
  const [includesVat, setIncludesVat] = useState(true);
  const [vatRate, setVatRate] = useState("0.2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/fb/v1/benchmark-prices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy_id: policyId,
        airfield_code: airfieldCode,
        effective_from: effectiveFrom,
        fuel_type: fuelType,
        price_per_unit: Number(pricePerUnit),
        unit,
        currency,
        includes_vat: includesVat,
        vat_rate: Number(vatRate),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Create failed");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm font-medium">Add fuel price</div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <div className="text-zinc-700">Policy ID (UUID)</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10" value={policyId} onChange={(e) => setPolicyId(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Airfield</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-zinc-900/10" value={airfieldCode} onChange={(e) => setAirfieldCode(e.target.value.toUpperCase())} />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Effective from</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Fuel type</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-zinc-900/10" value={fuelType} onChange={(e) => setFuelType(e.target.value.toUpperCase())} />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Price / unit</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} inputMode="decimal" />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Currency</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-zinc-900/10" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Includes VAT</div>
          <div className="mt-1 flex items-center gap-2">
            <input type="checkbox" checked={includesVat} onChange={(e) => setIncludesVat(e.target.checked)} />
            <span className="text-xs text-zinc-600">Price includes VAT</span>
          </div>
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">VAT rate</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10" value={vatRate} onChange={(e) => setVatRate(e.target.value)} inputMode="decimal" />
        </label>
        <label className="text-sm">
          <div className="text-zinc-700">Unit</div>
          <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-zinc-900/10" value={unit} onChange={(e) => setUnit(e.target.value.toUpperCase())} maxLength={3} />
        </label>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="mt-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

