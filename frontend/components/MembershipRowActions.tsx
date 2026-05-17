"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";

export function MembershipRowActions({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setRemoved() {
    setLoading(true);
    const res = await fetch(`/api/fb/v1/memberships/${membershipId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "REMOVED" }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.detail?.detail ?? body?.detail ?? "Update failed");
      return;
    }
    toast.success("Membership removed");
    router.refresh();
  }

  return (
    <Button size="sm" variant="ghost" onClick={setRemoved} loading={loading}>
      {loading ? "Removing" : "Remove"}
    </Button>
  );
}
