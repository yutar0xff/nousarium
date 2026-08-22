import { applyPendingPolicy, snapshotPolicy } from "./policy-transition";
import { isDangerousShell, toolsForPolicy } from "./policy";
import { describe, expect, it } from "vitest";

describe("policy", () => {
  it("maps access policies to tool allowlists", () => {
    expect(toolsForPolicy("chat")).toEqual([]);
    expect(toolsForPolicy("read")).toEqual(["read", "grep", "glob", "ls"]);
    expect(toolsForPolicy("vault-work")).toBeUndefined();
  });

  it("flags destructive shell", () => {
    expect(isDangerousShell("rg 認識論")).toBe(false);
    expect(isDangerousShell("git push origin main")).toBe(true);
    expect(isDangerousShell("curl https://example.com")).toBe(true);
  });

  it("defers policy changes while a run is active", () => {
    const conversation = {
      id: "c1",
      title: "t",
      cursorAgentId: null,
      mode: "plan" as const,
      accessPolicy: "chat" as const,
      pendingMode: null,
      pendingAccessPolicy: null,
      journalPath: null,
      createdAt: "",
      updatedAt: "",
    };
    const pending = applyPendingPolicy(conversation, { accessPolicy: "vault-work" }, true);
    expect(pending.accessPolicy).toBe("chat");
    expect(pending.pendingAccessPolicy).toBe("vault-work");
    expect(snapshotPolicy(pending)).toEqual({ mode: "plan", accessPolicy: "vault-work" });

    const applied = applyPendingPolicy(pending, {}, false);
    expect(applied.accessPolicy).toBe("chat");
  });
});
