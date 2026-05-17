"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/toast";

export function AircraftCreateForm({ redirectTo }: { redirectTo?: string } = {}) {
  const router = useRouter();
  const [registration, setRegistration] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [homeBaseAirfield, setHomeBaseAirfield] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/fb/v1/aircraft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        registration,
        make,
        model,
        home_base_airfield: homeBaseAirfield,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Create failed");
      return;
    }

    setRegistration("");
    setMake("");
    setModel("");
    setHomeBaseAirfield("");
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }
    toast.success("Aircraft created");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <Card
        header={
          <div>
            <CardTitle>Create aircraft</CardTitle>
            <CardDescription>Tail number and basic identifiers.</CardDescription>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            {error ? (
              <span className="mr-auto text-xs text-danger">{error}</span>
            ) : null}
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? "Creating" : "Create aircraft"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Registration" required>
            {({ id }) => (
              <Input
                id={id}
                className="uppercase"
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                placeholder="G-ABCD"
                required
              />
            )}
          </FormField>
          <FormField label="Home base" helper="ICAO code" required>
            {({ id }) => (
              <Input
                id={id}
                className="uppercase"
                value={homeBaseAirfield}
                onChange={(e) => setHomeBaseAirfield(e.target.value.toUpperCase())}
                placeholder="EGLL"
                maxLength={4}
                required
              />
            )}
          </FormField>
          <FormField label="Make" required>
            {({ id }) => (
              <Input id={id} value={make} onChange={(e) => setMake(e.target.value)} placeholder="Cessna" required />
            )}
          </FormField>
          <FormField label="Model" required>
            {({ id }) => (
              <Input id={id} value={model} onChange={(e) => setModel(e.target.value)} placeholder="172 Skyhawk" required />
            )}
          </FormField>
        </div>
      </Card>
    </form>
  );
}
