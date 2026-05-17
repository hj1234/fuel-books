"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function toLocalDateInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExpenseUpdateForm({
  expenseId,
  currentNotes,
  currentPurchasedAt,
  showNotes = true,
}: {
  expenseId: string;
  currentNotes: string | null;
  currentPurchasedAt: string;
  showNotes?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [purchasedDate, setPurchasedDate] = useState(() => toLocalDateInputValue(currentPurchasedAt));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/fb/v1/fuel-expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purchased_at: new Date(`${purchasedDate}T00:00:00`).toISOString(),
        ...(showNotes ? { notes: notes || null } : {}),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Update failed");
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-900/10"
          type="date"
          value={purchasedDate}
          onChange={(e) => setPurchasedDate(e.target.value)}
        />
        {showNotes ? (
          <input
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-zinc-900/10"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
          />
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Update (recalc)"}
        </button>
      </div>
      {error ? <div className="mt-2 text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

