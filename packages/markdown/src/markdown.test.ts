import { extractTags, extractWikiLinks } from "./links";
import { parseFrontmatter } from "./frontmatter";
import { addRelation, isNotePath, readRelations, resolveWikiTarget } from "./relations";
import { renderMarkdownToHtml } from "./render";
import { describe, expect, it } from "vitest";

describe("markdown", () => {
  it("parses yaml frontmatter", () => {
    const parsed = parseFrontmatter("---\ntype: concept\ntags:\n  - 分野/技術/AI\n---\n\n# 本文\n");
    expect(parsed.data.type).toBe("concept");
    expect(parsed.body.trim()).toBe("# 本文");
  });

  it("extracts wikilinks and japanese tags", () => {
    const text = "[[知識は接続によって再利用可能になる]] と #分野/哲学/認識論";
    expect(extractWikiLinks(text)).toEqual(["知識は接続によって再利用可能になる"]);
    expect(extractTags(text)).toEqual(["分野/哲学/認識論"]);
  });

  it("renders headings, lists, emphasis, and wikilinks", () => {
    const html = renderMarkdownToHtml(`# 見出し

これは **強調** と \`code\` です。

- 一つ
- 二つ

[[ノート名]] と #思考/内省
`);
    expect(html).toContain("<h1>");
    expect(html).toContain("<strong>");
    expect(html).toContain("<code>");
    expect(html).toContain("<li>");
    expect(html).toContain('class="wikilink"');
    expect(html).toContain('data-target="ノート名"');
    expect(html).toContain('class="tag"');
  });

  it("resolves wiki targets to vault paths", () => {
    expect(resolveWikiTarget("アファンタジア")).toBe("Notes/アファンタジア.md");
    expect(resolveWikiTarget("Journal/Conversations/2026/08/20260823T003235-アファンタジア")).toBe(
      "Journal/Conversations/2026/08/20260823T003235-アファンタジア.md",
    );
    expect(isNotePath("Notes/アファンタジア.md")).toBe(true);
    expect(isNotePath("Journal/Conversations/2026/08/log.md")).toBe(false);
  });

  it("reads and appends 関係 lines without rewriting existing ones", () => {
    const source = `# アファンタジア

## 関係

- [[行動中心の振り返り]] ── 抽象的な分岐
- supports: [[知識は接続によって再利用可能になる]]
`;
    expect(readRelations(source)).toEqual([
      { key: "", target: "行動中心の振り返り" },
      { key: "supports", target: "知識は接続によって再利用可能になる" },
    ]);
    const added = addRelation(
      source,
      "derived-from",
      "Journal/Conversations/2026/08/20260823T003235-アファンタジア",
      "アファンタジアの対話",
    );
    expect(added).toContain("- [[行動中心の振り返り]] ── 抽象的な分岐");
    expect(added).toContain(
      "- derived-from: [[Journal/Conversations/2026/08/20260823T003235-アファンタジア|アファンタジアの対話]]",
    );
    expect(
      addRelation(added, "derived-from", "Journal/Conversations/2026/08/20260823T003235-アファンタジア.md"),
    ).toBe(added);
    const created = addRelation("# 単独\n", "derived-from", "Journal/Conversations/2026/08/log", "対話");
    expect(created).toContain("## 関係");
    expect(created).toContain("- derived-from: [[Journal/Conversations/2026/08/log|対話]]");
  });
});
