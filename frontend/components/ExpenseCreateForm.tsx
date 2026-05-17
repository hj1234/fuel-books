"use client";

import { Plane } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type PilotOut = { id: string; name: string; email: string | null };

function toLocalDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type FieldKey =
  | "purchasedDate"
  | "countryCode"
  | "airfieldCode"
  | "vendor"
  | "volume"
  | "unit"
  | "totalAmount"
  | "currency"
  | "vatAmount"
  | "pilotId"
  | "notes";

const FIELD_LABELS: Record<FieldKey, string> = {
  purchasedDate: "Purchased date",
  countryCode: "Country",
  airfieldCode: "Airfield",
  vendor: "Vendor",
  volume: "Volume",
  unit: "Unit",
  totalAmount: "Total amount",
  currency: "Currency",
  vatAmount: "VAT amount",
  pilotId: "Pilot",
  notes: "Notes",
};

function locToFieldKey(loc: unknown): FieldKey | null {
  if (!Array.isArray(loc)) return null;
  const parts = loc.map(String);
  const last = parts.at(-1);
  switch (last) {
    case "purchased_at":
      return "purchasedDate";
    case "country_code":
      return "countryCode";
    case "airfield_code":
      return "airfieldCode";
    case "vendor":
      return "vendor";
    case "volume":
      return "volume";
    case "unit":
      return "unit";
    case "total_amount":
      return "totalAmount";
    case "currency":
      return "currency";
    case "vat_amount":
      return "vatAmount";
    case "pilot_id":
      return "pilotId";
    case "notes":
      return "notes";
    default:
      return null;
  }
}

function toFriendlyMessage(field: FieldKey | null, rawMsg: string): string {
  const msg = rawMsg.trim();

  if (msg === "Field required") {
    if (!field) return "Please fill in the required fields.";
    return `${FIELD_LABELS[field]} is required.`;
  }

  if (msg === "Input should be greater than 0") {
    if (!field) return "Value must be greater than 0.";
    return `${FIELD_LABELS[field]} must be greater than 0.`;
  }

  if (!field) return msg;
  return msg[0] ? `${FIELD_LABELS[field]}: ${msg[0].toLowerCase()}${msg.slice(1)}` : msg;
}

export function extractFieldErrors(detail: unknown): Partial<Record<FieldKey, string>> {
  if (!Array.isArray(detail)) return {};
  const out: Partial<Record<FieldKey, string>> = {};

  for (const item of detail) {
    if (!item || typeof item !== "object") continue;
    const obj = item as { loc?: unknown; msg?: unknown };
    const rawMsg = typeof obj.msg === "string" ? obj.msg : null;
    if (!rawMsg) continue;
    const key = locToFieldKey(obj.loc);
    if (!key) continue;
    if (!out[key]) out[key] = toFriendlyMessage(key, rawMsg);
  }

  return out;
}

export function formatApiErrorDetail(detail: unknown): string {
  if (!detail) return "Create failed";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const fieldErrs = extractFieldErrors(detail);
    if (Object.keys(fieldErrs).length) return "Please fix the highlighted fields.";

    const msgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as { msg?: unknown };
          const msg = typeof obj.msg === "string" ? obj.msg : null;
          if (msg) return msg;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .filter(Boolean);
    return msgs.length ? msgs.join(", ") : "Create failed";
  }

  if (detail && typeof detail === "object") {
    const maybe = detail as { detail?: unknown; message?: unknown; msg?: unknown };
    if (typeof maybe.detail === "string") return maybe.detail;
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.msg === "string") return maybe.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return "Create failed";
    }
  }

  return "Create failed";
}

export type ExpenseDraft = {
  purchasedDate: string;
  countryCode: string;
  airfieldCode: string;
  vendor: string;
  volume: string;
  unit: "L" | "GAL";
  totalAmount: string;
  currency: string;
  vatAmount: string;
  notes: string;
  pilotId: string;
};

export const DEFAULT_EXPENSE_DRAFT: ExpenseDraft = {
  purchasedDate: toLocalDateInputValue(new Date()),
  countryCode: "GB",
  airfieldCode: "",
  vendor: "",
  volume: "",
  unit: "L",
  totalAmount: "0",
  currency: "GBP",
  vatAmount: "",
  notes: "",
  pilotId: "",
};

