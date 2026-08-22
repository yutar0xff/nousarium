import type { Conversation, Message } from "@nousarium/contracts";
import { journalFileName } from "@nousarium/core";
import type { VaultPort } from "@nousarium/core";

export async function appendJournal(
  vault: VaultPort,
  conversation: Conversation,
  messages: Message[],
): Promise<string> {
  const title = conversation.title || "対話";
  const relative =
    conversation.journalPath ??
    `10_Journal/Conversations/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${journalFileName(new Date(), title)}`;

  const body = messages
    .map((message) => {
      const who = message.role === "user" ? "自分" : message.role === "assistant" ? "AI" : "system";
      const meta = [message.mode, message.accessPolicy].filter(Boolean).join(" / ");
      return `### ${who}${meta ? ` (${meta})` : ""}\n\n${message.content}\n`;
    })
    .join("\n");

  const content = `---
id: ${conversation.id}
type: conversation
status: raw
intent: ${conversation.intent}
created: ${conversation.createdAt.slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
aliases: []
tags: []
projects: []
sources: []
confidence: medium
ai_access: normal
retention: permanent
---

# ${title}

## 対話ログ

${body}
`;

  let expectedHash: string | null = null;
  try {
    const existing = await vault.read(relative);
    expectedHash = existing.hash;
  } catch {
    expectedHash = null;
  }

  await vault.save({ path: relative, content, expectedHash });
  return relative;
}
