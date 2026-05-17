"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/toast";

export function PilotCreateForm({ aircraftId }: { aircraftId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/fb/v1/aircraft/${aircraftId}/pilots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email: email || null }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Create failed");
      return;
    }

    toast.success(`Added pilot ${name}`);
    setName("");
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Card
        header={
          <div>
            <CardTitle>Add pilot</CardTitle>
            <CardDescription>Pilots are scoped to this aircraft.</CardDescription>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? "Adding" : "Add pilot"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" required>
            {({ id }) => (
              <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required />
            )}
          </FormField>
          <FormField label="Email" helper="Optional, for personal reference only.">
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pilot@example.com"
              />
            )}
          </FormField>
        </div>
      </Card>
    </form>
  );
}
