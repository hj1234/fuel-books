import { safeInternalNext } from "@/lib/safeInternalNext";

import LoginPageClient from "./LoginPageClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reset?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const reset = Array.isArray(sp.reset) ? sp.reset[0] : sp.reset;

  return (
    <LoginPageClient nextPath={safeInternalNext(rawNext)} justReset={reset === "1"} />
  );
}
