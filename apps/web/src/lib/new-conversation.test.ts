import { describe, expect, it } from "vitest";
import { isNewConversationShortcut } from "./new-conversation";

function key(init: Partial<Parameters<typeof isNewConversationShortcut>[0]>) {
  return { code: "KeyO", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...init };
}

describe("isNewConversationShortcut", () => {
  it("matches Ctrl+Shift+O", () => {
    expect(isNewConversationShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it("ignores Cmd+Shift+O and other modifiers", () => {
    expect(isNewConversationShortcut(key({ metaKey: true, shiftKey: true }))).toBe(false);
    expect(isNewConversationShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
    expect(isNewConversationShortcut(key({ ctrlKey: true }))).toBe(false);
  });
});
