import { Plus } from "lucide-react";
import Link from "next/link";

import { AircraftCreatedToast } from "@/components/AircraftCreatedToast";
import { AircraftList } from "@/components/AircraftList";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch } from "@/lib/server/fbApi";

type AircraftOut = {
  id: string;
  registration: string;
  make: string;
  model: string;
  home_base_airfield: string | null;
};

export const dynamic = "force-dynamic";

export default async function AircraftPage() {
  const aircraft = await fbFetch<AircraftOut[]>("/v1/aircraft", { method: "GET" });

  return (
    <div className="space-y-7">
      <AircraftCreatedToast />
      <PageHeader
        eyebrow="Workspace"
        title="Aircraft"
        description="Your aircraft and per-aircraft configuration."
        actions={
          <Link
            href="/aircraft/add"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-3.5 text-sm font-medium text-primary-fg shadow-[var(--shadow-sm)] transition-colors hover:bg-[color:var(--primary-hover)]"
          >
            <Plus size={15} aria-hidden="true" />
            Add aircraft
          </Link>
        }
      />

      <AircraftList aircraft={aircraft} />
    </div>
  );
}
