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
  if (!headers.has("content-type") && init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
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
  const response = await authorizedFetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return (await response.json()) as T;
}

export async function fetchVaultRaw(path: string): Promise<Blob> {
  const response = await authorizedFetch(`/vault/raw?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.blob();
}

export async function uploadVaultAsset(input: {
  filename: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  file: File;
}): Promise<{ path: string; mimeType: string; bytes: number }> {
  const contentBase64 = await fileToBase64(input.file);
  return api("/vault/assets", {
    method: "POST",
    body: JSON.stringify({
      filename: input.filename,
      mimeType: input.mimeType,
      contentBase64,
    }),
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
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
