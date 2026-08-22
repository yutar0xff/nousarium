import { describe, expect, it } from "vitest";
import { buildTagTree, filesHref, filterTagTree, notesInSelection, type NoteListItem } from "./tag-tree";

function note(path: string, title: string, tags: string[]): NoteListItem {
  return { path, title, tags, updatedAt: null };
}

describe("buildTagTree", () => {
  it("nests hierarchical tags and counts descendants", () => {
    const items = [
      note("Notes/a.md", "アファンタジア", ["思考/内省"]),
      note("Notes/b.md", "行動中心の振り返り", ["思考/内省"]),
      note("Notes/c.md", "無題", []),
    ];
    const { folders, untagged } = buildTagTree(items);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.segment).toBe("思考");
    expect(folders[0]?.count).toBe(2);
    expect(folders[0]?.children[0]?.segment).toBe("内省");
    expect(folders[0]?.children[0]?.notes.map((item) => item.title)).toEqual([
      "アファンタジア",
      "行動中心の振り返り",
    ]);
    expect(untagged.map((item) => item.title)).toEqual(["無題"]);
  });

  it("places the same note under every tag", () => {
    const items = [note("Notes/a.md", "横断", ["思考/内省", "知識管理"])];
    const { folders } = buildTagTree(items);
    expect(folders.map((folder) => folder.path).sort()).toEqual(["思考", "知識管理"]);
    expect(folders.find((folder) => folder.path === "知識管理")?.notes).toHaveLength(1);
  });
});

describe("notesInSelection", () => {
  const items = [
    note("Notes/a.md", "A", ["思考/内省"]),
    note("Notes/b.md", "B", ["技術"]),
    note("Notes/c.md", "C", []),
  ];

  it("includes descendants when a parent tag is selected", () => {
    expect(notesInSelection(items, { tag: "思考", untagged: false }).map((item) => item.title)).toEqual(["A"]);
  });

  it("filters untagged notes", () => {
    expect(notesInSelection(items, { tag: null, untagged: true }).map((item) => item.title)).toEqual(["C"]);
  });
});

describe("filterTagTree", () => {
  it("keeps the path to a matching note", () => {
    const { folders, untagged } = buildTagTree([
      note("Notes/a.md", "アファンタジア", ["思考/内省"]),
      note("Notes/b.md", "別", ["技術"]),
    ]);
    const visible = filterTagTree(folders, untagged, "ファンタ");
    expect(visible.folders.map((folder) => folder.path)).toEqual(["思考"]);
    expect(visible.folders[0]?.children[0]?.notes[0]?.title).toBe("アファンタジア");
  });
});

describe("filesHref", () => {
  it("encodes tag folders and note paths", () => {
    expect(filesHref({})).toBe("/files");
    expect(filesHref({ tag: "思考/内省" })).toBe("/files?tag=%E6%80%9D%E8%80%83%2F%E5%86%85%E7%9C%81");
    expect(filesHref({ untagged: true, path: "Notes/a.md" })).toBe("/files?untagged=1&path=Notes%2Fa.md");
  });
});
