import { createFsVault, VaultConflictError } from "./fs-vault.js";
import { createGitVersionControl } from "./git.js";
import { resolveVaultPath } from "./paths.js";
import { initializeVault } from "./init.js";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vault-fs", () => {
  it("rejects path escape", () => {
    expect(() => resolveVaultPath("/tmp/vault", "../secret")).toThrow(/escapes/);
  });

  it("detects save conflicts and records git runs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      const git = createGitVersionControl(dir);
      await git.ensureRepo();
      const first = await vault.save({
        path: "00_Inbox/test.md",
        content: "one",
        expectedHash: null,
      });
      await git.checkpoint("init");
      await expect(
        vault.save({ path: "00_Inbox/test.md", content: "two", expectedHash: "stale" }),
      ).rejects.toBeInstanceOf(VaultConflictError);
      await vault.save({ path: "00_Inbox/test.md", content: "two", expectedHash: first.hash });
      const after = await git.commitRun("run-1", "edit");
      expect(after).toBeTruthy();
      const diffs = await git.diff((await git.currentHead()) ? `${after}^` : "HEAD");
      expect(diffs.some((diff) => diff.path.endsWith("00_Inbox/test.md"))).toBe(true);
      await git.revertRun("run-1");
      const restored = await readFile(path.join(dir, "00_Inbox/test.md"), "utf8");
      expect(restored).toBe("one");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("creates expected directories", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      const top = await vault.list();
      expect(top.map((entry) => entry.name)).toContain("20_Knowledge");
      const template = await readFile(path.join(dir, "90_System/Templates/conversation.md"), "utf8");
      expect(template).toContain("type: conversation");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
