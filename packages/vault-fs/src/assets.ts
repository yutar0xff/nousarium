import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveVaultPath, toVaultRelative } from "./paths.js";
import { walkMarkdown } from "./walk.js";

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const DEFAULT_UPLOAD_MAX_AGE_DAYS = 14;

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const UPLOAD_REF_RE = /_assets\/uploads\/[^\s)"'\]>]+/g;

export function isAllowedAssetMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

export function assetContentType(relative: string): string {
  const ext = path.extname(relative).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export function assertAssetPath(relative: string): string {
  const cleaned = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!cleaned.startsWith("_assets/")) {
    throw new Error("asset path must be under _assets/");
  }
  if (cleaned.includes("..") || cleaned.includes("\0")) {
    throw new Error("invalid asset path");
  }
  return cleaned;
}

function sanitizeBaseName(name: string): string {
  const base = name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 80);
  return base || "image";
}

export function buildUploadAssetPath(filename: string, mimeType: string, now = new Date()): string {
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) throw new Error("unsupported image type");
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "T",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  const stem = sanitizeBaseName(filename.replace(/\.[^.]+$/, ""));
  return `_assets/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${stamp}-${stem}${ext}`;
}

export function buildNoteAssetPath(noteTitle: string, sourceRelative: string): string {
  const dir = sanitizeBaseName(noteTitle.replace(/\.md$/i, ""));
  const base = path.basename(sourceRelative.replaceAll("\\", "/"));
  return `_assets/notes/${dir}/${base}`;
}

export async function writeVaultAsset(root: string, relative: string, data: Buffer): Promise<string> {
  if (data.byteLength === 0) throw new Error("empty asset");
  if (data.byteLength > MAX_ASSET_BYTES) throw new Error("asset too large");
  const safe = assertAssetPath(relative);
  const full = resolveVaultPath(root, safe);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return toVaultRelative(root, full);
}

export async function readVaultAsset(root: string, relative: string): Promise<{ data: Buffer; contentType: string }> {
  const safe = assertAssetPath(relative);
  const full = resolveVaultPath(root, safe);
  const data = await readFile(full);
  return { data, contentType: assetContentType(safe) };
}

export async function promoteUploadAsset(root: string, uploadRelative: string, noteTitle: string): Promise<string> {
  const src = assertAssetPath(uploadRelative);
  if (!src.startsWith("_assets/uploads/")) {
    throw new Error("source must be under _assets/uploads/");
  }
  let dest = assertAssetPath(buildNoteAssetPath(noteTitle, src));
  const srcFull = resolveVaultPath(root, src);
  let destFull = resolveVaultPath(root, dest);
  await mkdir(path.dirname(destFull), { recursive: true });
  try {
    await stat(destFull);
    const ext = path.extname(dest);
    const stem = dest.slice(0, -ext.length);
    dest = assertAssetPath(`${stem}-${Date.now()}${ext}`);
    destFull = resolveVaultPath(root, dest);
  } catch {
    // dest free
  }
  await rename(srcFull, destFull);
  return toVaultRelative(root, destFull);
}

async function collectNoteUploadRefs(root: string): Promise<Set<string>> {
  const refs = new Set<string>();
  await walkMarkdown(
    root,
    async (_relative, full) => {
      const text = await readFile(full, "utf8");
      for (const match of text.matchAll(UPLOAD_REF_RE)) {
        const cleaned = match[0].replace(/[.,;:!?]+$/, "");
        try {
          refs.add(assertAssetPath(cleaned));
        } catch {
          // ignore malformed
        }
      }
    },
    "Notes",
  );
  return refs;
}

async function walkUploadFiles(root: string, visit: (relative: string, full: string) => Promise<void>): Promise<void> {
  const uploadsRoot = resolveVaultPath(root, "_assets/uploads");
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        await visit(toVaultRelative(root, full), full);
      }
    }
  }
  await walk(uploadsRoot);
}

async function removeEmptyDirs(dir: string, stopAt: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirs(path.join(dir, entry.name), stopAt);
    }
  }
  if (path.resolve(dir) === path.resolve(stopAt)) return;
  try {
    const again = await readdir(dir);
    if (again.length === 0) await rm(dir, { recursive: false });
  } catch {
    // gone or not empty
  }
}

export type CleanupUploadsOptions = {
  maxAgeDays?: number;
  dryRun?: boolean;
  now?: Date;
};

export type CleanupUploadsResult = {
  deleted: string[];
  skippedReferenced: string[];
  skippedFresh: string[];
  dryRun: boolean;
  maxAgeDays: number;
};

export async function cleanupUploadAssets(root: string, options: CleanupUploadsOptions = {}): Promise<CleanupUploadsResult> {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_UPLOAD_MAX_AGE_DAYS;
  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 1) {
    throw new Error("maxAgeDays must be >= 1");
  }
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const refs = await collectNoteUploadRefs(root);
  const deleted: string[] = [];
  const skippedReferenced: string[] = [];
  const skippedFresh: string[] = [];

  await walkUploadFiles(root, async (relative, full) => {
    const safe = assertAssetPath(relative);
    if (refs.has(safe)) {
      skippedReferenced.push(safe);
      return;
    }
    const info = await stat(full);
    if (now.getTime() - info.mtimeMs < maxAgeMs) {
      skippedFresh.push(safe);
      return;
    }
    if (!dryRun) await unlink(full);
    deleted.push(safe);
  });

  if (!dryRun) {
    const uploadsRoot = resolveVaultPath(root, "_assets/uploads");
    await removeEmptyDirs(uploadsRoot, uploadsRoot);
  }

  return { deleted, skippedReferenced, skippedFresh, dryRun, maxAgeDays };
}

export const VAULT_ASSET_MAX_BYTES = MAX_ASSET_BYTES;
export const VAULT_UPLOAD_DEFAULT_MAX_AGE_DAYS = DEFAULT_UPLOAD_MAX_AGE_DAYS;
