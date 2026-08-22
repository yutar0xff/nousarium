import { applyPendingPolicy, snapshotPolicy } from "./policy-transition";
import { isDangerousShell, toolsForPolicy } from "./policy";
import { describe, expect, it } from "vitest";

describe("policy", () => {
  it("maps access policies to tool allowlists", () => {
    expect(toolsForPolicy("chat")).toEqual([]);
    expect(toolsForPolicy("vault")).toBeUndefined();
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
      model: "auto",
      accessPolicy: "chat" as const,
      pendingAccessPolicy: null,
      pendingModel: null,
      journalPath: null,
      createdAt: "",
      updatedAt: "",
    };
    const pending = applyPendingPolicy(conversation, { accessPolicy: "vault" }, true);
    expect(pending.accessPolicy).toBe("chat");
    expect(pending.pendingAccessPolicy).toBe("vault");
    expect(snapshotPolicy(pending)).toEqual({ accessPolicy: "vault", model: "auto" });

    const idle = applyPendingPolicy(conversation, { accessPolicy: "vault", model: "composer-2.5" }, false);
    expect(idle.accessPolicy).toBe("chat");
    expect(idle.pendingAccessPolicy).toBe("vault");
    expect(idle.pendingModel).toBe("composer-2.5");
  });
});
