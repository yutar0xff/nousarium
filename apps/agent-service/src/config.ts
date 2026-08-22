import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadDotEnv();

function findRepoRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function resolveConfiguredPath(value: string): string {
  if (path.isAbsolute(value)) return value;
  return path.resolve(findRepoRoot(), value);
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`missing env ${name}`);
  return value;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 8787),
    vaultPath: resolveConfiguredPath(required("NOUSARIUM_VAULT_PATH", "./data/vault")),
    runtimePath: resolveConfiguredPath(required("NOUSARIUM_RUNTIME_PATH", "./data/runtime")),
    appSecret: required("NOUSARIUM_APP_SECRET", "dev-secret"),
    cursorApiKey: process.env.CURSOR_API_KEY,
    cursorModel: process.env.CURSOR_MODEL ?? "auto",
    webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000",
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
