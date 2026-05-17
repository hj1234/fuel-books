import { BenchmarkPricesClient } from "@/components/BenchmarkPricesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch } from "@/lib/server/fbApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BenchmarkPriceOut = {
  id: string;
  policy_id: string;
  airfield_code: string;
  effective_from: string;
  fuel_type: string;
  price_per_unit: number;
  unit: string;
  currency: string;
  includes_vat: boolean;
  vat_rate: number;
};

type AircraftPolicyCandidate = {
  aircraft_id: string;
  aircraft_registration: string;
  policy_id: string | null;
  base_currency: string | null;
  home_base_airfield: string | null;
};

export default async function BenchmarkPricesPage() {
  const [prices, candidates] = await Promise.all([
    fbFetch<BenchmarkPriceOut[]>("/v1/benchmark-prices", { method: "GET" }),
    fbFetch<AircraftPolicyCandidate[]>("/v1/benchmark-prices/aircraft-candidates", {
      method: "GET",
    }).catch(() => [] as AircraftPolicyCandidate[]),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Fuel prices"
        description="Reference fuel prices used by some calculation types — track them per aircraft and airfield over time."
      />

      <BenchmarkPricesClient prices={prices} candidates={candidates} />
    </div>
  );
}
