import type { ReactNode } from "react";

import { BrandLockup, BrandMark } from "@/components/ui/Brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg lg:grid-cols-[5fr_6fr]">
      <aside
        className="relative hidden overflow-hidden bg-[color:var(--primary)] text-primary-fg lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10"
        aria-hidden="true"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 80% at 100% 0%, rgba(94,183,175,0.30) 0%, rgba(94,183,175,0) 55%), radial-gradient(80% 80% at 0% 100%, rgba(245,222,179,0.10) 0%, rgba(245,222,179,0) 60%)",
          }}
        />

        <div className="relative">
          <BrandLockup href={null} />
        </div>

        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-fg/60">
            For aircraft owners
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-primary-fg max-w-md">
            Refund policy and fuel expense management, kept tidy.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-fg/70">
            Track aircraft fuel purchases, automate refund calculations against your policy, and
            keep an auditable trail for every transaction.
          </p>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-primary-fg/60">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
          v0 · private preview
        </div>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <BrandLockup href={null} />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 hidden lg:block">
              <BrandMark size={36} />
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p> : null}
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 text-sm text-fg-muted">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
