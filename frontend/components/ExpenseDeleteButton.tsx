"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";

export function ExpenseDeleteButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    const res = await fetch(`/api/fb/v1/fuel-expenses/${expenseId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.detail?.detail ?? body?.detail ?? "Delete failed");
      return;
    }
    toast.success("Expense deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <IconButton
        size="sm"
        variant="danger"
        label="Delete expense"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={14} />
      </IconButton>
      <Modal
        open={open}
        onClose={() => (loading ? null : setOpen(false))}
        size="sm"
        title="Delete expense?"
        description="This cannot be undone. Any associated calculation will be removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={loading}>
              {loading ? "Deleting" : "Delete expense"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          Are you sure you want to delete this fuel expense?
        </p>
      </Modal>
    </>
  );
}
