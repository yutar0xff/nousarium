import { createAgentPort } from "@nousarium/agent-cursor";
import { createApp } from "./app.js";
import { createSqliteStore } from "./store.js";
import { createFsVault, createGitVersionControl, initializeVault } from "@nousarium/vault-fs";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "./config.js";

function testConfig(dir: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    vaultPath: path.join(dir, "vault"),
    runtimePath: path.join(dir, "runtime"),
    appSecret: "secret",
    cursorApiKey: undefined,
    cursorModel: "auto",
    webOrigins: ["http://127.0.0.1:3000"],
    azureSpeechKey: undefined,
    azureSpeechRegion: undefined,
    azureSpeechLanguage: "ja-JP",
    ...overrides,
  };
}

async function createTestApp(dir: string, overrides: Partial<AppConfig> = {}) {
  await initializeVault(path.join(dir, "vault"));
  const vaultPath = path.join(dir, "vault");
  const git = createGitVersionControl(vaultPath);
  await git.ensureRepo();
  return createApp({
    config: testConfig(dir, overrides),
    store: createSqliteStore(path.join(dir, "runtime")),
    vault: createFsVault(vaultPath),
    git,
    agent: createAgentPort({}),
  });
}

function parseSseEvents(body: string): unknown[] {
  return body
    .split("\n\n")
    .map((chunk) => chunk.split("\n").find((line) => line.startsWith("data:")))
    .filter(Boolean)
    .map((line) => JSON.parse(line!.slice(5).trim()));
}

