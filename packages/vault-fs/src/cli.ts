#!/usr/bin/env tsx
import { initializeVault } from "./init.js";
import path from "node:path";

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--path");
const target = pathIndex >= 0 ? args[pathIndex + 1] : args[0];
if (!target) {
  console.error("usage: pnpm vault:init --path /srv/nousarium/vault");
  process.exit(1);
}

const cwd = process.env.INIT_CWD ?? process.cwd();
const resolved = path.resolve(cwd, target);
await initializeVault(resolved);
console.log(`initialized vault at ${resolved}`);
