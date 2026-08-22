export type NoteListItem = {
  path: string;
  title: string;
  tags: string[];
  updatedAt: string | null;
};

export type TagFolder = {
  segment: string;
  path: string;
  children: TagFolder[];
  notes: NoteListItem[];
  count: number;
};

type InternalFolder = {
  segment: string;
  path: string;
  children: Map<string, InternalFolder>;
  notes: NoteListItem[];
};

export function asTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(normalizeTag).filter(Boolean);
  if (typeof value === "string" && value) {
    const tag = normalizeTag(value);
    return tag ? [tag] : [];
  }
  return [];
}

export function titleFrom(path: string, content: string, aliases: unknown): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1];
  if (heading) return heading.trim();
  if (Array.isArray(aliases) && aliases[0]) return String(aliases[0]);
  return path.replace(/^Notes\//, "").replace(/\.md$/, "");
}

export function filesHref(opts: { tag?: string | null; untagged?: boolean; path?: string | null }): string {
  const params = new URLSearchParams();
  if (opts.untagged) params.set("untagged", "1");
  else if (opts.tag) params.set("tag", opts.tag);
  if (opts.path) params.set("path", opts.path);
  const query = params.toString();
  return query ? `/files?${query}` : "/files";
}

export function notesInSelection(
  items: NoteListItem[],
  selection: { tag: string | null; untagged: boolean },
): NoteListItem[] {
  if (selection.untagged) return items.filter((item) => item.tags.length === 0);
  if (!selection.tag) return items;
  const prefix = selection.tag;
  return items.filter((item) => item.tags.some((tag) => tag === prefix || tag.startsWith(`${prefix}/`)));
}

export function noteHref(item: NoteListItem, folderPath?: string): string {
  if (folderPath) return filesHref({ tag: folderPath, path: item.path });
  if (item.tags.length === 0) return filesHref({ untagged: true, path: item.path });
  return filesHref({ tag: item.tags[0], path: item.path });
}

export function buildTagTree(items: NoteListItem[]): { folders: TagFolder[]; untagged: NoteListItem[] } {
  const roots = new Map<string, InternalFolder>();
  const untagged: NoteListItem[] = [];

  for (const item of items) {
    if (item.tags.length === 0) {
      untagged.push(item);
      continue;
    }
    const seen = new Set<string>();
    for (const tag of item.tags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      ensureFolder(roots, tag).notes.push(item);
    }
  }

  untagged.sort(compareNotes);
  return {
    folders: [...roots.values()].map(toFolder).sort(compareFolders),
    untagged,
  };
}

export function filterTagTree(
  folders: TagFolder[],
  untagged: NoteListItem[],
  query: string,
): { folders: TagFolder[]; untagged: NoteListItem[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { folders, untagged };

  function matchNote(item: NoteListItem) {
    return item.title.toLowerCase().includes(needle) || item.tags.some((tag) => tag.toLowerCase().includes(needle));
  }

  function filterFolder(folder: TagFolder): TagFolder | null {
    const selfMatch = folder.segment.toLowerCase().includes(needle) || folder.path.toLowerCase().includes(needle);
    if (selfMatch) return folder;
    const children = folder.children.map(filterFolder).filter((child): child is TagFolder => child !== null);
    const notes = folder.notes.filter(matchNote);
    if (children.length === 0 && notes.length === 0) return null;
    return { ...folder, children, notes };
  }

  return {
    folders: folders.map(filterFolder).filter((folder): folder is TagFolder => folder !== null),
    untagged: untagged.filter(matchNote),
  };
}

function normalizeTag(value: string): string {
  return value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function ensureFolder(roots: Map<string, InternalFolder>, tag: string): InternalFolder {
  const parts = tag.split("/").filter(Boolean);
  let map = roots;
  let prefix = "";
  let node: InternalFolder | undefined;
  for (const part of parts) {
    prefix = prefix ? `${prefix}/${part}` : part;
    let next = map.get(part);
    if (!next) {
      next = { segment: part, path: prefix, children: new Map(), notes: [] };
      map.set(part, next);
    }
    node = next;
    map = next.children;
  }
  if (!node) {
    throw new Error("empty tag");
  }
  return node;
}

function toFolder(node: InternalFolder): TagFolder {
  const children = [...node.children.values()].map(toFolder).sort(compareFolders);
  const paths = new Set(node.notes.map((note) => note.path));
  collectNotePaths({ children, notes: node.notes }, paths);
  return {
    segment: node.segment,
    path: node.path,
    children,
    notes: node.notes.slice().sort(compareNotes),
    count: paths.size,
  };
}

function collectNotePaths(folder: { children: TagFolder[]; notes: NoteListItem[] }, paths: Set<string>) {
  for (const note of folder.notes) paths.add(note.path);
  for (const child of folder.children) collectNotePaths(child, paths);
}

function compareFolders(a: TagFolder, b: TagFolder) {
  return a.segment.localeCompare(b.segment, "ja");
}

function compareNotes(a: NoteListItem, b: NoteListItem) {
  return a.title.localeCompare(b.title, "ja");
}
