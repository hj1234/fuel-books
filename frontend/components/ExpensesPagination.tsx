"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { buildExpensesUrl, EXPENSES_PAGE_SIZE, parseExpensesQuery } from "@/lib/expensesQuery";

export function ExpensesPagination({
  total,
  pageSize = EXPENSES_PAGE_SIZE,
}: {
  total: number;
  pageSize?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const query = parseExpensesQuery(params);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(query.page, totalPages);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const goTo = (next: number) => {
    const url = buildExpensesUrl(pathname, params, { page: next });
    startTransition(() => router.push(url, { scroll: false }));
  };

  return (
    <div className="flex flex-col items-stretch gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-fg-muted tabular-nums">
        {total === 0 ? (
          "No results"
        ) : (
          <>
            Showing <span className="font-medium text-fg">{start.toLocaleString("en-GB")}</span>
            {" – "}
            <span className="font-medium text-fg">{end.toLocaleString("en-GB")}</span> of{" "}
            <span className="font-medium text-fg">{total.toLocaleString("en-GB")}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-subtle tabular-nums" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ChevronLeft size={14} />}
          onClick={() => goTo(page - 1)}
          disabled={pending || page <= 1}
          aria-label="Previous page"
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="secondary"
          rightIcon={<ChevronRight size={14} />}
          onClick={() => goTo(page + 1)}
          disabled={pending || page >= totalPages}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
