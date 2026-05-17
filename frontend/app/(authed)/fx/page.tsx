import { Coins } from "lucide-react";

import { FxQuoteForm } from "@/components/FxQuoteForm";
import { FxTimeseriesChart } from "@/components/FxTimeseriesChart";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableFrame, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatDate, formatNumber } from "@/lib/format";
import { fbFetch } from "@/lib/server/fbApi";

type FxRateOut = {
  id: number;
  effective_date: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  source: string;
};

export default async function FxPage() {
  const [rates, currencies] = await Promise.all([
    fbFetch<FxRateOut[]>("/v1/fx-rates", { method: "GET" }),
    fbFetch<string[]>("/v1/fx-rates/currencies", { method: "GET" }).catch(() => [] as string[]),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="FX rates"
        description="Browse stored FX rates and query the quote endpoint for a specific currency pair and date."
      />

      <FxTimeseriesChart currencies={currencies} defaultBase="GBP" defaultQuote="EUR" />

      <FxQuoteForm />

      <TableFrame>
        {rates.length === 0 ? (
          <EmptyState
            icon={<Coins size={20} />}
            title="No FX rates yet"
            description="Quote a currency pair above and the result will be cached here."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Pair</TH>
                <TH align="right">Rate</TH>
                <TH>Source</TH>
              </TR>
            </THead>
            <TBody>
              {rates.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(r.effective_date)}</TD>
                  <TD>
                    <span className="font-medium text-fg">
                      {r.base_currency} <span className="text-fg-subtle">/</span> {r.quote_currency}
                    </span>
                  </TD>
                  <TD align="right" className="font-mono text-fg">
                    {formatNumber(r.rate, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                  </TD>
                  <TD>
                    <Badge tone="neutral">{r.source}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </TableFrame>
    </div>
  );
}
