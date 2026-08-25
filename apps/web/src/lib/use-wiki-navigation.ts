"use client";

import type { Conversation } from "@nousarium/contracts";
import { isJournalPath, resolveWikiTarget } from "@nousarium/markdown";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { api } from "./api";
import { type NoteListItem } from "./tag-tree";
import { hrefForNoteWikiTarget } from "./wiki-nav";

export function useWikiNavigation(items: NoteListItem[] = []) {
  const router = useRouter();

  return useCallback(
    async (target: string) => {
      const path = resolveWikiTarget(target);
      if (isJournalPath(path)) {
        try {
          const found = await api<{ conversation: Conversation | null }>(
            `/conversations/by-journal?path=${encodeURIComponent(path)}`,
          );
          if (found.conversation) {
            router.push(`/c/${found.conversation.id}`);
          }
        } catch {
          // unlinked journal
        }
        return;
      }
      router.push(hrefForNoteWikiTarget(target, items));
    },
    [items, router],
  );
}
