import type { Conversation, Message } from "@nousarium/contracts";
import { journalFileName } from "@nousarium/core";
import type { VaultPort } from "@nousarium/core";

function preservedAiAccess(content: string): "normal" | "excluded" {
  return /^ai_access:\s*excluded\s*$/m.test(content) ? "excluded" : "normal";
}

export async function appendJournal(
  vault: VaultPort,
  conversation: Conversation,
  messages: Message[],
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
  try {
    const existing = await vault.read(relative);
    expectedHash = existing.hash;
    aiAccess = preservedAiAccess(existing.content);
  } catch {
    expectedHash = null;
  }

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
---

# ${title}

## 対話ログ

${body}
`;

  await vault.save({ path: relative, content, expectedHash });
  return relative;
}
