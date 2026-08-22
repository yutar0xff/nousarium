import { mapCursorEvent } from "./map-events.js";
import { createScriptedAgentPort } from "./scripted-adapter.js";
import { describe, expect, it } from "vitest";

describe("cursor adapter mapping", () => {
  it("maps assistant text", () => {
    const mapped = mapCursorEvent(
      { type: "assistant", message: { content: [{ type: "text", text: "hello" }] } },
      "run-1",
    );
    expect(mapped).toEqual({ type: "assistant.delta", runId: "run-1", text: "hello" });
  });

  it("streams a scripted reply", async () => {
    const port = createScriptedAgentPort();
    const events = [];
    for await (const event of port.send({
      conversation: {
        id: "c",
        title: "t",
        cursorAgentId: null,
        mode: "plan",
        accessPolicy: "chat",
        pendingMode: null,
        pendingAccessPolicy: null,
        journalPath: null,
        createdAt: "",
        updatedAt: "",
      },
      runId: "r",
      message: "hi",
      history: [],
      mode: "plan",
      accessPolicy: "chat",
      vaultPath: "/tmp",
    })) {
      events.push(event.type);
    }
    expect(events[0]).toBe("run.started");
    expect(events.at(-1)).toBe("run.finished");
  });
});
