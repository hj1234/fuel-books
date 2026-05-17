import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "fb_access_token";

function getBaseUrl(): string {
  const baseUrl = process.env.FASTAPI_BASE_URL;
  if (!baseUrl) throw new Error("FASTAPI_BASE_URL is not set");
  return baseUrl.replace(/\/+$/, "");
}

async function forward(req: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params;

  // Prevent accidentally exposing internal job endpoints via this proxy.
  if (path[0] === "internal") {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  const inUrl = new URL(req.url);
  const targetPath = `/${path.join("/")}${inUrl.search}`;
  const url = `${getBaseUrl()}${targetPath}`;

  const h = new Headers();
  h.set("accept", "application/json");

  const contentType = req.headers.get("content-type");
  if (contentType) h.set("content-type", contentType);

  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) h.set("authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    method: req.method,
    headers: h,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    cache: "no-store",
  });

  // Null-body statuses (1xx, 204, 205, 304) cannot legally have a body per the
  // Fetch spec — constructing a Response with one throws. Forward as-is with no body.
  if (isNullBodyStatus(res.status)) {
    return new NextResponse(null, { status: res.status });
  }

  const outContentType = res.headers.get("content-type") ?? "";
  if (outContentType.includes("application/json")) {
    const json = await res.json().catch(() => null);
    return NextResponse.json(json, { status: res.status });
  }

  const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
  const headers: Record<string, string> = {};
  if (outContentType) headers["content-type"] = outContentType;
  const disp = res.headers.get("content-disposition");
  if (disp) headers["content-disposition"] = disp;
  return new NextResponse(buf, { status: res.status, headers });
}

function isNullBodyStatus(status: number): boolean {
  return status === 101 || status === 103 || status === 204 || status === 205 || status === 304;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    return await forward(req, ctx.params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    return await forward(req, ctx.params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    return await forward(req, ctx.params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    return await forward(req, ctx.params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    return await forward(req, ctx.params);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

