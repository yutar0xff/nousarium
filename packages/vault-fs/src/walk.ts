import { readdir } from "node:fs/promises";
import path from "node:path";
import { isProtectedVaultPath } from "./access.js";
import { resolveVaultPath, toVaultRelative } from "./paths.js";

export async function walkMarkdown(
  root: string,
  visit: (relative: string, full: string) => Promise<void>,
  prefix = "",
): Promise<void> {
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      const relative = toVaultRelative(root, full);
      if (entry.isDirectory()) {
        if (isProtectedVaultPath(relative)) continue;
        await walk(full);
      } else if (entry.name.endsWith(".md")) await visit(relative, full);
    }
  }
  const start = prefix ? resolveVaultPath(root, prefix) : root;
  await walk(start);
}
