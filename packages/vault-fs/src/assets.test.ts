import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertAssetPath,
  buildNoteAssetPath,
  buildUploadAssetPath,
  cleanupUploadAssets,
  isAllowedAssetMime,
  promoteUploadAsset,
  readVaultAsset,
  writeVaultAsset,
} from "./assets.js";

async function mkdtempSafe(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "nousarium-asset-"));
}

describe("vault assets", () => {
  it("builds upload paths under _assets/uploads", () => {
    const relative = buildUploadAssetPath("写真.PNG", "image/png", new Date("2026-08-25T03:04:05Z"));
    expect(relative).toBe("_assets/uploads/2026/08/20260825T030405-写真.png");
  });

  it("builds note asset paths under _assets/notes", () => {
    expect(buildNoteAssetPath("旅の記録", "_assets/uploads/2026/08/shot.png")).toBe(
      "_assets/notes/旅の記録/shot.png",
    );
  });

  it("rejects paths outside _assets", () => {
    expect(() => assertAssetPath("Notes/secret.png")).toThrow(/_assets/);
  });

  it("writes and reads binary assets", async () => {
    const dir = await mkdtempSafe();
    try {
      const relative = "_assets/uploads/2026/08/test.png";
      const bytes = Buffer.from([137, 80, 78, 71, 0, 1, 2, 3]);
      await writeVaultAsset(dir, relative, bytes);
      const saved = await readFile(path.join(dir, relative));
      expect(saved.equals(bytes)).toBe(true);
      const read = await readVaultAsset(dir, relative);
      expect(read.contentType).toBe("image/png");
      expect(read.data.equals(bytes)).toBe(true);
      expect(isAllowedAssetMime("image/webp")).toBe(true);
      expect(isAllowedAssetMime("application/pdf")).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("promotes uploads into note asset dirs", async () => {
    const dir = await mkdtempSafe();
    try {
      const upload = "_assets/uploads/2026/08/shot.png";
      const bytes = Buffer.from([1, 2, 3, 4]);
      await writeVaultAsset(dir, upload, bytes);
      const promoted = await promoteUploadAsset(dir, upload, "観察メモ");
      expect(promoted).toBe("_assets/notes/観察メモ/shot.png");
      const moved = await readFile(path.join(dir, promoted));
      expect(moved.equals(bytes)).toBe(true);
      await expect(readFile(path.join(dir, upload))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("cleanup keeps note-referenced and fresh uploads", async () => {
    const dir = await mkdtempSafe();
    try {
      const stale = "_assets/uploads/2026/01/old.png";
      const fresh = "_assets/uploads/2026/08/new.png";
      const kept = "_assets/uploads/2026/01/kept.png";
      await writeVaultAsset(dir, stale, Buffer.from("stale"));
      await writeVaultAsset(dir, fresh, Buffer.from("fresh"));
      await writeVaultAsset(dir, kept, Buffer.from("kept"));
      const old = new Date("2026-01-01T00:00:00Z");
      await utimes(path.join(dir, stale), old, old);
      await utimes(path.join(dir, kept), old, old);

      await mkdir(path.join(dir, "Notes"), { recursive: true });
      await writeFile(
        path.join(dir, "Notes", "写真.md"),
        "---\ntitle: 写真\n---\n\n![](_assets/uploads/2026/01/kept.png)\n",
        "utf8",
      );

      const result = await cleanupUploadAssets(dir, {
        maxAgeDays: 14,
        now: new Date("2026-08-25T12:00:00Z"),
      });
      expect(result.deleted).toEqual([stale]);
      expect(result.skippedReferenced).toContain(kept);
      expect(result.skippedFresh).toContain(fresh);
      await expect(readFile(path.join(dir, stale))).rejects.toThrow();
      await expect(readFile(path.join(dir, kept))).resolves.toBeTruthy();
      await expect(readFile(path.join(dir, fresh))).resolves.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
