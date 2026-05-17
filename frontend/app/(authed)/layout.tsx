import Link from "next/link";

import { AuthedSidebar } from "@/components/AuthedSidebar";
import { UserMenu } from "@/components/UserMenu";
import { BrandLockup } from "@/components/ui/Brand";
import { fbFetch, type FbApiError } from "@/lib/server/fbApi";

type MeResponse = {
  id: number;
  email: string;
  full_name: string;
  email_verified_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  let me: MeResponse | null = null;
  try {
    me = await fbFetch<MeResponse>("/v1/auth/me", { method: "GET" });
  } catch (e: unknown) {
    const err = e as Partial<FbApiError> | null;
    if (err?.status !== 401 && err?.status !== 403) {
      // Avoid blowing up the entire shell for transient backend issues.
      me = null;
    }
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header
        className="sticky top-0 z-30 border-b border-[color:var(--border)]
                   bg-[color:var(--surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/70"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLockup />
          {me ? <UserMenu name={me.full_name} email={me.email} /> : null}
        </div>
      </header>

      {me && me.email_verified_at == null ? (
        <div className="border-b border-[color:var(--border)] bg-surface-muted">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs text-fg-muted sm:px-6 lg:px-8">
            <span>
              Your email address hasn&apos;t been verified yet.
            </span>
            <Link
              href="/account"
              className="font-medium text-fg underline-offset-4 hover:underline"
            >
              Verify in account settings
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[232px_minmax(0,1fr)]">
          <AuthedSidebar />
          <main
            className="rounded-2xl bg-surface ring-1 ring-[color:var(--border)] shadow-[var(--shadow-sm)]
                       px-6 py-7 sm:px-8 sm:py-8 min-w-0"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
