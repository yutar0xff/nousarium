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

  it("defers policy changes until the next message", () => {
    const conversation = {
      id: "c1",
      title: "t",
      cursorAgentId: null,
      intent: "explore" as const,
      model: "auto",
      mode: "plan" as const,
      accessPolicy: "chat" as const,
      pendingMode: null,
      pendingAccessPolicy: null,
      pendingModel: null,
      journalPath: null,
      createdAt: "",
      updatedAt: "",
    };
    const pending = applyPendingPolicy(conversation, { accessPolicy: "vault-work" }, true);
    expect(pending.accessPolicy).toBe("chat");
    expect(pending.pendingAccessPolicy).toBe("vault-work");
    expect(snapshotPolicy(pending)).toEqual({ mode: "plan", accessPolicy: "vault-work", model: "auto" });

    const idle = applyPendingPolicy(conversation, { accessPolicy: "read", model: "composer-2.5" }, false);
    expect(idle.accessPolicy).toBe("chat");
    expect(idle.pendingAccessPolicy).toBe("read");
    expect(idle.pendingModel).toBe("composer-2.5");
  });
});
