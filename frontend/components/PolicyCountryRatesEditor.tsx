"use client";

import { Globe2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableFrame, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/toast";

export type CountryRate = {
  id?: number;
  policy_id?: string;
  country_code: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  calc_type: CalcType;
  percent_rate: number | null;
  benchmark_airfield_code: string | null;
  benchmark_multiplier: number | null;
  reimburse_vat: boolean;
};

export const CALC_TYPES = [
  "PERCENT_TOTAL",
  "ACTUALS_CAPPED_TO_BENCHMARK",
  "ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT",
  "BENCHMARK_EX_VAT",
] as const;

export type CalcType = (typeof CALC_TYPES)[number];

const CALC_TYPE_LABEL: Record<CalcType, string> = {
  PERCENT_TOTAL: "Percent of total",
  ACTUALS_CAPPED_TO_BENCHMARK: "Actuals (capped to benchmark)",
  ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT: "Actuals ex VAT (capped to benchmark)",
  BENCHMARK_EX_VAT: "Benchmark (ex VAT)",
};

const CALC_TYPE_DESCRIPTION: Record<CalcType, string> = {
  PERCENT_TOTAL: "Refund a fixed percent of the total amount paid.",
  ACTUALS_CAPPED_TO_BENCHMARK: "Refund actuals, capped at the benchmark price × volume.",
  ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT: "Same as actuals capped, but using the ex-VAT benchmark.",
  BENCHMARK_EX_VAT: "Refund volume × benchmark (ex VAT) regardless of paid amount.",
};

function isPercentBased(t: CalcType) {
  return t === "PERCENT_TOTAL";
}
function isBenchmarkBased(t: CalcType) {
  return (
    t === "ACTUALS_CAPPED_TO_BENCHMARK" ||
    t === "ACTUALS_CAPPED_TO_BENCHMARK_EX_VAT" ||
    t === "BENCHMARK_EX_VAT"
  );
}

const ROW_CODE = "ROW";

// Curated list of common countries. Users can also pick "Other..." and type any 2-letter code.
const COMMON_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "GB", name: "United Kingdom" },
  { code: "CI", name: "Channel Islands" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "LU", name: "Luxembourg" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "GR", name: "Greece" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
];

const COUNTRY_NAME_BY_CODE: Record<string, string> = COMMON_COUNTRIES.reduce(
  (acc, c) => ({ ...acc, [c.code]: c.name }),
  {} as Record<string, string>,
);

