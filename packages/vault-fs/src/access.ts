import { parseFrontmatter } from "@nousarium/markdown";

export function isProtectedVaultPath(relative: string): boolean {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  return normalized === "_protected" || normalized.startsWith("_protected/");
}

export function isAiExcludedMarkdown(content: string): boolean {
  const { data } = parseFrontmatter(content);
  return data.ai_access === "excluded";
}
