"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/toast";

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

export type AircraftPolicyCandidate = {
  aircraft_id: string;
  aircraft_registration: string;
  policy_id: string | null;
  base_currency: string | null;
  home_base_airfield: string | null;
};

function defaultEffectiveFrom() {
  return new Date().toISOString().slice(0, 10);
}

export function BenchmarkPriceForm({
  mode,
  existing,
  candidates,
  defaultAircraftId,
  onDone,
  onCancel,
  onDelete,
}: {
  mode: "create" | "edit";
  existing?: BenchmarkPriceOut | null;
  candidates: AircraftPolicyCandidate[];
  defaultAircraftId?: string;
  onDone: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const airfieldSuggestionsId = useId();

  const candidateByAircraft = useMemo(() => {
    const m = new Map<string, AircraftPolicyCandidate>();
    for (const c of candidates) m.set(c.aircraft_id, c);
    return m;
  }, [candidates]);

  const candidateByPolicy = useMemo(() => {
    const m = new Map<string, AircraftPolicyCandidate>();
    for (const c of candidates) {
      if (c.policy_id != null) m.set(c.policy_id, c);
    }
    return m;
  }, [candidates]);

  const suggestedAirfields = useMemo(() => {
    const seen = new Set<string>();
    for (const c of candidates) {
      const code = c.home_base_airfield?.trim().toUpperCase();
      if (code) seen.add(code);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const initial = useMemo(() => {
    if (mode === "edit" && existing) {
      const c = candidateByPolicy.get(existing.policy_id);
      return {
        aircraftId: c ? c.aircraft_id : "",
        policyId: existing.policy_id,
        airfieldCode: existing.airfield_code,
        effectiveFrom: existing.effective_from,
        fuelType: existing.fuel_type,
        pricePerUnit: String(existing.price_per_unit),
        unit: existing.unit,
        currency: existing.currency,
        includesVat: existing.includes_vat,
        vatRate: String(existing.vat_rate),
      };
    }

    function resolvePreferred(): AircraftPolicyCandidate | null {
      if (defaultAircraftId != null) {
        const pick = candidateByAircraft.get(defaultAircraftId);
        if (pick) return pick;
      }
      const withPolicy = candidates.find((c) => c.policy_id != null);
      return withPolicy ?? candidates[0] ?? null;
    }

    const preferred = resolvePreferred();

    return {
      aircraftId: preferred ? preferred.aircraft_id : "",
      policyId: preferred?.policy_id ?? "",
      airfieldCode: preferred?.home_base_airfield?.toUpperCase() ?? "",
      effectiveFrom: defaultEffectiveFrom(),
      fuelType: "AVGAS",
      pricePerUnit: "0",
      unit: "L",
      currency: preferred?.base_currency ?? "GBP",
      includesVat: true,
      vatRate: "0.2",
    };
  }, [mode, existing, candidates, candidateByPolicy, candidateByAircraft, defaultAircraftId]);

  const [aircraftId, setAircraftId] = useState(initial.aircraftId);
  const [policyId, setPolicyId] = useState(initial.policyId);
  const [airfieldCode, setAirfieldCode] = useState(initial.airfieldCode);
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom);
  const [fuelType, setFuelType] = useState(initial.fuelType);
  const [pricePerUnit, setPricePerUnit] = useState(initial.pricePerUnit);
  const [unit, setUnit] = useState(initial.unit);
  const [currency, setCurrency] = useState(initial.currency);
  const [includesVat, setIncludesVat] = useState(initial.includesVat);
  const [vatRate, setVatRate] = useState(initial.vatRate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAircraftId(initial.aircraftId);
    setPolicyId(initial.policyId);
    setAirfieldCode(initial.airfieldCode);
    setEffectiveFrom(initial.effectiveFrom);
    setFuelType(initial.fuelType);
    setPricePerUnit(initial.pricePerUnit);
    setUnit(initial.unit);
    setCurrency(initial.currency);
    setIncludesVat(initial.includesVat);
    setVatRate(initial.vatRate);
    setError(null);
    setLoading(false);
  }, [initial]);

  const selectedCandidate =
    aircraftId === "" ? null : candidateByAircraft.get(aircraftId) ?? null;
  const aircraftMissingPolicy = selectedCandidate != null && selectedCandidate.policy_id == null;

  function onAircraftChange(nextAircraftId: string) {
    const next = candidateByAircraft.get(nextAircraftId);
    setAircraftId(nextAircraftId);
    if (!next) {
      setPolicyId("");
      return;
    }
    setPolicyId(next.policy_id ?? "");

    const prev =
      aircraftId === "" ? null : candidateByAircraft.get(aircraftId) ?? null;
    const prevHome = prev?.home_base_airfield ?? "";
    const upper = airfieldCode.toUpperCase();
    const looksLikePrevHome = upper === "" || upper === prevHome.toUpperCase();
    if (looksLikePrevHome && next.home_base_airfield) {
      setAirfieldCode(next.home_base_airfield.toUpperCase());
    }

    if (mode === "create") {
      setCurrency((prevCcy) =>
        next.base_currency != null &&
        (prevCcy === "" || prevCcy === (prev?.base_currency ?? "") || prev?.policy_id == null)
          ? next.base_currency
          : prevCcy,
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!policyId) {
      setLoading(false);
      setError("Choose an aircraft that has a fuel policy linked (open Policy on that aircraft first).");
      return;
    }

    const payload = {
      policy_id: policyId,
      airfield_code: airfieldCode,
      effective_from: effectiveFrom,
      fuel_type: fuelType,
      price_per_unit: Number(pricePerUnit),
      unit,
      currency,
      includes_vat: includesVat,
      vat_rate: Number(vatRate),
    };

    const url =
      mode === "edit" && existing?.id != null
        ? `/api/fb/v1/benchmark-prices/${existing.id}`
        : "/api/fb/v1/benchmark-prices";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.detail?.detail ?? body?.detail ?? (mode === "edit" ? "Update failed" : "Create failed"),
      );
      return;
    }

    toast.success(mode === "edit" ? "Fuel price updated" : "Fuel price added");
    onDone();
  }

  const noCandidates = candidates.length === 0;
  const editingUnknownPolicy = mode === "edit" && existing != null && !candidateByPolicy.has(existing.policy_id);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <datalist id={airfieldSuggestionsId}>
        {suggestedAirfields.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField
          label="Aircraft"
          required
          helper={
            editingUnknownPolicy
              ? "This price is on a policy you no longer admin."
              : "Lists every aircraft you administer. Fuel policy must be linked to save."
          }
        >
          {({ id }) => (
            <Select
              id={id}
              value={aircraftId}
              onChange={(e) => onAircraftChange(e.target.value)}
              disabled={noCandidates || editingUnknownPolicy}
            >
              {noCandidates ? (
                <option value="">No aircraft available</option>
              ) : (
                <>
                  {aircraftId === "" ? <option value="">Select aircraft…</option> : null}
                  {candidates.map((c) => (
                    <option key={c.aircraft_id} value={c.aircraft_id}>
                      {c.aircraft_registration}
                      {c.home_base_airfield ? ` · ${c.home_base_airfield}` : ""}
                      {c.policy_id == null ? " (no fuel policy)" : ""}
                    </option>
                  ))}
                </>
              )}
            </Select>
          )}
        </FormField>
        <FormField
          label="Airfield"
          helper="Suggestions from your fleet's home bases; type any ICAO-style code."
        >
          {({ id }) => (
            <Input
              id={id}
              className="uppercase"
              list={airfieldSuggestionsId}
              value={airfieldCode}
              onChange={(e) => setAirfieldCode(e.target.value.toUpperCase())}
              maxLength={8}
              required
            />
          )}
        </FormField>
        <FormField label="Effective from">
          {({ id }) => (
            <Input
              id={id}
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Fuel type">
          {({ id }) => (
            <Input
              id={id}
              className="uppercase"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value.toUpperCase())}
            />
          )}
        </FormField>
        <FormField label="Price / unit">
          {({ id }) => (
            <Input
              id={id}
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              inputMode="decimal"
            />
          )}
        </FormField>
        <FormField label="Currency">
          {({ id }) => (
            <Input
              id={id}
              className="uppercase"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
            />
          )}
        </FormField>
        <FormField label="Unit">
          {({ id }) => (
            <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value.toUpperCase())}>
              <option value="L">Litres</option>
              <option value="GAL">US Gallons</option>
            </Select>
          )}
        </FormField>
        <FormField label="VAT rate" helper="As a decimal, e.g. 0.2 for 20%.">
          {({ id }) => (
            <Input
              id={id}
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              inputMode="decimal"
            />
          )}
        </FormField>
        <FormField label="VAT inclusion">
          {({ id }) => (
            <label
              htmlFor={id}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--border)] bg-surface px-3 text-sm text-fg"
            >
              <input
                id={id}
                type="checkbox"
                checked={includesVat}
                onChange={(e) => setIncludesVat(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--accent)]"
              />
              <span>Price includes VAT</span>
            </label>
          )}
        </FormField>
      </div>

      {aircraftMissingPolicy ? (
        <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
          This aircraft has no fuel policy linked yet. Open its{" "}
          <span className="font-medium text-fg">Policy</span> page (create or import a policy), then add fuel
          prices.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {mode === "edit" && onDelete ? (
          <Button
            type="button"
            variant="danger"
            leftIcon={<Trash2 size={14} />}
            onClick={onDelete}
            disabled={loading}
            className="sm:mr-auto"
          >
            Delete
          </Button>
        ) : null}
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={noCandidates || aircraftMissingPolicy || editingUnknownPolicy}
          >
            {loading
              ? mode === "edit"
                ? "Saving"
                : "Adding"
              : mode === "edit"
                ? "Save changes"
                : "Add price"}
          </Button>
        </div>
      </div>
    </form>
  );
}
