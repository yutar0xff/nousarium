import path from "node:path";

export function resolveVaultPath(root: string, relative: string): string {
  const normalizedRoot = path.resolve(root);
  const cleaned = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  if (cleaned.includes("\0")) throw new Error("invalid path");
  const resolved = path.resolve(normalizedRoot, cleaned);
  const relativeToRoot = path.relative(normalizedRoot, resolved);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("path escapes vault");
  }
  return resolved;
}

export function toVaultRelative(root: string, absolute: string): string {
  return path.relative(path.resolve(root), absolute).split(path.sep).join("/");
}
