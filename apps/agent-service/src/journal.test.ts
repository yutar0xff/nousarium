import { createFsVault, initializeVault } from "@nousarium/vault-fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendJournal, linkNoteToJournal } from "./journal.js";

describe("journal links", () => {
  it("writes conversation_id and note links, then appends derived-from", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nousarium-journal-"));
    try {
      await initializeVault(dir);
      const vault = createFsVault(dir);
      const note = await vault.save({
        path: "Notes/アファンタジア.md",
        content: `# アファンタジア\n\n## 関係\n\n- [[行動中心の振り返り]] ── 抽象的な分岐\n`,
        expectedHash: null,
      });
      const conversation = {
        id: "conv-1",
        title: "アファンタジア",
        cursorAgentId: null,
        model: "auto",
        accessPolicy: "vault" as const,
        pendingAccessPolicy: null,
        pendingModel: null,
        journalPath: null,
        createdAt: "2026-08-23T00:00:00.000Z",
        updatedAt: "2026-08-23T00:00:00.000Z",
      };
      const journalPath = await appendJournal(
        vault,
        conversation,
        [
          {
            id: "m1",
            conversationId: "conv-1",
            role: "user",
            content: "[[アファンタジア]] について",
            runId: null,
            accessPolicy: "vault",
            createdAt: "2026-08-23T00:00:00.000Z",
          },
        ],
        { updated: ["Notes/アファンタジア.md"], referenced: ["Notes/行動中心の振り返り.md"] },
      );
      const journal = await vault.read(journalPath);
      expect(journal.content).toContain("conversation_id: conv-1");
      expect(journal.content).toContain("- updated: [[アファンタジア]]");
      expect(journal.content).toContain("- referenced: [[行動中心の振り返り]]");

      await linkNoteToJournal(vault, note.path, journalPath, conversation.title);
      const linked = await vault.read(note.path);
      expect(linked.content).toContain("- [[行動中心の振り返り]] ── 抽象的な分岐");
      expect(linked.content).toMatch(/derived-from: \[\[Journal\/Conversations\/.+アファンタジア\|アファンタジアの対話\]\]/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
