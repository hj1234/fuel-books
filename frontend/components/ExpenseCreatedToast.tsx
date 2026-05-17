"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/toast";

/**
 * Listens for the `?created=1` query flag set after a successful expense
 * creation and surfaces a toast. The flag is then stripped from the URL.
 */
export function ExpenseCreatedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const created = searchParams.get("created") === "1";
  const firedRef = useRef(false);

  useEffect(() => {
    if (!created || firedRef.current) return;
    firedRef.current = true;
    toast.success("Expense created");

    const next = new URLSearchParams(searchParams.toString());
    next.delete("created");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [created, pathname, router, searchParams]);

  return null;
}
