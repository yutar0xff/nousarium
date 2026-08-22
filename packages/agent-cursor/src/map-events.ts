import type { AgentEvent } from "@nousarium/contracts";
import { isDangerousShell } from "@nousarium/core";

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  if (Array.isArray(record.content)) {
    return record.content
      .map((block) => textFromUnknown(block))
      .filter(Boolean)
      .join("");
  }
  return "";
}

export function mapCursorEvent(event: unknown, runId: string): AgentEvent | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const type = String(record.type ?? "");

  if (type === "system" && record.agent_id) {
    return { type: "agent.bound", runId, agentId: String(record.agent_id) };
  }

  if (type === "assistant" || type === "assistant_message") {
    const text = textFromUnknown(record.message ?? record);
    if (!text) return null;
    return { type: "assistant.delta", runId, text };
  }

  if (type === "tool_call" || type === "tool") {
    const status = String(record.status ?? record.subtype ?? "");
    const tool =
      String(record.name ?? record.tool ?? "") ||
      Object.keys((record.tool_call as Record<string, unknown> | undefined) ?? {})[0] ||
      "tool";
    const detail = textFromUnknown(record.args ?? record.result ?? record) || JSON.stringify(record.args ?? record.result ?? {});
    if (tool === "shell" && isDangerousShell(detail)) {
      return { type: "tool.completed", runId, tool, detail: "blocked dangerous command" };
    }
    if (status === "completed" || status === "error") {
      return { type: "tool.completed", runId, tool, detail };
    }
    return { type: "tool.started", runId, tool, detail };
  }

  return null;
}
