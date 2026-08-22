import { describe, expect, it } from "vitest";
import { fallbackConversationTitle, sanitizeConversationTitle } from "./conversation-title.js";

describe("conversation-title", () => {
  it("sanitizes model output", () => {
    expect(sanitizeConversationTitle("「認識論の整理」", "長い原文")).toBe("認識論の整理");
    expect(sanitizeConversationTitle("", "短い質問です")).toBe("短い質問です");
  });

  it("falls back to the first line", () => {
    expect(fallbackConversationTitle("一行目\n二行目")).toBe("一行目");
  });
});
