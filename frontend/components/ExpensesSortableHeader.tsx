"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { TH, type AlignProp } from "@/components/ui/Table";
import { cn } from "@/components/ui/cn";
import {
  buildExpensesUrl,
  parseExpensesQuery,
  type ExpensesSort,
} from "@/lib/expensesQuery";

export function ExpensesSortableHeader({
  column,
  align = "left",
  className,
  children,
}: {
  column: ExpensesSort;
  align?: AlignProp;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const query = parseExpensesQuery(params);
  const isActive = query.sort === column;
  const dir = isActive ? query.dir : null;

  function onClick() {
    // Click the active column to flip direction; click an inactive column to
    // adopt it with `desc` as the default.
    const nextDir = isActive ? (dir === "asc" ? "desc" : "asc") : "desc";
    const url = buildExpensesUrl(pathname, params, { sort: column, dir: nextDir });
    startTransition(() => router.push(url, { scroll: false }));
  }

  const Icon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  const ariaSort = !isActive ? "none" : dir === "asc" ? "ascending" : "descending";

  return (
    <TH align={align} className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded transition-colors",
          "hover:text-fg focus-visible:text-fg",
          isActive ? "text-fg" : "text-fg-subtle",
          align === "right" && "ml-auto flex-row-reverse",
          align === "center" && "mx-auto",
          "disabled:cursor-progress",
        )}
      >
        <span className="uppercase tracking-[0.08em]">{children}</span>
        <Icon
          size={12}
          aria-hidden="true"
          className={cn(
            "transition-opacity",
            isActive ? "opacity-100 text-[color:var(--accent)]" : "opacity-50 group-hover:opacity-90",
          )}
        />
      </button>
    </TH>
  );
}
