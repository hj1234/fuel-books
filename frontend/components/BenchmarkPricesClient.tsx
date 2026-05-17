"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  BenchmarkPriceForm,
  type AircraftPolicyCandidate,
  type BenchmarkPriceOut,
} from "@/components/BenchmarkPriceForm";
import { BenchmarkPricesChart } from "@/components/BenchmarkPricesChart";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/toast";

const ALL_AIRCRAFT = "__all__";

export function BenchmarkPricesClient({
  prices,
  candidates,
}: {
  prices: BenchmarkPriceOut[];
  candidates: AircraftPolicyCandidate[];
}) {
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; id?: string }>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [aircraftFilter, setAircraftFilter] = useState<string>(ALL_AIRCRAFT);

  const aircraftByPolicy = useMemo(() => {
    const map = new Map<string, AircraftPolicyCandidate>();
    for (const c of candidates) {
      if (c.policy_id != null && !map.has(c.policy_id)) map.set(c.policy_id, c);
    }
    return map;
  }, [candidates]);

  const selectedCandidate = useMemo(() => {
    if (aircraftFilter === ALL_AIRCRAFT) return null;
    return candidates.find((c) => c.aircraft_id === aircraftFilter) ?? null;
  }, [aircraftFilter, candidates]);

  const filteredPrices = useMemo(() => {
    if (!selectedCandidate) return prices;
    if (selectedCandidate.policy_id == null) return [];
    return prices.filter((p) => p.policy_id === selectedCandidate.policy_id);
  }, [prices, selectedCandidate]);

  const selectedId = modal?.mode === "edit" ? modal.id ?? null : null;
  const editing =
    modal?.mode === "edit" && modal.id != null
      ? prices.find((p) => p.id === modal.id) ?? null
      : null;
  const pendingDelete =
    pendingDeleteId == null ? null : prices.find((p) => p.id === pendingDeleteId) ?? null;

  async function refreshNow() {
    window.location.reload();
  }

  async function delPending() {
    if (pendingDeleteId == null) return;
    setDeleting(true);
    const res = await fetch(`/api/fb/v1/benchmark-prices/${pendingDeleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Fuel price deleted");
    setPendingDeleteId(null);
    await refreshNow();
  }

  const hasManagedAircraft = candidates.length > 0;
  const canRecordBenchmarks = candidates.some((c) => c.policy_id != null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {candidates.length > 1 ? (
            <FormField label="Aircraft" className="sm:w-72">
              {({ id }) => (
                <Select
                  id={id}
                  value={aircraftFilter}
                  onChange={(e) => setAircraftFilter(e.target.value)}
                >
                  <option value={ALL_AIRCRAFT}>All aircraft</option>
                  {candidates.map((c) => (
                    <option key={c.aircraft_id} value={c.aircraft_id}>
                      {c.aircraft_registration}
                      {c.home_base_airfield ? ` · ${c.home_base_airfield}` : ""}
                      {c.policy_id == null ? " (no fuel policy)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : (
            <p className="text-xs text-fg-muted">Click a point on the chart to edit it.</p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => setModal({ mode: "create" })}
            disabled={!hasManagedAircraft || !canRecordBenchmarks}
          >
            Add price
          </Button>
          {hasManagedAircraft && !canRecordBenchmarks ? (
            <p className="max-w-xs text-right text-[11px] text-fg-muted">
              Link a fuel policy to at least one aircraft first (Policy tab).
            </p>
          ) : null}
        </div>
      </div>

      {!hasManagedAircraft ? (
        <div className="rounded-xl bg-surface-muted px-4 py-10 text-center text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
          You don&apos;t administer any aircraft yet, or you aren&apos;t an admin member. Create an aircraft or ask an
          owner for admin access.
        </div>
      ) : (
        <>
          {selectedCandidate != null && selectedCandidate.policy_id == null ? (
            <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)]">
              This aircraft has no fuel policy linked, so there are no fuel price series for it yet. Open{" "}
              <span className="font-medium text-fg">Policy</span> on that aircraft or switch back to &quot;All
              aircraft&quot;.
            </div>
          ) : null}
          <BenchmarkPricesChart
            prices={filteredPrices}
            aircraftByPolicy={aircraftByPolicy}
            selectedId={selectedId}
            onSelect={(p) => {
              if (p) setModal({ mode: "edit", id: p.id });
            }}
          />
        </>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === "edit" ? "Edit fuel price" : "Add fuel price"}
      >
        <BenchmarkPriceForm
          mode={modal?.mode ?? "create"}
          existing={modal?.mode === "edit" ? editing : null}
          candidates={candidates}
          defaultAircraftId={selectedCandidate?.aircraft_id}
          onCancel={() => setModal(null)}
          onDelete={
            modal?.mode === "edit" && editing
              ? () => {
                  const id = editing.id;
                  setModal(null);
                  setPendingDeleteId(id);
                }
              : undefined
          }
          onDone={async () => {
            setModal(null);
            await refreshNow();
          }}
        />
      </Modal>

      <Modal
        open={pendingDeleteId != null}
        onClose={() => (deleting ? null : setPendingDeleteId(null))}
        size="sm"
        title="Delete fuel price?"
        description={
          pendingDelete
            ? `This will permanently remove the price for ${pendingDelete.airfield_code} on ${pendingDelete.effective_from}.`
            : null
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={delPending} loading={deleting}>
              {deleting ? "Deleting" : "Delete price"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">This cannot be undone.</p>
      </Modal>
    </div>
  );
}
