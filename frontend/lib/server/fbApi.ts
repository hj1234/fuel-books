import "server-only";

import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "fb_access_token";

function getBaseUrl(): string {
  const baseUrl = process.env.FASTAPI_BASE_URL;
  if (!baseUrl) {
    throw new Error("FASTAPI_BASE_URL is not set");
  }
  return baseUrl.replace(/\/+$/, "");
}

export type FbApiError = {
  status: number;
  detail: unknown;
};

export async function fbFetch<T>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, headers, ...rest } = init;

  const url = `${getBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;

  const h = new Headers(headers);
  h.set("accept", "application/json");

  if (!skipAuth) {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (token) h.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...rest,
    headers: h,
    cache: "no-store",
  });

  // FastAPI typically returns JSON bodies for errors; keep detail for UI.
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const err: FbApiError = { status: res.status, detail: body };
    throw err;
  }

  return body as T;
}

export async function setAccessTokenCookie(token: string) {
  (await cookies()).set(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAccessTokenCookie() {
  (await cookies()).set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

