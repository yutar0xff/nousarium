import type { SaveDocumentRequest, SearchHit, SearchQuery, VaultDocument, VaultEntry } from "@nousarium/contracts";
import type { VaultPort } from "@nousarium/core";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { hashContent } from "./hash.js";
import { resolveVaultPath, toVaultRelative } from "./paths.js";

export class VaultConflictError extends Error {
  override name = "VaultConflictError";
  constructor(
    public readonly path: string,
    public readonly currentHash: string,
  ) {
    super("vault conflict");
  }
}

export function createFsVault(root: string): VaultPort {
  return {
    async list(relative = "") {
      const dir = resolveVaultPath(root, relative);
      const entries = await readdir(dir, { withFileTypes: true });
      const result: VaultEntry[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".obsidian") continue;
        const full = path.join(dir, entry.name);
        const info = await stat(full);
        result.push({
          path: toVaultRelative(root, full),
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : "file",
          updatedAt: info.mtime.toISOString(),
        });
      }
      return result.sort((a, b) => a.path.localeCompare(b.path));
    },

    async read(relative) {
      const full = resolveVaultPath(root, relative);
      const content = await readFile(full, "utf8");
      return { path: relative, content, hash: hashContent(content) };
    },

    async save(input: SaveDocumentRequest) {
      const full = resolveVaultPath(root, input.path);
      await mkdir(path.dirname(full), { recursive: true });
      let currentHash: string | null = null;
      try {
        const existing = await readFile(full, "utf8");
        currentHash = hashContent(existing);
      } catch {
        currentHash = null;
      }
      if (input.expectedHash && currentHash && input.expectedHash !== currentHash) {
        throw new VaultConflictError(input.path, currentHash);
      }
      const temp = `${full}.${process.pid}.tmp`;
      await writeFile(temp, input.content, "utf8");
      await rename(temp, full);
      return { path: input.path, content: input.content, hash: hashContent(input.content) } satisfies VaultDocument;
    },

    async search(query: SearchQuery) {
      const hits: SearchHit[] = [];
      const limit = query.limit ?? 40;
      await walkMarkdown(root, async (relative, full) => {
        if (hits.length >= limit) return;
        const stream = createReadStream(full, { encoding: "utf8" });
        const rl = createInterface({ input: stream });
        let lineNo = 0;
        for await (const line of rl) {
          lineNo += 1;
          if (line.includes(query.q)) {
            hits.push({ path: relative, line: lineNo, preview: line.trim().slice(0, 240) });
            if (hits.length >= limit) break;
          }
        }
      });
      return hits;
    },

    async exists(relative) {
      try {
        await stat(resolveVaultPath(root, relative));
        return true;
      } catch {
        return false;
      }
    },

    async mkdir(relative) {
      await mkdir(resolveVaultPath(root, relative), { recursive: true });
    },
  };
}

async function walkMarkdown(root: string, visit: (relative: string, full: string) => Promise<void>): Promise<void> {
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".md")) await visit(toVaultRelative(root, full), full);
    }
  }
  await walk(root);
}
