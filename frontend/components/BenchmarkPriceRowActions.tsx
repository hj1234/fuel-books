"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BenchmarkPriceRowActions({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function del() {
    if (!confirm("Delete fuel price?")) return;
    setLoading(true);
    await fetch(`/api/fb/v1/benchmark-prices/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  async function bumpVatRate() {
    setLoading(true);
    await fetch(`/api/fb/v1/benchmark-prices/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vat_rate: 0.2 }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        disabled={loading}
        onClick={bumpVatRate}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
        type="button"
      >
        Patch
      </button>
      <button
        disabled={loading}
        onClick={del}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
        type="button"
      >
        Delete
      </button>
    </div>
  );
}

