import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { PolicyEmptyState } from "@/components/PolicyEmptyState";
import { PolicyEditor } from "@/components/PolicyEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

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

export const dynamic = "force-dynamic";

export default async function PolicyPage({ params }: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await params;
  let policy: FuelPolicyOut | null = null;
  let countryRates: CountryRateOut[] = [];

  try {
    [policy, countryRates] = await Promise.all([
      fbFetch<FuelPolicyOut>(`/v1/aircraft/${aircraftId}/policy`, { method: "GET" }),
      fbFetch<CountryRateOut[]>(`/v1/aircraft/${aircraftId}/policy/country-rates`, { method: "GET" }),
    ]);
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status !== 404) throw e;
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Aircraft"
        title="Policy"
        description="Refund policy configuration for this aircraft."
        actions={
          <Link
            href={`/aircraft/${aircraftId}`}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)] hover:bg-surface-muted hover:text-fg"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </Link>
        }
      />

      {policy ? (
        <PolicyEditor aircraftId={aircraftId} policy={policy} countryRates={countryRates} />
      ) : (
        <PolicyEmptyState aircraftId={aircraftId} />
      )}
    </div>
  );
}
