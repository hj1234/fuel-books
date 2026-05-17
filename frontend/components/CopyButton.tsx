"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/IconButton";
import { toast } from "@/components/ui/toast";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }

  return (
    <IconButton size="sm" label={`Copy ${label}`} onClick={copy}>
      {copied ? <Check size={14} className="text-[color:var(--success)]" /> : <Copy size={14} />}
    </IconButton>
  );
}
