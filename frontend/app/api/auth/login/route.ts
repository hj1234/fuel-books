import { NextResponse } from "next/server";

import { fbFetch, setAccessTokenCookie } from "@/lib/server/fbApi";

type LoginRequest = { email: string; password: string };
type TokenResponse = { access_token: string; token_type: string };

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

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as LoginRequest;
    const token = await fbFetch<TokenResponse>("/v1/auth/login-json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      skipAuth: true,
    });

    await setAccessTokenCookie(token.access_token);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (isFbErr(e)) return NextResponse.json(e.detail ?? { detail: "Login failed" }, { status: e.status });
    return NextResponse.json({ detail: "Login failed" }, { status: 500 });
  }
}

