import { createAgentPort } from "@nousarium/agent-cursor";
import { createApp } from "./app.js";
import { createSqliteStore } from "./store.js";
import { createFsVault, createGitVersionControl, initializeVault } from "@nousarium/vault-fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("agent-service", () => {
  it("requires auth except health and login", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-svc-"));
    try {
      await initializeVault(path.join(dir, "vault"));
      const app = createApp({
        config: {
          port: 0,
          vaultPath: path.join(dir, "vault"),
          runtimePath: path.join(dir, "runtime"),
          appSecret: "secret",
          cursorApiKey: undefined,
          cursorModel: "composer-2.5",
          webOrigin: "http://127.0.0.1:3000",
        },
        store: createSqliteStore(path.join(dir, "runtime")),
        vault: createFsVault(path.join(dir, "vault")),
        git: createGitVersionControl(path.join(dir, "vault")),
        agent: createAgentPort({}),
      });
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
});
