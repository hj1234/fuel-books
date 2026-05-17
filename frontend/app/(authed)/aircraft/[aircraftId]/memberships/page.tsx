import { ChevronLeft, UserRound } from "lucide-react";
import Link from "next/link";

import { MembershipCreateForm } from "@/components/MembershipCreateForm";
import { MembershipRowActions } from "@/components/MembershipRowActions";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableFrame, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatDateTime } from "@/lib/format";
import { fbFetch } from "@/lib/server/fbApi";

type MembershipOut = {
  id: string;
  aircraft_id: string;
  user_email: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
};

function statusTone(status: string): BadgeTone {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ACCEPTED":
      return "success";
    case "PENDING":
    case "INVITED":
      return "warning";
    case "REMOVED":
    case "REVOKED":
      return "danger";
    default:
      return "neutral";
  }
}

function roleTone(role: string): BadgeTone {
  return role.toUpperCase() === "OWNER" ? "accent" : "neutral";
}

export default async function MembershipsPage({ params }: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await params;
  const memberships = await fbFetch<MembershipOut[]>(`/v1/aircraft/${aircraftId}/memberships`, { method: "GET" });

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Aircraft"
        title="Memberships"
        description="Invite users and manage aircraft roles."
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

      <MembershipCreateForm aircraftId={aircraftId} />

      <TableFrame>
        {memberships.length === 0 ? (
          <EmptyState
            icon={<UserRound size={20} />}
            title="No memberships yet"
            description="Invite teammates by email to grant them access to this aircraft."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Invited</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {memberships.map((m) => {
                // Prefer the linked user's email once they've accepted; fall
                // back to the original invitation address. We deliberately
                // don't expose internal user ids in the UI.
                const display = m.user_email ?? m.invited_email ?? "—";
                const showInvitedSubline = !!(m.user_email && m.invited_email && m.invited_email !== m.user_email);
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={display} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-fg">{display}</div>
                          {showInvitedSubline ? (
                            <div className="truncate text-[11px] text-fg-subtle">invited as {m.invited_email}</div>
                          ) : null}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={roleTone(m.role)}>{m.role}</Badge>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    </TD>
                    <TD className="text-fg-muted whitespace-nowrap">
                      {formatDateTime(m.invited_at)}
                      {m.accepted_at ? (
                        <div className="text-[11px] text-fg-subtle">accepted {formatDateTime(m.accepted_at)}</div>
                      ) : null}
                    </TD>
                    <TD align="right">
                      <MembershipRowActions membershipId={m.id} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </TableFrame>
    </div>
  );
}
