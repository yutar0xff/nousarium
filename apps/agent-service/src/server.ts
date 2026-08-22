import { createAgentPort } from "@nousarium/agent-cursor";
import { createFsVault, createGitVersionControl, initializeVault } from "@nousarium/vault-fs";
import { serve } from "@hono/node-server";
import { mkdir } from "node:fs/promises";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createSqliteStore } from "./store.js";

const config = loadConfig();
await mkdir(config.runtimePath, { recursive: true });
await initializeVault(config.vaultPath);
const vault = createFsVault(config.vaultPath);
const git = createGitVersionControl(config.vaultPath);
await git.ensureRepo();
const store = createSqliteStore(config.runtimePath);
const agent = createAgentPort({
  apiKey: config.cursorApiKey,
  model: config.cursorModel,
  storePath: `${config.runtimePath}/cursor-agents`,
});
const app = createApp({ config, store, vault, git, agent });

serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" });
console.log(`agent-service listening on ${config.port}`);
