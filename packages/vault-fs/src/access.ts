import { parseFrontmatter, stringifyFrontmatter } from "@nousarium/markdown";

export function isProtectedVaultPath(relative: string): boolean {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  return normalized === "_protected" || normalized.startsWith("_protected/");
}

export function isAiExcludedMarkdown(content: string): boolean {
  const { data } = parseFrontmatter(content);
  return data.ai_access === "excluded";
}

export function withAiAccess(content: string, value: "normal" | "excluded"): string {
  const { data, body } = parseFrontmatter(content);
  data.ai_access = value;
  return stringifyFrontmatter(data, body);
}
