import type { Conversation, NoteConversationLink, NoteRelations } from "@nousarium/contracts";
import type { ConversationStore, VaultPort } from "@nousarium/core";
import {
  isJournalPath,
  noteTitleFromPath,
  parseFrontmatter,
  readRelations,
  resolveWikiTarget,
} from "@nousarium/markdown";

export async function loadNoteRelations(
  vault: VaultPort,
  store: ConversationStore,
  notePath: string,
): Promise<NoteRelations> {
  const note = await vault.read(notePath);
  const { data } = parseFrontmatter(note.content);
  const title = noteTitleFromPath(notePath);
  const aliases = Array.isArray(data.aliases) ? data.aliases.map(String) : [];

  const editedPaths = readRelations(note.content)
    .filter((relation) => relation.key === "derived-from")
    .map((relation) => resolveWikiTarget(relation.target))
    .filter(isJournalPath);

  const edited = (await Promise.all(editedPaths.map((path) => resolveConversationLink(vault, store, path)))).filter(
    (link): link is NoteConversationLink => link !== null,
  );

  const editedSet = new Set(edited.map((link) => link.journalPath));
  const queries = unique([title, ...aliases]).map((name) => `[[${name}]]`);
  const referencedPaths = new Set<string>();
  for (const query of queries) {
    const hits = await vault.search({ q: query, prefix: "Journal/Conversations", limit: 40 });
    for (const hit of hits) {
      if (isJournalPath(hit.path) && !editedSet.has(hit.path)) referencedPaths.add(hit.path);
    }
  }

  const referenced = (
    await Promise.all([...referencedPaths].map((path) => resolveConversationLink(vault, store, path)))
  ).filter((link): link is NoteConversationLink => link !== null);

  return { edited, referenced };
}

export async function findConversationForJournal(
  vault: VaultPort,
  store: ConversationStore,
  journalPath: string,
): Promise<Conversation | null> {
  const link = await resolveConversationLink(vault, store, journalPath);
  if (!link?.conversationId) return null;
  return store.getConversation(link.conversationId);
}

async function resolveConversationLink(
  vault: VaultPort,
  store: ConversationStore,
  journalPath: string,
): Promise<NoteConversationLink | null> {
  const byPath = await store.getConversationByJournalPath(journalPath);
  if (byPath) {
    return {
      conversationId: byPath.id,
      title: byPath.title,
      journalPath,
      updatedAt: byPath.updatedAt,
    };
  }
  try {
    const doc = await vault.read(journalPath);
    const { data, body } = parseFrontmatter(doc.content);
    const conversationId = typeof data.conversation_id === "string" ? data.conversation_id : null;
    const byId = conversationId ? await store.getConversation(conversationId) : null;
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return {
      conversationId: byId?.id ?? conversationId,
      title: byId?.title ?? heading ?? journalPath,
      journalPath,
      updatedAt: byId?.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
