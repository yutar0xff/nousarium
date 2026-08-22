import { describe, expect, it } from "vitest";
import { formatFileNameTimestamp, journalFileName, slugifyFileName } from "./naming.js";

describe("naming", () => {
  it("uses underscore for word breaks in slugs", () => {
    expect(slugifyFileName("Vault 整理")).toBe("Vault_整理");
    expect(slugifyFileName("  hello   world  ")).toBe("hello_world");
  });

  it("formats filename timestamps in ISO 8601 basic form", () => {
    expect(formatFileNameTimestamp(new Date("2026-08-22T16:20:45"))).toBe("20260822T162045");
  });

  it("builds journal names with role hyphen after timestamp", () => {
    const name = journalFileName(new Date("2026-08-22T16:20:45"), "Vault 整理");
    expect(name).toBe("20260822T162045-Vault_整理.md");
    expect(name.includes(" ")).toBe(false);
    expect(name.includes(":")).toBe(false);
  });
});
