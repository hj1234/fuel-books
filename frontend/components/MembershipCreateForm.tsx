"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/toast";

export function MembershipCreateForm({ aircraftId }: { aircraftId: string }) {
  const router = useRouter();
  const [invitedEmail, setInvitedEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "PILOT">("PILOT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/memberships`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invited_email: invitedEmail, role }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Create failed");
      return;
    }

    toast.success(`Invitation sent to ${invitedEmail}`);
    setInvitedEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Card
        header={
          <div>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>They&apos;ll get access to this aircraft once they accept.</CardDescription>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? "Inviting" : "Send invite"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Email" className="sm:col-span-2" required>
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={invitedEmail}
                onChange={(e) => setInvitedEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
              />
            )}
          </FormField>
          <FormField label="Role">
            {({ id }) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "PILOT")}>
                <option value="PILOT">Pilot</option>
                <option value="ADMIN">Admin</option>
              </Select>
            )}
          </FormField>
        </div>
      </Card>
    </form>
  );
}
