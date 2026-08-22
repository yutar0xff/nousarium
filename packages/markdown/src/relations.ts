export type NoteRelation = {
  key: string;
  target: string;
};

const RELATION_HEADING = /^## 関係\s*$/m;
const NEXT_HEADING = /^## /gm;
const RELATION_LINE =
  /^- (?:([A-Za-z][\w-]*):\s*)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/;

export function resolveWikiTarget(target: string): string {
  const trimmed = target.trim().replace(/\.md$/, "");
  if (!trimmed) return "";
  if (trimmed.includes("/")) return `${trimmed}.md`;
  return `Notes/${trimmed}.md`;
}

export function isNotePath(path: string): boolean {
  return path.startsWith("Notes/") && path.endsWith(".md") && !path.slice("Notes/".length).includes("/");
}

export function isJournalPath(path: string): boolean {
  return path.startsWith("Journal/Conversations/") && path.endsWith(".md");
}

export function noteTitleFromPath(path: string): string {
  return path.replace(/^Notes\//, "").replace(/\.md$/, "");
}

export function journalTargetFromPath(path: string): string {
  return path.replace(/\.md$/, "");
}

export function readRelations(markdown: string): NoteRelation[] {
  const section = relationSection(markdown);
  if (!section) return [];
  const relations: NoteRelation[] = [];
  for (const line of section.body.split("\n")) {
    const match = RELATION_LINE.exec(line.trim());
    const target = match?.[2]?.trim();
    if (!match || !target) continue;
    relations.push({ key: match[1] ?? "", target });
  }
  return relations;
}

export function addRelation(markdown: string, key: string, target: string, label?: string): string {
  const existing = readRelations(markdown);
  if (existing.some((relation) => sameTarget(relation.target, target))) return markdown;
  const line = relationLine(key, target, label);
  const section = relationSection(markdown);
  if (!section) {
    return `${markdown.replace(/\s+$/, "")}\n\n## 関係\n\n${line}\n`;
  }
  const body = section.body.replace(/\s+$/, "");
  const nextBody = body ? `${body}\n${line}\n` : `${line}\n`;
  return `${markdown.slice(0, section.start)}${nextBody}${markdown.slice(section.end)}`;
}

function sameTarget(left: string, right: string): boolean {
  return resolveWikiTarget(left) === resolveWikiTarget(right);
}

function relationLine(key: string, target: string, label?: string): string {
  const link = label && label !== target ? `[[${target}|${label}]]` : `[[${target}]]`;
  return key ? `- ${key}: ${link}` : `- ${link}`;
}

function relationSection(markdown: string): { start: number; end: number; body: string } | null {
  const heading = RELATION_HEADING.exec(markdown);
  if (!heading || heading.index == null) return null;
  const bodyStart = heading.index + heading[0].length;
  const after = markdown.slice(bodyStart).replace(/^\r?\n/, "");
  const start = markdown.length - after.length;
  NEXT_HEADING.lastIndex = 0;
  const next = NEXT_HEADING.exec(after);
  const end = next ? start + next.index : markdown.length;
  return { start, end, body: markdown.slice(start, end) };
}
