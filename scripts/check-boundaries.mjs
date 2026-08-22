#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const rules = [
  {
    dir: "packages/core",
    forbidden: ["@cursor/sdk", "next", "@codemirror", "codemirror", "node:fs", "node:fs/promises", "better-sqlite3"],
  },
  {
    dir: "packages/contracts",
    forbidden: ["@cursor/sdk", "next", "@codemirror", "codemirror", "node:fs", "better-sqlite3"],
  },
  {
    dir: "packages/markdown",
    forbidden: ["@cursor/sdk", "next", "@codemirror", "codemirror"],
  },
  {
    dir: "packages/ui",
    forbidden: ["@cursor/sdk", "next", "node:fs", "better-sqlite3"],
  },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let failed = false;
for (const rule of rules) {
  const abs = path.join(root, rule.dir);
  try {
    await stat(abs);
  } catch {
    continue;
  }
  const files = await walk(abs);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pkg of rule.forbidden) {
      const pattern = new RegExp(`from ["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/[^"']*)?["']`);
      if (pattern.test(text) || text.includes(`require("${pkg}`)) {
        console.error(`boundary: ${path.relative(root, file)} imports ${pkg}`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
console.log("boundary check passed");
