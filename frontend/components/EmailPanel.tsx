"use client";

import { CheckCircle2, MailWarning } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardSection, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/toast";

export function EmailPanel({
  email,
  verifiedAt,
}: {
  email: string;
  verifiedAt: string | null;
}) {
  const verified = Boolean(verifiedAt);

  return (
    <Card padded={false}>
      <CardSection>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Email</CardTitle>
            <p className="mt-1 truncate text-sm text-fg-muted">{email}</p>
          </div>
          {verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-fg ring-1 ring-[color:var(--border)]">
              <CheckCircle2 size={12} className="text-[color:var(--accent)]" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--danger-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--danger-soft-fg)]">
              <MailWarning size={12} aria-hidden="true" />
              Unverified
            </span>
          )}
        </div>

        {!verified ? <ResendVerification /> : null}
      </CardSection>

      <CardSection>
        <ChangeEmailForm currentEmail={email} />
      </CardSection>
    </Card>
  );
}

function ResendVerification() {
  const [sending, setSending] = useState(false);

  async function onClick() {
    setSending(true);
    const res = await fetch("/api/fb/v1/auth/email/verify/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    setSending(false);
    if (res.ok || res.status === 204) {
      toast.success("Verification email sent");
    } else {
      const body = await res.json().catch(() => null);
      toast.error(body?.detail?.detail ?? body?.detail ?? "Send failed");
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3">
      <p className="text-sm text-fg-muted">
        We&apos;ll send a fresh confirmation link to your inbox.
      </p>
      <Button variant="secondary" size="sm" onClick={onClick} loading={sending} className="ml-auto">
        {sending ? "Sending" : "Resend"}
      </Button>
    </div>
  );
}

function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError("That is already your email.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/fb/v1/auth/email/change/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ new_email: newEmail, current_password: password }),
    });
    setSending(false);

    if (res.ok || res.status === 204) {
      setSent(newEmail);
      setNewEmail("");
      setPassword("");
      toast.success("Confirmation sent");
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.detail?.detail ?? body?.detail ?? "Request failed");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <CardTitle>Change email</CardTitle>
        <p className="mt-1 text-sm text-fg-muted">
          We&apos;ll send a confirmation link to the new address. Your current email stays in
          place until you click it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="New email" required>
          {({ id }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="Current password" required>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </FormField>
      </div>

      {sent ? (
        <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-fg ring-1 ring-[color:var(--border)]">
          Confirmation link sent to <span className="font-medium">{sent}</span>. The change
          takes effect once that link is clicked.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={sending}>
          {sending ? "Sending" : "Send confirmation"}
        </Button>
      </div>
    </form>
  );
}
