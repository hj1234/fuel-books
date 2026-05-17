import { Plus, Receipt, SearchX } from "lucide-react";
import Link from "next/link";

import { ExpenseCreatedToast } from "@/components/ExpenseCreatedToast";
import { ExpenseDeleteButton } from "@/components/ExpenseDeleteButton";
import { ExpensesFilters } from "@/components/ExpensesFilters";
import { ExpensesPagination } from "@/components/ExpensesPagination";
import { ExpensesSortableHeader } from "@/components/ExpensesSortableHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableFrame, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { buildBackendQueryString, parseExpensesQuery } from "@/lib/expensesQuery";
import { formatDate, formatMoney } from "@/lib/format";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

type PilotOut = { id: string; aircraft_id: string; name: string; email: string | null };
type FuelPolicyOut = { id: string; aircraft_id: string; base_currency: string };

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

type FuelExpenseListOut = {
  items: FuelExpenseOut[];
  total: number;
  limit: number;
  offset: number;
};

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ aircraftId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { aircraftId } = await params;
  const sp = await searchParams;
  const query = parseExpensesQuery(sp);

  const backendQs = buildBackendQueryString(query);

  const [data, pilots] = await Promise.all([
    fbFetch<FuelExpenseListOut>(
      `/v1/aircraft/${aircraftId}/fuel-expenses?${backendQs}`,
      { method: "GET" },
    ),
    fbFetch<PilotOut[]>(`/v1/aircraft/${aircraftId}/pilots`, { method: "GET" }),
  ]);

  let hasPolicy = true;
  try {
    await fbFetch<FuelPolicyOut>(`/v1/aircraft/${aircraftId}/policy`, { method: "GET" });
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status === 404) hasPolicy = false;
    else throw e;
  }

  const pilotById = new Map(pilots.map((p) => [p.id, p]));
  const expenses = data.items;
  const filtersActive =
    query.pilot != null || query.from != null || query.to != null;

  return (
    <div className="space-y-7">
      <ExpenseCreatedToast />
      <PageHeader
        eyebrow="Aircraft"
        title="Fuel expenses"
        description="Create and recalculate refund calculations against this aircraft's policy."
        actions={
          hasPolicy ? (
            <Link
              href={`/aircraft/${aircraftId}/expenses/add`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-3.5 text-sm font-medium text-primary-fg shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--primary-hover)]"
            >
              <Plus size={15} aria-hidden="true" />
              Add expense
            </Link>
          ) : (
            <span className="text-sm text-fg-muted">
              Add expenses after creating a{" "}
              <Link
                className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]"
                href={`/aircraft/${aircraftId}/policy`}
              >
                fuel policy
              </Link>
              .
            </span>
          )
        }
      />

      <ExpensesFilters pilots={pilots.map((p) => ({ id: p.id, name: p.name }))} />

      {expenses.length === 0 ? (
        <TableFrame>
          <EmptyState
            icon={filtersActive ? <SearchX size={20} /> : <Receipt size={20} />}
            title={filtersActive ? "No expenses match your filters" : "No expenses yet"}
            description={
              filtersActive
                ? "Try a wider period (e.g. All time) or clear the pilot filter."
                : hasPolicy
                  ? "Add a fuel expense to calculate the refund against your policy."
                  : "Create a fuel policy first, then start adding expenses."
            }
            action={
              !filtersActive && hasPolicy ? (
                <Link
                  href={`/aircraft/${aircraftId}/expenses/add`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 text-sm font-medium text-primary-fg shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--primary-hover)]"
                >
                  <Plus size={15} aria-hidden="true" />
                  Add expense
                </Link>
              ) : null
            }
          />
        </TableFrame>
      ) : (
        <div className="space-y-3">
          <TableFrame>
            <Table>
              <THead>
                <TR>
                  <ExpensesSortableHeader column="purchased_at">Purchased</ExpensesSortableHeader>
                  <ExpensesSortableHeader column="pilot_name">Pilot</ExpensesSortableHeader>
                  <ExpensesSortableHeader column="country_code">Location</ExpensesSortableHeader>
                  <ExpensesSortableHeader column="volume" align="right">
                    Volume
                  </ExpensesSortableHeader>
                  <ExpensesSortableHeader column="total_amount" align="right">
                    Total
                  </ExpensesSortableHeader>
                  <TH align="right">Refund</TH>
                  <TH align="right" className="w-12"></TH>
                </TR>
              </THead>
              <TBody>
                {expenses.map((e) => {
                  const pilot = e.pilot_id ? pilotById.get(e.pilot_id) ?? null : null;
                  return (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap text-fg-muted">{formatDate(e.purchased_at)}</TD>
                      <TD>
                        {pilot ? (
                          <span className="font-medium text-fg">{pilot.name}</span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{e.country_code}</Badge>
                          {e.airfield_code ? (
                            <span className="font-mono text-xs text-fg-muted">{e.airfield_code}</span>
                          ) : null}
                        </div>
                        {e.vendor ? (
                          <div className="mt-1 text-[11px] text-fg-subtle">{e.vendor}</div>
                        ) : null}
                      </TD>
                      <TD align="right" className="whitespace-nowrap text-fg-muted">
                        {e.volume} {e.unit}
                      </TD>
                      <TD align="right" className="whitespace-nowrap">
                        <div className="font-medium text-fg">{formatMoney(e.total_amount, e.currency)}</div>
                        {e.vat_amount != null ? (
                          <div className="mt-0.5 text-[11px] text-fg-subtle">
                            VAT {formatMoney(e.vat_amount, e.currency)}
                          </div>
                        ) : null}
                      </TD>
                      <TD align="right" className="whitespace-nowrap">
                        {e.latest_calculation ? (
                          <Link
                            href={`/aircraft/${aircraftId}/expenses/${e.id}`}
                            className="group block rounded-md text-right outline-none ring-[color:var(--accent)] transition-colors hover:bg-surface-muted focus-visible:ring-2"
                          >
                            <div className="font-semibold text-[color:var(--accent)] group-hover:underline">
                              {formatMoney(
                                e.latest_calculation.refund_amount,
                                e.latest_calculation.refund_currency,
                              )}
                            </div>
                            <div className="mt-1 max-w-[260px] text-left text-[11px] font-normal text-fg-subtle">
                              {e.latest_calculation.explanation}
                            </div>
                            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100">
                              How calculated
                            </div>
                          </Link>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TD>
                      <TD align="right">
                        <ExpenseDeleteButton expenseId={e.id} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableFrame>

          <ExpensesPagination total={data.total} pageSize={data.limit} />
        </div>
      )}
    </div>
  );
}
