"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";

type Status = "pending" | "success" | "error";

function VerifyEmailInner() {
  const search = useSearchParams();
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const token = search.get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    (async () => {
      const res = await fetch("/api/fb/v1/auth/email/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok || res.status === 204) {
        setStatus("success");
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus("error");
      setMessage(body?.detail?.detail ?? body?.detail ?? "Verification failed");
    })();
  }, [search]);

  if (status === "pending") {
    return (
      <div className="text-sm text-fg-muted" aria-live="polite">
        Confirming your email
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-muted px-4 py-4 text-sm text-fg ring-1 ring-[color:var(--border)]">
          Your email is verified. Thanks!
        </div>
        <Link href="/aircraft" className="block">
          <Button variant="primary" fullWidth>
            Continue to Fuel Books
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-soft-fg)] ring-1 ring-[color:var(--danger-soft)]">
        {message ?? "Verification failed"}
      </div>
      <Link href="/account" className="block">
        <Button variant="ghost" fullWidth>
          Go to account to resend
        </Button>
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify email" subtitle="One sec while we confirm your address.">
      <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
        <VerifyEmailInner />
      </Suspense>
    </AuthShell>
  );
}
