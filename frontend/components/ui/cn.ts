export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const item of inputs) {
    if (!item) continue;
    if (Array.isArray(item)) {
      const nested = cn(...item);
      if (nested) out.push(nested);
      continue;
    }
    out.push(String(item));
  }
  return out.join(" ");
}
