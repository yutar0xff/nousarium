import type { Conversation, Message } from "@nousarium/contracts";
import { journalFileName } from "@nousarium/core";
import type { ConversationStore, VaultPort, VersionControlPort } from "@nousarium/core";
import {
  addRelation,
  extractWikiLinks,
  isNotePath,
  journalTargetFromPath,
  noteTitleFromPath,
  resolveWikiTarget,
} from "@nousarium/markdown";
import { isAiExcludedMarkdown } from "@nousarium/vault-fs";

type NoteLinks = {
  updated: string[];
  referenced: string[];
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseLinkedNotes(content: string): NoteLinks {
  const updated: string[] = [];
  const referenced: string[] = [];
  for (const line of content.split("\n")) {
    const match = /^- (updated|referenced):\s*\[\[([^\]|#]+)/.exec(line.trim());
    const name = match?.[2]?.trim();
    if (!match || !name) continue;
    const path = resolveWikiTarget(name);
    if (!isNotePath(path)) continue;
    if (match[1] === "updated") updated.push(path);
    else referenced.push(path);
  }
  return { updated, referenced };
}

function noteLinkLines(links: NoteLinks): string {
  const updated = unique(links.updated);
  const referenced = unique(links.referenced).filter((path) => !updated.includes(path));
  const lines = [
    ...updated.map((path) => `- updated: [[${noteTitleFromPath(path)}]]`),
    ...referenced.map((path) => `- referenced: [[${noteTitleFromPath(path)}]]`),
  ];
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function notePathsFromAssistant(text: string): string[] {
  return unique(extractWikiLinks(text).map(resolveWikiTarget).filter(isNotePath));
}

export async function appendJournal(
  vault: VaultPort,
  conversation: Conversation,
  messages: Message[],
  incoming: NoteLinks = { updated: [], referenced: [] },
): Promise<string> {
  const title = conversation.title || "対話";
  const relative =
    conversation.journalPath ??
    `Journal/Conversations/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${journalFileName(new Date(), title)}`;

  const body = messages
    .map((message) => {
      const who = message.role === "user" ? "自分" : message.role === "assistant" ? "AI" : "system";
      const meta = message.accessPolicy ?? "";
      return `### ${who}${meta ? ` (${meta})` : ""}\n\n${message.content}\n`;
    })
    .join("\n");

  let expectedHash: string | null = null;
  let aiAccess: "normal" | "excluded" = "normal";
  let previous: NoteLinks = { updated: [], referenced: [] };
  try {
    const existing = await vault.read(relative);
    expectedHash = existing.hash;
    aiAccess = isAiExcludedMarkdown(existing.content) ? "excluded" : "normal";
    previous = parseLinkedNotes(existing.content);
  } catch {
    expectedHash = null;
  }

  const links: NoteLinks = {
    updated: unique([...previous.updated, ...incoming.updated]),
    referenced: unique([...previous.referenced, ...incoming.referenced]),
  };
  const noteSection = noteLinkLines(links);

  const content = `---
type: [conversation]
status: raw
confidence: medium
tags: []
aliases: []
created: ${conversation.createdAt.slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
ai_access: ${aiAccess}
retention: permanent
conversation_id: ${conversation.id}
---

# ${title}

## 参照・更新したノート

${noteSection}
## 対話ログ

${body}
`;

  await vault.save({ path: relative, content, expectedHash });
  return relative;
}

export async function linkNoteToJournal(
  vault: VaultPort,
  notePath: string,
  journalPath: string,
  conversationTitle: string,
): Promise<void> {
  const doc = await vault.read(notePath);
  const next = addRelation(
    doc.content,
    "derived-from",
    journalTargetFromPath(journalPath),
    `${conversationTitle}の対話`,
  );
  if (next === doc.content) return;
  await vault.save({ path: notePath, content: next, expectedHash: doc.hash });
}

export async function writeRunLinks(input: {
  vault: VaultPort;
  git: VersionControlPort;
  store: ConversationStore;
  conversation: Conversation;
  messages: Message[];
  assistant: string;
  gitBefore: string | null;
  runId: string;
}): Promise<string | null> {
  const touched = input.gitBefore
    ? [...new Set((await input.git.changedPaths(input.gitBefore)).filter(isNotePath))]
    : [];
  const journalPath = await appendJournal(input.vault, input.conversation, input.messages, {
    updated: touched,
    referenced: notePathsFromAssistant(input.assistant),
  });
  await input.store.updateConversation(input.conversation.id, { journalPath });
  for (const notePath of touched) {
    await linkNoteToJournal(input.vault, notePath, journalPath, input.conversation.title);
  }
  return input.git.commitRun(input.runId, input.conversation.title);
}
