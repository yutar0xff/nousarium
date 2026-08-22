import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const base = process.env.AGENT_SERVICE_URL ?? "http://127.0.0.1:8787";

async function proxy(request: NextRequest, path: string[]) {
  const search = request.nextUrl.search;
  const url = `${base}/${path.join("/")}${search}`;
  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const upstream = await fetch(url, {
    method,
    headers,
    body,
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("X-Accel-Buffering", "no");
  responseHeaders.delete("content-encoding");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
