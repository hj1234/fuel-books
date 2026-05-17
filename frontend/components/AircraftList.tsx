"use client";

import { ArrowRight, MapPin, Plane, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";
import { toast } from "@/components/ui/toast";

type AircraftOut = {
  id: string;
  registration: string;
  make: string;
  model: string;
  home_base_airfield: string | null;
};

function normalizeRegistration(s: string) {
  return s.trim().toUpperCase();
}

export function AircraftList({ aircraft }: { aircraft: AircraftOut[] }) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(
    () => (deleteId == null ? null : aircraft.find((a) => a.id === deleteId) ?? null),
    [aircraft, deleteId],
  );

  const matches = useMemo(() => {
    if (!target) return false;
    return normalizeRegistration(confirmText) === normalizeRegistration(target.registration);
  }, [confirmText, target]);

  function closeModal() {
    setDeleteId(null);
    setConfirmText("");
    setError(null);
  }

  async function del() {
    if (!target) return;
    setLoadingId(target.id);
    setError(null);
    const res = await fetch(`/api/fb/v1/aircraft/${target.id}`, { method: "DELETE" });
    setLoadingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Delete failed");
      return;
    }
    toast.success(`Deleted ${target.registration}`);
    closeModal();
    router.refresh();
  }

  if (aircraft.length === 0) {
    return (
      <EmptyState
        icon={<Plane size={20} />}
        title="No aircraft yet"
        description="Add your first aircraft to start tracking fuel expenses and refunds."
        action={
          <Link
            href="/aircraft/add"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 text-sm font-medium text-primary-fg shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--primary-hover)]"
          >
            Add aircraft
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {aircraft.map((a) => (
          <article
            key={a.id}
            className={cn(
              "group relative flex min-w-0 flex-col rounded-xl bg-surface ring-1 ring-[color:var(--border)]",
              "transition-shadow hover:shadow-[var(--shadow-md)]",
            )}
          >
            <Link
              href={`/aircraft/${a.id}`}
              className="flex flex-1 flex-col gap-3 p-4 outline-none focus-visible:ring-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.registration} size="md" square from="end" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold tracking-tight text-fg">
                      {a.registration}
                    </div>
                    <div className="truncate text-xs text-fg-muted">
                      {a.make} {a.model}
                    </div>
                  </div>
                </div>
              </div>

              {a.home_base_airfield ? (
                <Badge tone="neutral" leftIcon={<MapPin size={11} />} className="self-start">
                  {a.home_base_airfield}
                </Badge>
              ) : null}

              <div className="mt-auto flex items-center justify-end pt-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors group-hover:text-[color:var(--accent)]">
                  Open <ArrowRight size={12} />
                </span>
              </div>
            </Link>

            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <IconButton
                size="sm"
                variant="danger"
                label={`Delete ${a.registration}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setError(null);
                  setConfirmText("");
                  setDeleteId(a.id);
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={target != null}
        onClose={closeModal}
        size="sm"
        title={target ? `Delete ${target.registration}?` : "Delete aircraft"}
        description={
          target ? (
            <>
              This will permanently remove the aircraft and its associated data. Type{" "}
              <span className="font-medium text-fg">{target.registration}</span> to confirm.
            </>
          ) : null
        }
        footer={
          <>
            <Button variant="ghost" size="md" onClick={closeModal} disabled={loadingId != null}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={del}
              loading={loadingId === target?.id}
              disabled={!matches}
            >
              {loadingId === target?.id ? "Deleting" : "Delete aircraft"}
            </Button>
          </>
        }
      >
        {target ? (
          <FormField label="Registration" error={error ?? undefined}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                className="uppercase"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={target.registration}
                autoFocus
              />
            )}
          </FormField>
        ) : null}
      </Modal>
    </>
  );
}
