import { extractTags, extractWikiLinks } from "./links";
import { parseFrontmatter } from "./frontmatter";
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
});
