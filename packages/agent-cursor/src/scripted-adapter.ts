import type { AgentEvent } from "@nousarium/contracts";
import type { AgentInput, AgentPort } from "@nousarium/core";
import { ACCESS_POLICY_LABELS, fallbackConversationTitle } from "@nousarium/core";

export function createScriptedAgentPort(): AgentPort {
  const cancelled = new Set<string>();
  return {
    async *send(input: AgentInput): AsyncIterable<AgentEvent> {
      yield {
        type: "run.started",
        runId: input.runId,
        conversationId: input.conversation.id,
        accessPolicy: input.accessPolicy,
      };
      if (cancelled.has(input.runId)) {
        yield { type: "run.finished", runId: input.runId, status: "cancelled" };
        return;
      }
      const text =
        input.accessPolicy === "chat"
          ? `Vault には触れず応答します。権限は${ACCESS_POLICY_LABELS[input.accessPolicy]}、モデルは ${input.model} です。\n\n${summarize(input.message)}`
          : `問いを受け取りました。CURSOR_API_KEY 未設定のため実ファイル操作はスクリプト応答です。\n\n問い: ${input.message}`;
      for (const chunk of text.match(/.{1,48}/gs) ?? [text]) {
        if (cancelled.has(input.runId)) {
          yield { type: "run.finished", runId: input.runId, status: "cancelled" };
          return;
        }
        yield { type: "assistant.delta", runId: input.runId, text: chunk };
      }
      yield { type: "run.finished", runId: input.runId, status: "finished", result: text };
    },
    async cancel(runId) {
      cancelled.add(runId);
    },
    async generateConversationTitle(message) {
      return fallbackConversationTitle(message);
    },
  };
}

function summarize(message: string): string {
  return `受け取りました。\n\n${message}`;
}