function countryDisplayName(code: string): string {
  if (code === ROW_CODE) return "Rest of world";
  return COUNTRY_NAME_BY_CODE[code] ?? code;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function emptyRate(): CountryRate {
  return {
    country_code: "",
    effective_from: todayIso(),
    effective_to: null,
    calc_type: "PERCENT_TOTAL",
    percent_rate: 0.5,
    benchmark_airfield_code: null,
    benchmark_multiplier: null,
    reimburse_vat: false,
  };
}

/**
 * Group rates by country and pick the latest (max effective_from) per country.
 * The PUT endpoint replaces ALL rates, so we keep older historical rows untouched
 * server-side by re-sending them on save.
 */
function groupLatestByCountry(rates: CountryRate[]) {
  const byCountry = new Map<string, { latest: CountryRate; history: CountryRate[] }>();
  for (const r of rates) {
    const bucket = byCountry.get(r.country_code);
    if (!bucket) {
      byCountry.set(r.country_code, { latest: r, history: [r] });
      continue;
    }
    bucket.history.push(r);
    if (r.effective_from > bucket.latest.effective_from) bucket.latest = r;
  }
  const sorted = Array.from(byCountry.values()).sort((a, b) => {
    // ROW always last; others alphabetical by display name.
    if (a.latest.country_code === ROW_CODE) return 1;
    if (b.latest.country_code === ROW_CODE) return -1;
    return countryDisplayName(a.latest.country_code).localeCompare(
      countryDisplayName(b.latest.country_code),
    );
  });
  return sorted;
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatMultiplier(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `×${value.toString()}`;
}

function payloadForServer(rate: CountryRate) {
  return {
    country_code: rate.country_code.toUpperCase(),
    effective_from: rate.effective_from,
    effective_to: rate.effective_to,
    calc_type: rate.calc_type,
    percent_rate: isPercentBased(rate.calc_type) ? rate.percent_rate : null,
    benchmark_airfield_code: isBenchmarkBased(rate.calc_type)
      ? rate.benchmark_airfield_code
      : null,
    benchmark_multiplier: isBenchmarkBased(rate.calc_type) ? rate.benchmark_multiplier : null,
    reimburse_vat: Boolean(rate.reimburse_vat),
  };
}

export function PolicyCountryRatesEditor({
  aircraftId,
  initialRates,
}: {
  aircraftId: string;
  initialRates: CountryRate[];
}) {
  const router = useRouter();
  const [rates, setRates] = useState<CountryRate[]>(initialRates);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<
    | null
    | {
        mode: "create" | "edit";
        // When editing, we store the country_code we are editing.
        // The form is initialised from the latest row for that country.
        countryCode?: string;
      }
  >(null);

  const grouped = useMemo(() => groupLatestByCountry(rates), [rates]);
  const usedCountries = useMemo(() => new Set(grouped.map((g) => g.latest.country_code)), [grouped]);

  function deleteCountry(code: string) {
    if (!confirm(`Remove the rule for ${countryDisplayName(code)}?`)) return;
    setRates((prev) => prev.filter((r) => r.country_code !== code));
  }

  function applyEdit(updated: CountryRate, originalCountryCode?: string) {
    setRates((prev) => {
      const next = [...prev];
      // If the country code changed during edit, drop the old country's rules.
      if (originalCountryCode && originalCountryCode !== updated.country_code) {
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].country_code === originalCountryCode) next.splice(i, 1);
        }
      }
      // For the target country: keep history rows older than the updated effective_from,
      // drop any row with same effective_from (replace), and insert the updated row.
      const filtered = next.filter(
        (r) =>
          !(r.country_code === updated.country_code && r.effective_from === updated.effective_from),
      );
      filtered.push(updated);
      return filtered;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = rates.map(payloadForServer);
      const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/policy/country-rates`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({ detail: "Save failed" }))) as {
          detail?: unknown;
        };
        const msg = typeof detail.detail === "string" ? detail.detail : "Save failed";
        throw new Error(msg);
      }
      toast.success(
        `Saved ${grouped.length} country rule${grouped.length === 1 ? "" : "s"}`,
      );
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const editingLatest =
    modal?.mode === "edit" && modal.countryCode
      ? grouped.find((g) => g.latest.country_code === modal.countryCode)?.latest ?? null
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          One row per country. Add a <span className="font-medium text-fg">Rest of world</span> rule
          to cover countries without a specific rule.
        </p>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setModal({ mode: "create" })}
        >
          Add country
        </Button>
      </div>

      {grouped.length === 0 ? (
        <TableFrame>
          <EmptyState
            icon={<Globe2 size={20} />}
            title="No country rules yet"
            description="Add at least one country rule (or a 'Rest of world' rule) so refunds can be calculated."
            action={
              <Button
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => setModal({ mode: "create" })}
              >
                Add country
              </Button>
            }
          />
        </TableFrame>
      ) : (
        <TableFrame>
          <Table>
            <THead>
              <TR>
                <TH>Country</TH>
                <TH>Calculation</TH>
                <TH align="right">Rate</TH>
                <TH>Benchmark</TH>
                <TH>VAT</TH>
                <TH>Effective</TH>
                <TH align="right" className="w-32"></TH>
              </TR>
            </THead>
            <TBody>
              {grouped.map(({ latest, history }) => {
                const displayName = countryDisplayName(latest.country_code);
                const isRow = latest.country_code === ROW_CODE;
                return (
                  <TR key={latest.country_code}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {isRow ? (
                          <Badge tone="info" leftIcon={<Globe2 size={11} />}>Rest of world</Badge>
                        ) : (
                          <span className="font-mono text-xs text-fg-muted">{latest.country_code}</span>
                        )}
                        {!isRow ? <span className="font-medium text-fg">{displayName}</span> : null}
                        {history.length > 1 ? (
                          <Badge tone="neutral" size="sm">
                            {history.length} versions
                          </Badge>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="text-fg-muted">{CALC_TYPE_LABEL[latest.calc_type]}</TD>
                    <TD align="right" className="whitespace-nowrap">
                      {isPercentBased(latest.calc_type) ? formatPercent(latest.percent_rate) : "—"}
                    </TD>
                    <TD className="text-fg-muted">
                      {isBenchmarkBased(latest.calc_type) ? (
                        <div className="flex items-center gap-2">
                          {latest.benchmark_airfield_code ? (
                            <span className="font-mono text-xs">{latest.benchmark_airfield_code}</span>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                          {latest.benchmark_multiplier != null ? (
                            <span className="text-xs text-fg-subtle">
                              {formatMultiplier(latest.benchmark_multiplier)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </TD>
                    <TD>
                      {latest.reimburse_vat ? (
                        <Badge tone="success">Reimbursed</Badge>
                      ) : (
                        <Badge tone="neutral">Not reimbursed</Badge>
                      )}
                    </TD>
                    <TD className="text-fg-muted whitespace-nowrap">
                      <div>{latest.effective_from}</div>
                      {latest.effective_to ? (
                        <div className="text-[11px] text-fg-subtle">until {latest.effective_to}</div>
                      ) : null}
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil size={13} />}
                          onClick={() => setModal({ mode: "edit", countryCode: latest.country_code })}
                          aria-label={`Edit ${displayName}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 size={13} />}
                          onClick={() => deleteCountry(latest.country_code)}
                          aria-label={`Remove ${displayName}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableFrame>
      )}

      <div className="flex items-center justify-end">
        <Button variant="primary" leftIcon={<Save size={14} />} onClick={save} loading={saving}>
          {saving ? "Saving" : "Save policy"}
        </Button>
      </div>

      {modal ? (
        <CountryRateModal
          mode={modal.mode}
          existing={modal.mode === "edit" ? editingLatest : null}
          usedCountries={usedCountries}
          onClose={() => setModal(null)}
          onSave={(updated) => {
            applyEdit(updated, modal.mode === "edit" ? modal.countryCode : undefined);
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CountryRateModal({
  mode,
  existing,
  usedCountries,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  existing: CountryRate | null;
  usedCountries: Set<string>;
  onClose: () => void;
  onSave: (rate: CountryRate) => void;
}) {
  const initial = existing ?? emptyRate();

  const isExistingCustom =
    !!existing &&
    existing.country_code !== ROW_CODE &&
    !COMMON_COUNTRIES.some((c) => c.code === existing.country_code);

  const [countryChoice, setCountryChoice] = useState<string>(
    existing
      ? isExistingCustom
        ? "__OTHER__"
        : existing.country_code
      : "",
  );
  const [customCode, setCustomCode] = useState<string>(isExistingCustom ? existing!.country_code : "");
  const [calcType, setCalcType] = useState<CalcType>(initial.calc_type);
  const [percentRate, setPercentRate] = useState<string>(
    initial.percent_rate != null ? String(initial.percent_rate) : "",
  );
  const [benchmarkAirfield, setBenchmarkAirfield] = useState<string>(
    initial.benchmark_airfield_code ?? "",
  );
  const [benchmarkMultiplier, setBenchmarkMultiplier] = useState<string>(
    initial.benchmark_multiplier != null ? String(initial.benchmark_multiplier) : "1",
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(initial.effective_from);
  const [effectiveTo, setEffectiveTo] = useState<string>(initial.effective_to ?? "");
  const [reimburseVat, setReimburseVat] = useState<boolean>(initial.reimburse_vat);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resolveCountryCode(): string {
    if (countryChoice === "__OTHER__") return customCode.trim().toUpperCase();
    return countryChoice;
  }

  function validate(): { ok: true; rate: CountryRate } | { ok: false; errors: Record<string, string> } {
    const next: Record<string, string> = {};
    const code = resolveCountryCode();
    if (!code) next.country = "Pick a country.";
    else if (code !== ROW_CODE && !/^[A-Z]{2}$/.test(code))
      next.country = "Use a 2-letter ISO code (e.g. FR).";
    if (mode === "create" && code && usedCountries.has(code))
      next.country = `${countryDisplayName(code)} already has a rule. Edit it instead.`;
    if (!effectiveFrom) next.effective_from = "Required.";
    if (effectiveTo && effectiveFrom && effectiveTo < effectiveFrom)
      next.effective_to = "Must be after effective from.";

    const rate: CountryRate = {
      country_code: code,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
      calc_type: calcType,
      percent_rate: null,
      benchmark_airfield_code: null,
      benchmark_multiplier: null,
      reimburse_vat: reimburseVat,
    };

    if (isPercentBased(calcType)) {
      const n = Number(percentRate);
      if (!Number.isFinite(n)) next.percent_rate = "Required.";
      else if (n <= 0 || n > 1)
        next.percent_rate = "Use a fraction between 0 and 1 (e.g. 0.5 for 50%).";
      rate.percent_rate = Number.isFinite(n) ? n : null;
    }

    if (isBenchmarkBased(calcType)) {
      const code = benchmarkAirfield.trim().toUpperCase();
      if (!code) next.benchmark_airfield_code = "Required.";
      rate.benchmark_airfield_code = code || null;
      const m = Number(benchmarkMultiplier);
      if (benchmarkMultiplier !== "" && !Number.isFinite(m))
        next.benchmark_multiplier = "Must be a number.";
      else if (Number.isFinite(m) && m <= 0)
        next.benchmark_multiplier = "Must be greater than zero.";
      rate.benchmark_multiplier = Number.isFinite(m) ? m : null;
    }

    if (Object.keys(next).length > 0) return { ok: false, errors: next };
    return { ok: true, rate };
  }

  function submit() {
    const result = validate();
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSave(result.rate);
  }

  const showPercent = isPercentBased(calcType);
  const showBenchmark = isBenchmarkBased(calcType);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={mode === "create" ? "Add country rule" : `Edit ${countryDisplayName(initial.country_code)}`}
      description="Define how refunds are calculated for fuel purchased in this country."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" leftIcon={<Save size={14} />} onClick={submit}>
            {mode === "create" ? "Add" : "Update"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Country" required error={errors.country}>
          {({ id, invalid }) => (
            <Select
              id={id}
              value={countryChoice}
              invalid={invalid}
              onChange={(e) => setCountryChoice(e.target.value)}
            >
              <option value="">Select…</option>
              <option value={ROW_CODE}>Rest of world (fallback)</option>
              <optgroup label="Common">
                {COMMON_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </optgroup>
              <option value="__OTHER__">Other (enter code)…</option>
            </Select>
          )}
        </FormField>

        {countryChoice === "__OTHER__" ? (
          <FormField
            label="Country code"
            required
            helper="2-letter ISO-3166 alpha-2 code, e.g. CZ, NZ."
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                value={customCode}
                invalid={invalid}
                maxLength={2}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="FR"
                autoCapitalize="characters"
                spellCheck={false}
              />
            )}
          </FormField>
        ) : (
          <div /> /* keep grid alignment */
        )}

        <FormField label="Calculation" required>
          {({ id }) => (
            <Select
              id={id}
              value={calcType}
              onChange={(e) => setCalcType(e.target.value as CalcType)}
            >
              {CALC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CALC_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="sm:col-span-2 -mt-1 text-xs text-fg-subtle">
          {CALC_TYPE_DESCRIPTION[calcType]}
        </div>

        {showPercent ? (
          <FormField
            label="Percent rate"
            required
            helper="Fraction between 0 and 1. 0.5 = 50%."
            error={errors.percent_rate}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={percentRate}
                invalid={invalid}
                onChange={(e) => setPercentRate(e.target.value)}
                placeholder="0.5"
              />
            )}
          </FormField>
        ) : null}

        {showBenchmark ? (
          <>
            <FormField
              label="Benchmark airfield"
              required
              helper="ICAO code, e.g. EGLL."
              error={errors.benchmark_airfield_code}
            >
              {({ id, invalid }) => (
                <Input
                  id={id}
                  value={benchmarkAirfield}
                  invalid={invalid}
                  maxLength={8}
                  onChange={(e) => setBenchmarkAirfield(e.target.value.toUpperCase())}
                  placeholder="EGLL"
                  spellCheck={false}
                />
              )}
            </FormField>
            <FormField
              label="Benchmark multiplier"
              helper="Optional, defaults to 1."
              error={errors.benchmark_multiplier}
            >
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="number"
                  step="0.01"
                  min={0}
                  value={benchmarkMultiplier}
                  invalid={invalid}
                  onChange={(e) => setBenchmarkMultiplier(e.target.value)}
                  placeholder="1.0"
                />
              )}
            </FormField>
          </>
        ) : null}

        <FormField label="Effective from" required error={errors.effective_from}>
          {({ id, invalid }) => (
            <Input
              id={id}
              type="date"
              value={effectiveFrom}
              invalid={invalid}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Effective to"
          helper="Leave blank for open-ended."
          error={errors.effective_to}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              type="date"
              value={effectiveTo}
              invalid={invalid}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={reimburseVat}
              onChange={(e) => setReimburseVat(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
            />
            <span>Reimburse VAT on top of the calculated refund.</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
