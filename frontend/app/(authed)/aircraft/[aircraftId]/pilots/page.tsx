import { ChevronLeft, Users } from "lucide-react";
import Link from "next/link";

import { PilotCreateForm } from "@/components/PilotCreateForm";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch } from "@/lib/server/fbApi";

type PilotOut = { id: string; aircraft_id: string; name: string; email: string | null };

export const dynamic = "force-dynamic";

export default async function PilotsPage({ params }: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await params;
  const pilots = await fbFetch<PilotOut[]>(`/v1/aircraft/${aircraftId}/pilots`, { method: "GET" });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Aircraft"
        title="Pilots"
        description="Per-aircraft pilots used for fuel-expense attribution."
        actions={
          <Link
            href={`/aircraft/${aircraftId}`}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)] hover:bg-surface-muted hover:text-fg"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </Link>
        }
      />

      <PilotCreateForm aircraftId={aircraftId} />

      <Card padded={false}>
        {pilots.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="No pilots yet"
            description="Add a pilot above to attribute fuel expenses to them."
            size="sm"
          />
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {pilots.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">{p.name}</div>
                  <div className="truncate text-xs text-fg-muted">{p.email ?? "No email"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
