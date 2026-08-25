import { isJournalPath, noteTitleFromPath, resolveWikiTarget } from "@nousarium/markdown";
import { filesHref, noteHref, type NoteListItem } from "./tag-tree";

export function findNoteForWikiTarget(target: string, items: NoteListItem[]): NoteListItem | null {
  const path = resolveWikiTarget(target);
  const byPath = items.find((item) => item.path === path);
  if (byPath) return byPath;

  const name = target.trim().replace(/\.md$/i, "").replace(/^Notes\//, "");
  if (!name || name.includes("/")) return null;
  const lower = name.toLowerCase();
  return (
    items.find((item) => {
      const fileTitle = noteTitleFromPath(item.path);
      return item.title === name || fileTitle === name || item.title.toLowerCase() === lower || fileTitle.toLowerCase() === lower;
    }) ?? null
  );
}

export function hrefForNoteWikiTarget(target: string, items: NoteListItem[]): string {
  const found = findNoteForWikiTarget(target, items);
  if (found) return noteHref(found);
  return filesHref({ path: resolveWikiTarget(target) });
}

export function isWikiJournalTarget(target: string): boolean {
  return isJournalPath(resolveWikiTarget(target));
}
