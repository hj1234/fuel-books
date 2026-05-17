import { NextResponse } from "next/server";

import { fbFetch } from "@/lib/server/fbApi";

type MeResponse = { id: number; email: string; full_name: string };

type FbErr = { status: number; detail: unknown };
function isFbErr(e: unknown): e is FbErr {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as { status?: unknown }).status === "number" &&
    "detail" in e
  );
}

export async function GET() {
  try {
    const me = await fbFetch<MeResponse>("/v1/auth/me", { method: "GET" });
    return NextResponse.json(me);
  } catch (e: unknown) {
    if (isFbErr(e)) return NextResponse.json(e.detail ?? { detail: "Not authenticated" }, { status: e.status });
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
}

