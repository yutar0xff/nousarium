import { createAgentPort } from "@nousarium/agent-cursor";
import { createApp } from "./app.js";
import { createSqliteStore } from "./store.js";
import { createFsVault, createGitVersionControl, initializeVault } from "@nousarium/vault-fs";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function testConfig(dir: string) {
  return {
    port: 0,
    vaultPath: path.join(dir, "vault"),
    runtimePath: path.join(dir, "runtime"),
    appSecret: "secret",
    cursorApiKey: undefined,
    cursorModel: "auto",
    webOrigin: "http://127.0.0.1:3000",
  };
}

async function createTestApp(dir: string) {
  await initializeVault(path.join(dir, "vault"));
  const vaultPath = path.join(dir, "vault");
  const git = createGitVersionControl(vaultPath);
  await git.ensureRepo();
  return createApp({
    config: testConfig(dir),
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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("streams chat, persists messages, journal, note proposal, and git run", async () => {
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
          intent: "question",
          model: "auto",
          mode: "plan",
          accessPolicy: "read",
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
      expect(events.some((event) => (event as { type?: string }).type === "note.proposed")).toBe(true);
      const finished = events.find((event) => (event as { type?: string }).type === "run.finished") as {
        status?: string;
        result?: string;
      };
      expect(finished?.status).toBe("finished");
      expect(finished?.result).toContain("知識は接続");

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

      const runs = await app.request("/runs", { headers: auth });
      expect(runs.status).toBe(200);
      const runList = (await runs.json()) as Array<{ id: string; status: string }>;
      expect(runList).toHaveLength(1);
      expect(runList[0]?.status).toBe("finished");

      const proposalEvent = events.find((event) => (event as { type?: string }).type === "note.proposed") as {
        proposal: { path: string; content: string; title: string };
      };
      const saved = await app.request("/vault/file", {
        method: "PUT",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({
          path: proposalEvent.proposal.path,
          content: proposalEvent.proposal.content,
          expectedHash: null,
          overwrite: false,
        }),
      });
      expect(saved.status).toBe(200);
      expect(existsSync(path.join(dir, "vault", proposalEvent.proposal.path))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
