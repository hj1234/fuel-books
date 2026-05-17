"use client";

import { Coins, Download, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PolicyCountryRatesEditor, type CalcType, type CountryRate } from "@/components/PolicyCountryRatesEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardSection, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/toast";

type FuelPolicyOut = { id: string; aircraft_id: string; base_currency: string };
type CountryRateOut = {
  id: number;
  policy_id: string;
  country_code: string;
  effective_from: string;
  effective_to: string | null;
  calc_type: string;
  percent_rate: number | null;
  benchmark_airfield_code: string | null;
  benchmark_multiplier: number | null;
  reimburse_vat: boolean;
};

type PolicyImportCandidate = {
  aircraft_id: string;
  aircraft_registration: string;
  policy_id: string;
  base_currency: string;
};

function toEditorRate(r: CountryRateOut): CountryRate {
  return {
    id: r.id,
    policy_id: r.policy_id,
    country_code: r.country_code,
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    calc_type: r.calc_type as CalcType,
    percent_rate: r.percent_rate,
    benchmark_airfield_code: r.benchmark_airfield_code,
    benchmark_multiplier: r.benchmark_multiplier,
    reimburse_vat: r.reimburse_vat,
  };
}

export function PolicyEditor({
  aircraftId,
  policy,
  countryRates,
}: {
  aircraftId: string;
  policy: FuelPolicyOut;
  countryRates: CountryRateOut[];
}) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PolicyImportCandidate[]>([]);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>("");

  const initialRates = useMemo(() => countryRates.map(toEditorRate), [countryRates]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/fb/v1/policy/import-candidates", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json().catch(() => [])) as PolicyImportCandidate[];
      if (cancelled) return;
      setCandidates(Array.isArray(json) ? json : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const importCandidates = useMemo(
    () => candidates.filter((c) => c.aircraft_id !== aircraftId),
    [aircraftId, candidates],
  );

  async function importPolicy() {
    if (!selectedAircraftId) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/policy/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_aircraft_id: selectedAircraftId }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ detail: "Import failed" }))) as {
          detail?: unknown;
        };
        const msg = typeof detail.detail === "string" ? detail.detail : "Import failed";
        throw new Error(msg);
      }
      toast.success("Policy imported");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card padded={false}>
      <CardSection>
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]">
            <Coins size={16} aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Base policy</CardTitle>
            <p className="mt-1 text-sm text-fg-muted">
              Base currency:{" "}
              <span className="font-medium text-fg">{policy.base_currency}</span>{" "}
              <span className="text-fg-subtle">· can&apos;t be changed here.</span>
            </p>
          </div>
        </div>
      </CardSection>

      <CardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]">
              <ScrollText size={16} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Country rates</CardTitle>
              <p className="mt-1 text-sm text-fg-muted">
                Add a rule per country. Use <span className="font-medium text-fg">Rest of world</span>{" "}
                as a fallback for any country not listed.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PolicyCountryRatesEditor aircraftId={aircraftId} initialRates={initialRates} />
        </div>
      </CardSection>

      <CardSection>
        <div className="flex items-start gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]">
            <Download size={16} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle>Import policy</CardTitle>
            <p className="mt-1 text-sm text-fg-muted">
              Copy a policy from another aircraft you manage. This switches which policy this aircraft uses.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label="From aircraft" className="flex-1">
                {({ id }) => (
                  <Select
                    id={id}
                    value={selectedAircraftId}
                    onChange={(e) => setSelectedAircraftId(e.target.value)}
                    disabled={importCandidates.length === 0}
                  >
                    <option value="">
                      {importCandidates.length === 0 ? "No other policies found" : "Select…"}
                    </option>
                    {importCandidates.map((c) => (
                      <option key={c.aircraft_id} value={c.aircraft_id}>
                        {c.aircraft_registration} ({c.base_currency})
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <Button
                variant="secondary"
                onClick={importPolicy}
                disabled={!selectedAircraftId}
                loading={importing}
              >
                Import
              </Button>
            </div>
          </div>
        </div>
      </CardSection>

      {importError ? (
        <CardSection>
          <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
            {importError}
          </div>
        </CardSection>
      ) : null}
    </Card>
  );
}
