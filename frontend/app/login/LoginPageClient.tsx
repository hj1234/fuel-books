"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { safeInternalNext } from "@/lib/safeInternalNext";

function LoginForm({
  nextPath,
  justReset,
}: {
  nextPath: string;
  justReset: boolean;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Login failed");
      return;
    }

    router.push(safeInternalNext(nextPath));
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {justReset ? (
        <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-fg ring-1 ring-[color:var(--border)]">
          Password updated. Sign in with your new password.
        </div>
      ) : null}

      <FormField label="Email">
        {({ id }) => (
          <Input
            id={id}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        )}
      </FormField>

      <FormField label="Password">
        {({ id }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
          />
        )}
      </FormField>

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="md" loading={loading} fullWidth>
        {loading ? "Signing in" : "Sign in"}
      </Button>

      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-xs text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

export default function LoginPageClient({
  nextPath,
  justReset,
}: {
  nextPath: string;
  justReset: boolean;
}) {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to continue."
      footer={
        <>
          No account?{" "}
          <Link
            className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]"
            href="/register"
          >
            Create one
          </Link>
        </>
      }
    >
      <LoginForm nextPath={nextPath} justReset={justReset} />
    </AuthShell>
  );
}
