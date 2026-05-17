import { NextResponse } from "next/server";

import { clearAccessTokenCookie } from "@/lib/server/fbApi";

export async function POST() {
  try {
    await clearAccessTokenCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

