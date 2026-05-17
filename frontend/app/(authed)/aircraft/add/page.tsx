import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { AircraftCreateForm } from "@/components/AircraftCreateForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function AircraftAddPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Aircraft"
        title="Add aircraft"
        description="Create a new aircraft to start tracking fuel expenses and refund policy."
        actions={
          <Link
            href="/aircraft"
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-surface px-3 text-sm text-fg-muted ring-1 ring-[color:var(--border)] hover:bg-surface-muted hover:text-fg"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Back
          </Link>
        }
      />

      <AircraftCreateForm redirectTo="/aircraft?created=1" />
    </div>
  );
}
