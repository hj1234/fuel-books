"use client";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastInput = {
  message: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after N ms. Defaults 3500ms. Pass 0 to keep until dismissed. */
  durationMs?: number;
};

export type ToastItem = Required<Pick<ToastInput, "message" | "variant" | "durationMs">> & {
  id: string;
  description?: string;
  createdAt: number;
};

type Listener = (items: ToastItem[]) => void;

class ToastBus {
  private items: ToastItem[] = [];
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.items);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l(this.items);
  }

  push(input: ToastInput): string {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: ToastItem = {
      id,
      message: input.message,
      description: input.description,
      variant: input.variant ?? "info",
      durationMs: input.durationMs ?? 3500,
      createdAt: Date.now(),
    };
    this.items = [...this.items, item];
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
    this.notify();
  }

  clear() {
    this.items = [];
    this.notify();
  }
}

const bus = new ToastBus();

export const toast = {
  show: (input: ToastInput) => bus.push(input),
  success: (message: string, opts?: Omit<ToastInput, "message" | "variant">) =>
    bus.push({ ...opts, message, variant: "success" }),
  error: (message: string, opts?: Omit<ToastInput, "message" | "variant">) =>
    bus.push({ ...opts, message, variant: "error" }),
  info: (message: string, opts?: Omit<ToastInput, "message" | "variant">) =>
    bus.push({ ...opts, message, variant: "info" }),
  warning: (message: string, opts?: Omit<ToastInput, "message" | "variant">) =>
    bus.push({ ...opts, message, variant: "warning" }),
  dismiss: (id: string) => bus.dismiss(id),
  clear: () => bus.clear(),
};

export const toastBus = bus;
