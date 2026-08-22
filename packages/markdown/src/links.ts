export function extractWikiLinks(markdown: string): string[] {
  const links = [...markdown.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)];
  return [...new Set(links.map((match) => (match[1] ?? "").trim()).filter(Boolean))];
}

export function extractTags(markdown: string): string[] {
  const tags = [...markdown.matchAll(/(^|\s)#([\p{Script=Han}\p{L}\d/_-]+)/gu)];
  return [...new Set(tags.map((match) => match[2]).filter((tag): tag is string => Boolean(tag)))];
}
