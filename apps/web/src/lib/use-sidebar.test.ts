import { describe, expect, it } from "vitest";
import { sidebarActionLabel } from "./use-sidebar";

describe("sidebarActionLabel", () => {
  it("names the panel and the action", () => {
    expect(sidebarActionLabel(false, "open")).toBe("会話リストを開く");
    expect(sidebarActionLabel(true, "close")).toBe("フォルダを閉じる");
  });
});
