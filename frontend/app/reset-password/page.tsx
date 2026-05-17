"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(search.get("token"));
  }, [search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    if (next.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/fb/v1/auth/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, new_password: next }),
    });
    setLoading(false);

    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Reset failed");
      return;
    }

    router.push("/login?reset=1");
  }

  if (!token) {
    return (
      <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
        This reset link is missing its token. Request a new one from{" "}
        <Link href="/forgot-password" className="underline">
          forgot password
        </Link>
        .
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <FormField label="New password" required>
        {({ id }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            autoFocus
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
            required
            minLength={8}
          />
        )}
      </FormField>

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="md" loading={loading} fullWidth>
        {loading ? "Updating" : "Set new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Pick something you'll remember; we'll sign you back in afterwards."
    >
      <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
