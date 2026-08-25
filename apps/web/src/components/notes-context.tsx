"use client";

import type { VaultDocument, VaultEntry } from "@nousarium/contracts";
import { parseFrontmatter } from "@nousarium/markdown";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { useEffectivePathname } from "../lib/pathname";
import { asTags, titleFrom, type NoteListItem } from "../lib/tag-tree";

const NOTES_CHANGED = "nousarium:notes-changed";

export function notifyNotesChanged() {
  window.dispatchEvent(new Event(NOTES_CHANGED));
}

type NotesContextValue = {
  items: NoteListItem[];
  loading: boolean;
  knownNotes: string[];
  refresh: () => Promise<void>;
};

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const pathname = useEffectivePathname();
  const onFiles = pathname.startsWith("/files");
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await api<VaultEntry[]>("/vault/tree?path=Notes");
      const files = entries.filter((entry) => entry.kind === "file" && entry.name.endsWith(".md"));
      const loaded = await Promise.all(
        files.map(async (entry) => {
          const file = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(entry.path)}`);
          const { data, body } = parseFrontmatter(file.content);
          return {
            path: entry.path,
            title: titleFrom(entry.path, body, data.aliases),
            tags: asTags(data.tags),
            updatedAt: entry.updatedAt,
          } satisfies NoteListItem;
        }),
      );
      setItems(loaded.sort((a, b) => a.title.localeCompare(b.title, "ja")));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (onFiles) void refresh();
  }, [onFiles, refresh]);

  useEffect(() => {
    function onRefresh() {
      if (window.location.pathname.startsWith("/files")) void refresh();
    }
    window.addEventListener(NOTES_CHANGED, onRefresh);
    return () => window.removeEventListener(NOTES_CHANGED, onRefresh);
  }, [refresh]);

  const knownNotes = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      names.add(item.path.replace(/^Notes\//, "").replace(/\.md$/, ""));
      names.add(item.title);
    }
    return [...names];
  }, [items]);

  const value = useMemo(
    () => ({ items, loading, knownNotes, refresh }),
    [items, loading, knownNotes, refresh],
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const value = useContext(NotesContext);
  if (!value) throw new Error("useNotes requires NotesProvider");
  return value;
}