describe("agent-service", () => {
  it("requires auth except health and login", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-svc-"));
    try {
      const app = await createTestApp(dir);
      const health = await app.request("/health");
      expect(health.status).toBe(200);
      const denied = await app.request("/conversations");
      expect(denied.status).toBe(401);
      const login = await app.request("/login", { method: "POST" });
      expect(login.status).toBe(200);
      const { token } = (await login.json()) as { token: string };
      const listed = await app.request("/conversations", { headers: { authorization: `Bearer ${token}` } });
      expect(listed.status).toBe(200);
      const models = await app.request("/models", { headers: { authorization: `Bearer ${token}` } });
      expect(models.status).toBe(200);
      const catalog = (await models.json()) as { default: string; models: Array<{ id: string; label: string }> };
      expect(catalog.default).toBe("auto");
      expect(catalog.models.some((model) => model.id === "auto")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("streams chat, persists messages, journal, and git run", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-flow-"));
    try {
      const app = await createTestApp(dir);
      const login = await app.request("/login", { method: "POST" });
      const { token } = (await login.json()) as { token: string };
      const auth = { authorization: `Bearer ${token}` };

      const created = await app.request("/conversations", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          model: "auto",
          accessPolicy: "chat",
        }),
      });
      expect(created.status).toBe(200);
      const conversation = (await created.json()) as { id: string; title: string };

      const streamed = await app.request(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ content: "知識は接続によって再利用可能になる" }),
      });
      expect(streamed.status).toBe(200);
      const events = parseSseEvents(await streamed.text());
      expect(events.some((event) => (event as { type?: string }).type === "conversation.titled")).toBe(true);
      expect(events.some((event) => (event as { type?: string }).type === "assistant.delta")).toBe(true);
      expect(events.some((event) => (event as { type?: string }).type === "note.proposed")).toBe(false);
      const finished = events.find((event) => (event as { type?: string }).type === "run.finished") as {
        status?: string;
        result?: string;
        diffs?: Array<{ path: string }>;
      };
      expect(finished?.status).toBe("finished");
      expect(finished?.result).toContain("知識は接続");
      expect(finished?.diffs?.some((diff) => diff.path.includes("Journal/Conversations/"))).toBe(true);

      const loaded = await app.request(`/conversations/${conversation.id}`, { headers: auth });
      expect(loaded.status).toBe(200);
      const payload = (await loaded.json()) as {
        conversation: { title: string; journalPath: string | null };
        messages: Array<{ role: string; content: string }>;
      };
      expect(payload.conversation.title).not.toBe("新しい対話");
      expect(payload.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
      expect(payload.conversation.journalPath).toBeTruthy();
      expect(existsSync(path.join(dir, "vault", payload.conversation.journalPath!))).toBe(true);
      const firstJournal = await readFile(path.join(dir, "vault", payload.conversation.journalPath!), "utf8");
      expect(firstJournal).toContain(`conversation_id: ${conversation.id}`);
      expect(firstJournal).toContain("## 参照・更新したノート");

      const runs = await app.request("/runs", { headers: auth });
      expect(runs.status).toBe(200);
      const runList = (await runs.json()) as Array<{ id: string; status: string }>;
      expect(runList).toHaveLength(1);
      expect(runList[0]?.status).toBe("finished");

      const excluded = await app.request(`/conversations/${conversation.id}/exclude`, {
        method: "POST",
        headers: auth,
      });
      expect(excluded.status).toBe(200);
      const journal = await readFile(path.join(dir, "vault", payload.conversation.journalPath!), "utf8");
      expect(journal).toMatch(/ai_access:\s*excluded/);
      const ignore = await readFile(path.join(dir, "vault", ".cursorignore"), "utf8");
      expect(ignore).toContain(payload.conversation.journalPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns note relations from journal wikilinks", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-rel-"));
    try {
      const app = await createTestApp(dir);
      const login = await app.request("/login", { method: "POST" });
      const { token } = (await login.json()) as { token: string };
      const auth = { authorization: `Bearer ${token}` };

      await app.request("/vault/file", {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          path: "Notes/可視.md",
          content: "# 可視\n",
          expectedHash: null,
        }),
      });

      const created = await app.request("/conversations", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ model: "auto", accessPolicy: "chat" }),
      });
      const conversation = (await created.json()) as { id: string };
      const streamed = await app.request(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ content: "[[可視]] について" }),
      });
      expect(streamed.status).toBe(200);
      await streamed.text();

      const relationsRes = await app.request("/notes/relations?path=Notes/%E5%8F%AF%E8%A6%96.md", { headers: auth });
      expect(relationsRes.status).toBe(200);
      const relations = (await relationsRes.json()) as {
        edited: Array<{ conversationId: string | null }>;
        referenced: Array<{ conversationId: string | null; title: string }>;
      };
      expect(relations.referenced.some((item) => item.conversationId === conversation.id)).toBe(true);

      const loaded = await app.request(`/conversations/${conversation.id}`, { headers: auth });
      const payload = (await loaded.json()) as { conversation: { journalPath: string } };
      const byJournal = await app.request(
        `/conversations/by-journal?path=${encodeURIComponent(payload.conversation.journalPath)}`,
        { headers: auth },
      );
      expect(byJournal.status).toBe(200);
      const found = (await byJournal.json()) as { conversation: { id: string } | null };
      expect(found.conversation?.id).toBe(conversation.id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 503 for speech token when azure is not configured", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-speech-"));
    try {
      const app = await createTestApp(dir);
      const login = await app.request("/login", { method: "POST" });
      const { token } = (await login.json()) as { token: string };
      const denied = await app.request("/speech/token");
      expect(denied.status).toBe(401);
      const missing = await app.request("/speech/token", { headers: { authorization: `Bearer ${token}` } });
      expect(missing.status).toBe(503);
      const health = await app.request("/health");
      const body = (await health.json()) as { azureSpeech: boolean };
      expect(body.azureSpeech).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("issues speech token when azure is configured", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-speech-ok-"));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("speech-token-value", { status: 200 }),
    );
    try {
      const app = await createTestApp(dir, {
        azureSpeechKey: "test-key",
        azureSpeechRegion: "japaneast",
        azureSpeechLanguage: "ja-JP",
      });
      const login = await app.request("/login", { method: "POST" });
      const { token } = (await login.json()) as { token: string };
      const issued = await app.request("/speech/token", { headers: { authorization: `Bearer ${token}` } });
      expect(issued.status).toBe(200);
      const payload = (await issued.json()) as { token: string; region: string; language: string };
      expect(payload).toEqual({
        token: "speech-token-value",
        region: "japaneast",
        language: "ja-JP",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://japaneast.api.cognitive.microsoft.com/sts/v1.0/issueToken",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Ocp-Apim-Subscription-Key": "test-key",
          }),
        }),
      );
    } finally {
      fetchMock.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uploads and serves vault image assets", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-asset-api-"));
    try {
      const app = await createTestApp(dir);
      const login = await app.request("/login", { method: "POST" });
      const { token } = (await login.json()) as { token: string };
      const auth = { authorization: `Bearer ${token}` };
      const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const uploaded = await app.request("/vault/assets", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          filename: "shot.png",
          mimeType: "image/png",
          contentBase64: bytes.toString("base64"),
        }),
      });
      expect(uploaded.status).toBe(200);
      const body = (await uploaded.json()) as { path: string; bytes: number };
      expect(body.path.startsWith("_assets/uploads/")).toBe(true);
      expect(body.bytes).toBe(bytes.byteLength);

      const raw = await app.request(`/vault/raw?path=${encodeURIComponent(body.path)}`, { headers: auth });
      expect(raw.status).toBe(200);
      expect(raw.headers.get("content-type")).toBe("image/png");
      const served = Buffer.from(await raw.arrayBuffer());
      expect(served.equals(bytes)).toBe(true);

      const denied = await app.request("/vault/raw?path=Notes/x.png", { headers: auth });
      expect(denied.status).toBe(404);

      const cleanup = await app.request("/vault/assets/cleanup", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ maxAgeDays: 14, dryRun: true }),
      });
      expect(cleanup.status).toBe(200);
      const cleaned = (await cleanup.json()) as { dryRun: boolean; deleted: string[] };
      expect(cleaned.dryRun).toBe(true);
      expect(Array.isArray(cleaned.deleted)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
