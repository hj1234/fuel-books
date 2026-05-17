"use client";

import {
  ChevronLeft,
  FileText,
  LineChart,
  type LucideIcon,
  Plane,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/components/ui/cn";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavItem = { href: string; label: string; icon: LucideIcon };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
        "transition-colors duration-150",
        active
          ? "bg-surface-muted text-fg font-medium"
          : "text-fg-muted hover:bg-surface-muted hover:text-fg",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute -left-1.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[color:var(--accent)]"
        />
      ) : null}
      <Icon
        size={16}
        className={cn(active ? "text-[color:var(--accent)]" : "text-fg-subtle group-hover:text-fg-muted")}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

const TOP_LEVEL: NavItem[] = [
  { href: "/aircraft", label: "Aircraft", icon: Plane },
  { href: "/benchmark-prices", label: "Fuel prices", icon: LineChart },
];

function aircraftItems(aircraftId: string): NavItem[] {
  return [
    { href: `/aircraft/${aircraftId}/expenses`, label: "Fuel expenses", icon: Receipt },
    { href: `/aircraft/${aircraftId}/pilots`, label: "Pilots", icon: Users },
    { href: `/aircraft/${aircraftId}/policy`, label: "Policy", icon: ScrollText },
    { href: `/aircraft/${aircraftId}/invoices`, label: "Invoices", icon: FileText },
  ];
}

export function AuthedSidebar() {
  const pathname = usePathname();
  const params = useParams();

  const rawAircraftId = params?.aircraftId;
  const aircraftId = Array.isArray(rawAircraftId) ? rawAircraftId[0] : rawAircraftId;
  const inAircraft = typeof aircraftId === "string" && pathname.startsWith(`/aircraft/${aircraftId}`);

  return (
    <aside className="md:sticky md:top-[calc(56px+1rem)] md:self-start">
      <nav className="rounded-2xl bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-sm)] p-3">
        {inAircraft ? (
          <>
            <Link
              href="/aircraft"
              className="group flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              All aircraft
            </Link>
            <div className="mt-3 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              Aircraft
            </div>
            <div className="space-y-0.5">
              {aircraftItems(aircraftId!).map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              Workspace
            </div>
            <div className="space-y-0.5">
              {TOP_LEVEL.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
