"use client";

import { Download, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/toast";

type Candidate = {
  aircraft_id: string;
  aircraft_registration: string;
  policy_id: string;
  base_currency: string;
};

export function PolicyEmptyState({ aircraftId }: { aircraftId: string }) {
  const router = useRouter();
  const [baseCurrency, setBaseCurrency] = useState("GBP");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>("");
  const [loading, setLoading] = useState<"create" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredCandidates = useMemo(
    () => candidates.filter((c) => c.aircraft_id !== aircraftId),
    [aircraftId, candidates],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/fb/v1/policy/import-candidates", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json().catch(() => [])) as Candidate[];
      if (cancelled) return;
      setCandidates(Array.isArray(json) ? json : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createNew() {
    setLoading("create");
    setError(null);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/policy`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base_currency: baseCurrency }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.detail?.detail ?? body?.detail ?? "Create failed";
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Policy created");
    router.refresh();
  }

  async function importFromOther() {
    if (!selectedAircraftId) return;
    setLoading("import");
    setError(null);
    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/policy/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_aircraft_id: selectedAircraftId }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = body?.detail?.detail ?? body?.detail ?? "Import failed";
      setError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Policy imported");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card variant="muted">
        <CardTitle>No policy yet</CardTitle>
        <CardDescription>
          This aircraft doesn&apos;t have a refund policy configured. Create a new one, or import from another
          aircraft you manage.
        </CardDescription>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          header={
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--border)]">
                <Sparkles size={16} aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Create new policy</CardTitle>
                <CardDescription>Choose a base currency to start with.</CardDescription>
              </div>
            </div>
          }
          footer={
            <div className="flex w-full justify-end">
              <Button variant="primary" onClick={createNew} loading={loading === "create"}>
                {loading === "create" ? "Creating" : "Create policy"}
              </Button>
            </div>
          }
        >
          <FormField label="Base currency">
            {({ id }) => (
              <Input
                id={id}
                className="w-32 uppercase"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            )}
          </FormField>
        </Card>

        <Card
          header={
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-fg-muted ring-1 ring-[color:var(--border)]">
                <Download size={16} aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Import existing</CardTitle>
                <CardDescription>From another aircraft you manage.</CardDescription>
              </div>
            </div>
          }
          footer={
            <div className="flex w-full justify-end">
              <Button
                variant="secondary"
                onClick={importFromOther}
                disabled={!selectedAircraftId}
                loading={loading === "import"}
              >
                {loading === "import" ? "Importing" : "Import"}
              </Button>
            </div>
          }
        >
          <FormField label="From aircraft">
            {({ id }) => (
              <Select
                id={id}
                value={selectedAircraftId}
                onChange={(e) => setSelectedAircraftId(e.target.value)}
                disabled={filteredCandidates.length === 0}
              >
                <option value="">
                  {filteredCandidates.length === 0 ? "No other policies found" : "Select…"}
                </option>
                {filteredCandidates.map((c) => (
                  <option key={c.aircraft_id} value={c.aircraft_id}>
                    {c.aircraft_registration} ({c.base_currency})
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </Card>
      </div>

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
