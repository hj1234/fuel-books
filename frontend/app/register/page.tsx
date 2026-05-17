"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail?.detail ?? body?.detail ?? "Registration failed");
      return;
    }

    router.push("/aircraft");
    router.refresh();
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up an admin user for your Fuel Books workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]" href="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
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

        <FormField label="Full name">
          {({ id }) => (
            <Input
              id={id}
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label="Password" helper="At least 8 characters.">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
