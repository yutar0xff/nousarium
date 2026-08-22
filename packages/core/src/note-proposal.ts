import type { Message, NoteProposal } from "@nousarium/contracts";
import { slugifyTitle } from "./naming";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildNoteProposal(input: {
  title: string;
  directory: string;
  messages: Message[];
}): NoteProposal {
  const title = input.title.trim();
  const dir = input.directory.replace(/^\/+|\/+$/g, "") || "00_Inbox";
  const file = `${slugifyTitle(title)}.md`;
  const path = `${dir}/${file}`;
  const dialogue = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `## ${message.role === "user" ? "自分" : "AI"}\n\n${message.content.trim()}`)
    .join("\n\n");
  const content = `---
id: ${crypto.randomUUID()}
type: inbox
status: seed
created: ${today()}
updated: ${today()}
aliases: []
tags: []
projects: []
sources: []
confidence: medium
ai_access: normal
review_after:
---

# ${title}

## 要約

## 得られた示唆

## 未解決の疑問

## 関係

${dialogue ? `## 出典となった対話\n\n${dialogue}\n` : ""}`;
  return { path, title, content };
}
