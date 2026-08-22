"use client";

const TOKEN_KEY = "nousarium-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  if (getToken()) return;
  if (!authPromise) {
    authPromise = (async () => {
      const response = await fetch("/api/backend/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("auth failed");
      const { token } = (await response.json()) as { token: string };
      setToken(token);
    })().finally(() => {
      authPromise = null;
    });
  }
  await authPromise;
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureAuth();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  let response = await fetch(`/api/backend${path}`, { ...init, headers });
  if (response.status === 401) {
    clearToken();
    await ensureAuth();
    const retryToken = getToken();
    if (retryToken) headers.set("authorization", `Bearer ${retryToken}`);
    response = await fetch(`/api/backend${path}`, { ...init, headers });
  }
  return response;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return (await response.json()) as T;
}

export async function streamMessage(
  conversationId: string,
  body: unknown,
  onEvent: (event: unknown) => void,
): Promise<void> {
  await ensureAuth();
  const token = getToken();
  const response = await fetch(`/api/backend/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error("stream failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((entry) => entry.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      onEvent(JSON.parse(data));
    }
  }
}
