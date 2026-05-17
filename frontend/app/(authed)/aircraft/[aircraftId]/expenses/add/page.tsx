import { ChevronLeft, ScrollText } from "lucide-react";
import Link from "next/link";

import { ExpenseCreateFlow } from "@/components/ExpenseCreateFlow";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

type PilotOut = { id: string; aircraft_id: string; name: string; email: string | null };
type FuelPolicyOut = { id: string; aircraft_id: string; base_currency: string };
type CountryRateOut = { country_code: string };

export const dynamic = "force-dynamic";

export default async function ExpenseAddPage({ params }: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await params;

  const backLink = (
    <Link
      href={`/aircraft/${aircraftId}/expenses`}
      className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)] hover:bg-surface-muted hover:text-fg"
    >
      <ChevronLeft size={14} aria-hidden="true" />
      Back
    </Link>
  );

  let policy: FuelPolicyOut;
  try {
    policy = await fbFetch<FuelPolicyOut>(`/v1/aircraft/${aircraftId}/policy`, { method: "GET" });
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status !== 404) throw e;
    return (
      <div className="space-y-7">
        <PageHeader
          eyebrow="Fuel expenses"
          title="Add expense"
          description="Creates an expense and calculates the refund."
          actions={backLink}
        />

        <Card variant="muted">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface ring-1 ring-[color:var(--border)] text-fg-muted">
              <ScrollText size={16} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Fuel policy required</CardTitle>
              <CardDescription>
                You need to create a fuel policy for this aircraft before you can add expenses.{" "}
                <Link
                  className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]"
                  href={`/aircraft/${aircraftId}/policy`}
                >
                  Go to policy
                </Link>
                .
              </CardDescription>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const [pilots, countryRates, currencies] = await Promise.all([
    fbFetch<PilotOut[]>(`/v1/aircraft/${aircraftId}/pilots`, { method: "GET" }),
    fbFetch<CountryRateOut[]>(`/v1/aircraft/${aircraftId}/policy/country-rates`, { method: "GET" }),
    fbFetch<string[]>(`/v1/fx-rates/currencies`, { method: "GET" }),
  ]);

  const countries = Array.from(
    new Set(
      (countryRates ?? [])
        .map((r) => r.country_code?.toUpperCase?.() ?? "")
        .filter((c) => typeof c === "string" && c.length >= 2),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Fuel expenses"
        title="Add expense"
        description="Creates an expense and calculates the refund against your policy."
        actions={backLink}
      />

      <ExpenseCreateFlow
        aircraftId={aircraftId}
        pilots={pilots.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        countries={countries}
        currencies={(currencies ?? []).map((c) => c.toUpperCase()).sort((a, b) => a.localeCompare(b))}
        policyBaseCurrency={policy.base_currency?.toUpperCase?.() ?? "GBP"}
      />
    </div>
  );
}
