"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/fb/v1/auth/password/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    // The backend deliberately returns 204 regardless of whether the email
    // exists, so we show the same screen either way.
    if (res.ok || res.status === 204) {
      setSent(true);
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.detail?.detail ?? body?.detail ?? "Request failed");
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter the email on your account and we'll send a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link
            className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]"
            href="/login"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-muted px-4 py-4 text-sm text-fg ring-1 ring-[color:var(--border)]">
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
            password reset link. Check your inbox (and the uvicorn log in dev).
          </div>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
          >
            Send to a different email
          </Button>
        </div>
      ) : (
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

          {error ? (
            <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
              {error}
            </div>
          ) : null}

          <Button type="submit" variant="primary" size="md" loading={loading} fullWidth>
            {loading ? "Sending" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
