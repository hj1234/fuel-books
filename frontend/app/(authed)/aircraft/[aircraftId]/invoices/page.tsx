import { Download, FileText } from "lucide-react";

import { InvoiceMonthPicker } from "@/components/InvoiceMonthPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableFrame, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatMoney } from "@/lib/format";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

type InvoicePilotSummary = {
  pilot_id: string;
  pilot_name: string;
  pilot_email: string | null;
  expense_count: number;
  totals_spent: Record<string, number>;
  totals_refund: Record<string, number>;
};

type InvoiceSummaryResponse = {
  month: string;
  pilots: InvoicePilotSummary[];
  unassigned_expense_count: number;
};

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function currentMonth(): string {
  const now = new Date();
  const yy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function monthLabel(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const year = Number(month.slice(0, 4));
  const monthIdx = Number(month.slice(5, 7)) - 1;
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "—";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ccy, value]) => formatMoney(value, ccy))
    .join(", ");
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ aircraftId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { aircraftId } = await params;
  const sp = await searchParams;
  const month = sp.month && MONTH_RE.test(sp.month) ? sp.month : currentMonth();

  let data: InvoiceSummaryResponse | null = null;
  let error: string | null = null;
  try {
    data = await fbFetch<InvoiceSummaryResponse>(
      `/v1/aircraft/${aircraftId}/invoices/pilots?month=${encodeURIComponent(month)}`,
      { method: "GET" },
    );
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status === 404) {
      data = { month, pilots: [], unassigned_expense_count: 0 };
    } else {
      error =
        typeof err?.detail === "string"
          ? err.detail
          : "Failed to load invoices for this period.";
    }
  }

  const pilots = data?.pilots ?? [];
  const unassigned = data?.unassigned_expense_count ?? 0;
  const zipHref = `/api/fb/v1/aircraft/${aircraftId}/invoices.zip?month=${encodeURIComponent(month)}`;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Aircraft"
        title="Invoices"
        description="Download a fuel invoice PDF per pilot for a chosen month."
        actions={<InvoiceMonthPicker month={month} />}
      />

      <div className="flex flex-col gap-2 rounded-2xl bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-sm)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-fg">{monthLabel(month)}</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {pilots.length === 0
              ? "No invoiceable expenses for this period."
              : `${pilots.length} pilot${pilots.length === 1 ? "" : "s"} with expenses.`}
            {unassigned > 0 ? (
              <>
                {" "}
                <span className="text-amber-700">
                  {unassigned} expense{unassigned === 1 ? "" : "s"} have no pilot assigned and are
                  excluded from invoices.
                </span>
              </>
            ) : null}
          </div>
        </div>
        {pilots.length > 0 ? (
          <a
            href={zipHref}
            download
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-3.5 text-sm font-medium text-primary-fg shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--primary-hover)]"
          >
            <Download size={15} aria-hidden="true" />
            Download all (zip)
          </a>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {pilots.length === 0 && !error ? (
        <TableFrame>
          <EmptyState
            icon={<FileText size={20} />}
            title="No invoices for this month"
            description="Pick a different month, or add fuel expenses against a pilot to generate invoices."
          />
        </TableFrame>
      ) : pilots.length > 0 ? (
        <TableFrame>
          <Table>
            <THead>
              <TR>
                <TH>Pilot</TH>
                <TH align="right">Expenses</TH>
                <TH align="right">Total spent</TH>
                <TH align="right">Total refund</TH>
                <TH align="right" className="w-40"></TH>
              </TR>
            </THead>
            <TBody>
              {pilots.map((p) => {
                const pdfHref = `/api/fb/v1/aircraft/${aircraftId}/invoices/pilot/${p.pilot_id}.pdf?month=${encodeURIComponent(month)}`;
                return (
                  <TR key={p.pilot_id}>
                    <TD>
                      <div className="font-medium text-fg">{p.pilot_name}</div>
                      {p.pilot_email ? (
                        <div className="mt-0.5 text-[11px] text-fg-subtle">{p.pilot_email}</div>
                      ) : null}
                    </TD>
                    <TD align="right" className="text-fg-muted">
                      {p.expense_count}
                    </TD>
                    <TD align="right" className="whitespace-nowrap">
                      {formatTotals(p.totals_spent)}
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-[color:var(--accent)] font-semibold">
                      {formatTotals(p.totals_refund)}
                    </TD>
                    <TD align="right">
                      <a
                        href={pdfHref}
                        download
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm text-fg ring-1 ring-[color:var(--border)] transition-colors hover:bg-surface-muted"
                      >
                        <Download size={14} aria-hidden="true" />
                        Download PDF
                      </a>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableFrame>
      ) : null}
    </div>
  );
}