export function ExpenseCreateForm({
  aircraftId,
  pilots,
  countries,
  currencies,
  value,
  onChange,
  onSubmit,
  loading,
  error,
  fieldErrors,
  submitLabel = "Calculate",
}: {
  aircraftId: string;
  pilots: PilotOut[];
  countries: string[];
  currencies: string[];
  value: ExpenseDraft;
  onChange: <K extends keyof ExpenseDraft>(key: K, val: ExpenseDraft[K]) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  fieldErrors: Partial<Record<FieldKey, string>>;
  submitLabel?: string;
}) {
  const pilotOptions = useMemo(
    () => [
      { id: "", name: pilots.length ? "Select a pilot…" : "No pilots yet" },
      ...pilots.map((p) => ({ id: p.id, name: p.name })),
    ],
    [pilots],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Card
        header={
          <div>
            <CardTitle>Add fuel expense</CardTitle>
            <CardDescription>Calculate the refund against your aircraft policy.</CardDescription>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            {error ? <span className="mr-auto text-xs text-danger">{error}</span> : null}
            <Button type="submit" variant="primary" loading={loading} disabled={pilots.length === 0}>
              {loading ? "Calculating" : submitLabel}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Purchased date" required error={fieldErrors.purchasedDate}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                type="date"
                value={value.purchasedDate}
                onChange={(e) => onChange("purchasedDate", e.target.value)}
                required
              />
            )}
          </FormField>
          <FormField label="Country" required error={fieldErrors.countryCode}>
            {({ id, invalid }) =>
              countries.length ? (
                <Select
                  id={id}
                  invalid={invalid}
                  value={value.countryCode}
                  onChange={(e) => onChange("countryCode", e.target.value.toUpperCase())}
                  required
                >
                  {countries
                    .map((c) => c.toUpperCase())
                    .filter(Boolean)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  invalid={invalid}
                  className="uppercase"
                  value={value.countryCode}
                  onChange={(e) => onChange("countryCode", e.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
              )
            }
          </FormField>
          <FormField label="Airfield" error={fieldErrors.airfieldCode} hint="ICAO">
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                className="uppercase"
                value={value.airfieldCode}
                onChange={(e) => onChange("airfieldCode", e.target.value.toUpperCase())}
                placeholder="EGLL"
                maxLength={4}
              />
            )}
          </FormField>
          <FormField label="Vendor" error={fieldErrors.vendor}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={value.vendor}
                onChange={(e) => onChange("vendor", e.target.value)}
                placeholder="Optional"
              />
            )}
          </FormField>
          <FormField label="Volume" required error={fieldErrors.volume}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={value.volume}
                onChange={(e) => onChange("volume", e.target.value)}
                inputMode="decimal"
                min="0"
                required
              />
            )}
          </FormField>
          <FormField label="Unit" required error={fieldErrors.unit}>
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={value.unit}
                onChange={(e) => onChange("unit", e.target.value as "L" | "GAL")}
                required
              >
                <option value="L">Litres</option>
                <option value="GAL">US Gallons</option>
              </Select>
            )}
          </FormField>
          <FormField label="Total amount" required error={fieldErrors.totalAmount}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={value.totalAmount}
                onChange={(e) => onChange("totalAmount", e.target.value)}
                inputMode="decimal"
                min="0"
                required
              />
            )}
          </FormField>
          <FormField
            label="Currency"
            required
            error={fieldErrors.currency}
            helper={
              currencies.length === 0
                ? "No currencies in the FX store yet — run an FX sync, or type a 3-letter code below."
                : undefined
            }
          >
            {({ id, invalid }) =>
              currencies.length ? (
                <Select
                  id={id}
                  invalid={invalid}
                  className="uppercase"
                  value={value.currency}
                  onChange={(e) => onChange("currency", e.target.value.toUpperCase())}
                  required
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  invalid={invalid}
                  className="uppercase"
                  value={value.currency}
                  onChange={(e) => onChange("currency", e.target.value.toUpperCase())}
                  maxLength={3}
                  required
                />
              )
            }
          </FormField>
          <FormField label="VAT amount" error={fieldErrors.vatAmount}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={value.vatAmount}
                onChange={(e) => onChange("vatAmount", e.target.value)}
                inputMode="decimal"
                placeholder="Optional"
              />
            )}
          </FormField>
          <FormField
            label="Pilot"
            error={fieldErrors.pilotId}
            helper={
              pilots.length === 0 ? (
                <>
                  <Plane size={12} className="mr-1 inline-block align-middle" />
                  You need to{" "}
                  <Link
                    className="font-medium text-fg underline underline-offset-4 hover:text-[color:var(--accent)]"
                    href={`/aircraft/${aircraftId}/pilots`}
                  >
                    add a pilot
                  </Link>{" "}
                  first.
                </>
              ) : undefined
            }
          >
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={value.pilotId}
                onChange={(e) => onChange("pilotId", e.target.value)}
                disabled={pilots.length === 0}
              >
                {pilotOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Notes" className="sm:col-span-2 lg:col-span-3" error={fieldErrors.notes}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={value.notes}
                onChange={(e) => onChange("notes", e.target.value)}
                placeholder="Optional"
              />
            )}
          </FormField>
        </div>
      </Card>
    </form>
  );
}
