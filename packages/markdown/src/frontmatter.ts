import yaml from "yaml";

export interface NoteFrontmatter {
  id?: string;
  type?: string;
  status?: string;
  created?: string;
  updated?: string;
  aliases?: string[];
  tags?: string[];
  projects?: string[];
  sources?: string[];
  confidence?: string;
  ai_access?: string;
  retention?: string;
  review_after?: string | null;
  [key: string]: unknown;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(markdown: string): { data: NoteFrontmatter; body: string } {
  const match = FENCE.exec(markdown);
  if (!match) return { data: {}, body: markdown };
  const parsed = yaml.parse(match[1] ?? "") as NoteFrontmatter | null;
  return { data: parsed ?? {}, body: markdown.slice(match[0].length) };
}

export function stringifyFrontmatter(data: NoteFrontmatter, body: string): string {
  const dumped = yaml.stringify(data).trimEnd();
  return `---\n${dumped}\n---\n\n${body.replace(/^\n+/, "")}`;
}
