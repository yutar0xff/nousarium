import { createFsVault, VaultConflictError } from "./fs-vault.js";
import { createGitVersionControl } from "./git.js";
import { resolveVaultPath } from "./paths.js";
import { initializeVault } from "./init.js";
import { existsSync } from "node:fs";
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
        path: "Notes/test.md",
        content: "one",
        expectedHash: null,
      });
      await git.checkpoint("init");
      await expect(
        vault.save({ path: "Notes/test.md", content: "two", expectedHash: "stale" }),
      ).rejects.toBeInstanceOf(VaultConflictError);
      await vault.save({ path: "Notes/test.md", content: "two", expectedHash: first.hash });
      const after = await git.commitRun("run-1", "edit");
      expect(after).toBeTruthy();
      const diffs = await git.diff((await git.currentHead()) ? `${after}^` : "HEAD");
      expect(diffs.some((diff) => diff.path.endsWith("Notes/test.md"))).toBe(true);
      await git.revertRun("run-1");
      const restored = await readFile(path.join(dir, "Notes/test.md"), "utf8");
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
      expect(top.map((entry) => entry.name)).toContain("Notes");
      const template = await readFile(path.join(dir, "System/Templates/conversation.md"), "utf8");
      expect(template).toContain("type: [conversation]");
      expect(template).toContain("参照・更新したノート");
      expect(await readFile(path.join(dir, "AGENTS.md"), "utf8")).toContain("Nousarium");
      expect(await readFile(path.join(dir, "AGENTS.md"), "utf8")).toContain("分類の歪みに気づいたら提案する");
      expect(await readFile(path.join(dir, ".cursor/rules/note-format.mdc"), "utf8")).toContain("globs: Notes/**");
      expect(await readFile(path.join(dir, ".cursor/rules/note-format.mdc"), "utf8")).toContain("derived-from:");
      expect(await readFile(path.join(dir, ".cursor/rules/journal.mdc"), "utf8")).toContain("globs: Journal/**");
      expect(await readFile(path.join(dir, ".cursor/rules/journal.mdc"), "utf8")).toContain("conversation_id");
      expect(await readFile(path.join(dir, ".cursor/rules/system.mdc"), "utf8")).toContain("globs: System/**");
      expect(existsSync(path.join(dir, ".cursor/rules/knowledge.mdc"))).toBe(false);
      expect(existsSync(path.join(dir, ".cursor/rules/inbox.mdc"))).toBe(false);
      const tags = await readFile(path.join(dir, "System/Schemas/tags.md"), "utf8");
      expect(tags).toContain("思考");
      expect(tags).toContain("再構成の合図");
      expect(await readFile(path.join(dir, ".cursorignore"), "utf8")).toContain("_protected/");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite existing charter files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      await writeFile(path.join(dir, "AGENTS.md"), "custom charter\n", "utf8");
      await initializeVault(dir);
      expect(await readFile(path.join(dir, "AGENTS.md"), "utf8")).toBe("custom charter\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("regenerates .cursorignore from excluded notes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      await vault.save({
        path: "Notes/secret.md",
        content: `---
ai_access: excluded
---

secret phrase
`,
        expectedHash: null,
      });
      const ignore = await readFile(path.join(dir, ".cursorignore"), "utf8");
      expect(ignore).toContain("Notes/secret.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("excludes protected paths and ai_access excluded notes from search", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      await writeFile(
        path.join(dir, "Notes", "visible.md"),
        `---
ai_access: normal
---

hello world
`,
        "utf8",
      );
      await writeFile(
        path.join(dir, "Notes", "hidden.md"),
        `---
ai_access: excluded
---

secret phrase
`,
        "utf8",
      );
      await writeFile(path.join(dir, "_protected", "secret.md"), "protected phrase\n", "utf8");
      const hits = await vault.search({ q: "phrase" });
      expect(hits.map((hit) => hit.path)).toEqual([]);
      const visible = await vault.search({ q: "hello" });
      expect(visible.some((hit) => hit.path.endsWith("visible.md"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("lists staged changed paths and limits search by prefix", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      const git = createGitVersionControl(dir);
      await git.ensureRepo();
      await vault.save({ path: "Notes/可視.md", content: "[[可視]] in note", expectedHash: null });
      const head = await git.checkpoint("seed");
      await vault.save({
        path: "Journal/Conversations/2026/08/log.md",
        content: "- referenced: [[可視]]",
        expectedHash: null,
      });
      await vault.save({ path: "Notes/可視.md", content: "[[可視]] updated", expectedHash: (await vault.read("Notes/可視.md")).hash });
      const paths = await git.changedPaths(head);
      expect(paths).toContain("Notes/可視.md");
      expect(paths).toContain("Journal/Conversations/2026/08/log.md");
      const journalHits = await vault.search({ q: "[[可視]]", prefix: "Journal/Conversations" });
      expect(journalHits.every((hit) => hit.path.startsWith("Journal/Conversations/"))).toBe(true);
      expect(journalHits.some((hit) => hit.path.endsWith("log.md"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
