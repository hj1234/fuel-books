"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/toast";

export function ChangePasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/fb/v1/auth/password/change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Password change failed");
      return;
    }

    reset();
    toast.success("Password updated");
  }

  return (
    <Card
      header={
        <div>
          <CardTitle>Change password</CardTitle>
          <p className="mt-1 text-sm text-fg-muted">
            You&apos;ll stay signed in on this device; existing reset links will stop working.
          </p>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Current password" required>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="New password" required>
            {({ id }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={8}
                required
              />
            )}
          </FormField>
          <FormField label="Confirm new password" required>
            {({ id }) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
              />
            )}
          </FormField>
        </div>

        {error ? (
          <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? "Updating" : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
