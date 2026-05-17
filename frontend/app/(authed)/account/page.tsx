import { ChangePasswordPanel } from "@/components/ChangePasswordPanel";
import { CopyButton } from "@/components/CopyButton";
import { EmailPanel } from "@/components/EmailPanel";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fbFetch } from "@/lib/server/fbApi";

type MeResponse = {
  id: number;
  email: string;
  full_name: string;
  email_verified_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await fbFetch<MeResponse>("/v1/auth/me", { method: "GET" });

  const display = me.full_name?.trim() || me.email;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Account"
        description="Your authenticated user profile."
      />

      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={display} size="lg" />
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight text-fg">{display}</div>
            <div className="mt-0.5 text-sm text-fg-muted">User ID #{me.id}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[color:var(--border)] pt-5 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Email</div>
              <div className="mt-0.5 truncate text-sm text-fg">{me.email}</div>
            </div>
            <CopyButton value={me.email} label="Email" />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Full name</div>
              <div className="mt-0.5 truncate text-sm text-fg">{me.full_name || "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      <EmailPanel email={me.email} verifiedAt={me.email_verified_at} />

      <ChangePasswordPanel />
    </div>
  );
}
