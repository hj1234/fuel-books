"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";
import { toast } from "@/components/ui/toast";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      toast.info("Signed out");
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const display = name?.trim() ? name.trim() : email;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full pr-2.5 pl-1 py-1",
          "bg-surface ring-1 ring-[color:var(--border)] hover:bg-surface-muted",
          "text-sm transition-colors",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={display} size="xs" />
        <span className="hidden text-xs font-medium text-fg sm:inline-block max-w-[160px] truncate">
          {display}
        </span>
        <ChevronDown size={14} className="text-fg-muted" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-xl",
            "bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-lg)]",
            "motion-safe:animate-[menuIn_120ms_ease-out]",
          )}
        >
          <div className="flex items-center gap-3 px-3 py-3 border-b border-[color:var(--border)]">
            <Avatar name={display} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{display}</div>
              <div className="truncate text-[12px] text-fg-muted">{email}</div>
            </div>
          </div>
          <div className="p-1">
            <Link
              role="menuitem"
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-surface-muted"
            >
              <UserRound size={15} className="text-fg-muted" aria-hidden="true" />
              Account
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={signOut}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-surface-muted disabled:opacity-60"
            >
              <LogOut size={15} className="text-fg-muted" aria-hidden="true" />
              {loading ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <style jsx>{`
            @keyframes menuIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}
