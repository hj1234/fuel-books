"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AircraftManagePanel({
  aircraftId,
  homeBaseAirfield,
}: {
  aircraftId: string;
  homeBaseAirfield: string | null;
}) {
  const router = useRouter();
  const [homeBase, setHomeBase] = useState(homeBaseAirfield ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ home_base_airfield: homeBase || null }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function del() {
    if (!confirm("Delete this aircraft? This cannot be undone.")) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Delete failed");
      return;
    }
    router.push("/aircraft");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm font-medium">Manage</div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-sm flex-1">
          <div className="text-zinc-700">Home base airfield</div>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-zinc-900/10"
            value={homeBase}
            onChange={(e) => setHomeBase(e.target.value.toUpperCase())}
            placeholder="EGLL"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={del}
            disabled={loading}
            className="h-10 rounded-lg border border-red-200 bg-white px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
      {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}

