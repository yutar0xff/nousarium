import { describe, expect, it } from "vitest";
import { findNoteForWikiTarget, hrefForNoteWikiTarget, isWikiJournalTarget } from "./wiki-nav";
import type { NoteListItem } from "./tag-tree";

const notes: NoteListItem[] = [
  {
    path: "Notes/知識は接続によって再利用可能になる.md",
    title: "知識は接続によって再利用可能になる",
    tags: ["思考"],
    updatedAt: null,
  },
  {
    path: "Notes/アファンタジア.md",
    title: "心象のない思考",
    tags: [],
    updatedAt: null,
  },
];

describe("findNoteForWikiTarget", () => {
  it("resolves by file name", () => {
    expect(findNoteForWikiTarget("アファンタジア", notes)?.path).toBe("Notes/アファンタジア.md");
  });

  it("resolves by display title", () => {
    expect(findNoteForWikiTarget("心象のない思考", notes)?.path).toBe("Notes/アファンタジア.md");
  });

  it("resolves path-style targets", () => {
    expect(findNoteForWikiTarget("Notes/アファンタジア", notes)?.path).toBe("Notes/アファンタジア.md");
  });
});

describe("hrefForNoteWikiTarget", () => {
  it("keeps the note's folder context", () => {
    expect(hrefForNoteWikiTarget("知識は接続によって再利用可能になる", notes)).toBe(
      "/files?tag=%E6%80%9D%E8%80%83&path=Notes%2F%E7%9F%A5%E8%AD%98%E3%81%AF%E6%8E%A5%E7%B6%9A%E3%81%AB%E3%82%88%E3%81%A3%E3%81%A6%E5%86%8D%E5%88%A9%E7%94%A8%E5%8F%AF%E8%83%BD%E3%81%AB%E3%81%AA%E3%82%8B.md",
    );
  });

  it("falls back to path when the note is unknown", () => {
    expect(hrefForNoteWikiTarget("未作成", notes)).toBe("/files?path=Notes%2F%E6%9C%AA%E4%BD%9C%E6%88%90.md");
  });
});

describe("isWikiJournalTarget", () => {
  it("detects journal paths", () => {
    expect(isWikiJournalTarget("Journal/Conversations/2026/08/log")).toBe(true);
    expect(isWikiJournalTarget("アファンタジア")).toBe(false);
  });
});
