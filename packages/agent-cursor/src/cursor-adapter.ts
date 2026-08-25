import { Agent, type AgentOptions, Cursor, JsonlLocalAgentStore } from "@cursor/sdk";
import type { AgentEvent } from "@nousarium/contracts";
import type { AgentInput, AgentPort } from "@nousarium/core";
import { isDangerousShell, MODEL_OPTIONS, normalizeModelOptions, resolveModelId, toolsForPolicy } from "@nousarium/core";
import { mkdirSync } from "node:fs";
import { mapCursorEvent } from "./map-events.js";
import { generateConversationTitleWithCursor } from "./title.js";

interface CursorAgentPortOptions {
  apiKey: string;
  model?: string;
  storePath: string;
}

function localOptions(cwd: string, store: JsonlLocalAgentStore): NonNullable<AgentOptions["local"]> {
  return {
    cwd,
    store,
    sandboxOptions: { enabled: false },
    settingSources: ["project"],
  };
}

export function createCursorAgentPort(options: CursorAgentPortOptions): AgentPort {
  mkdirSync(options.storePath, { recursive: true });
  const store = new JsonlLocalAgentStore(options.storePath);
  Cursor.configure({ local: { store } });
  const active = new Map<string, { cancel?: () => Promise<void> }>();
  let modelsCache: { at: number; models: Array<{ id: string; label: string }> } | null = null;
  const modelsCacheTtlMs = 10 * 60 * 1000;

  return {
    async *send(input: AgentInput): AsyncIterable<AgentEvent> {
      yield {
        type: "run.started",
        runId: input.runId,
        conversationId: input.conversation.id,
        accessPolicy: input.accessPolicy,
      };

      const tools = toolsForPolicy(input.accessPolicy);
      const modelId = resolveModelId(input.model, options.model ?? "auto");
      const base: AgentOptions = {
        apiKey: options.apiKey,
        model: { id: modelId },
        mode: "agent",
        ...(tools ? { tools } : {}),
        local: localOptions(input.vaultPath, store),
      };

      let agent;
      try {
        agent = await createOrResume(input.conversation.cursorAgentId, base);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        yield { type: "run.finished", runId: input.runId, status: "error", error: message };
        return;
      }

      yield { type: "agent.bound", runId: input.runId, agentId: agent.agentId };

      const run = await agent.send(buildPrompt(input), { mode: "agent" });
      yield { type: "run.status", runId: input.runId, phase: "thinking" };
      active.set(input.runId, {
        cancel: run.supports("cancel") ? () => run.cancel() : undefined,
      });

      let assembled = "";
      try {
        for await (const event of run.stream()) {
          const mapped = mapCursorEvent(event, input.runId);
          if (!mapped) continue;
          if (mapped.type === "assistant.delta") assembled += mapped.text;
          if (mapped.type === "tool.started" && mapped.tool === "shell" && mapped.detail && isDangerousShell(mapped.detail)) {
            if (run.supports("cancel")) await run.cancel();
            yield {
              type: "run.finished",
              runId: input.runId,
              status: "error",
              error: "dangerous shell command blocked",
            };
            return;
          }
          yield mapped;
        }
        const result = await run.wait();
        yield {
          type: "run.finished",
          runId: input.runId,
          status: result.status === "cancelled" ? "cancelled" : result.status === "error" ? "error" : "finished",
          result: assembled || result.result,
          error: result.error?.message,
        };
      } catch (error) {
        yield {
          type: "run.finished",
          runId: input.runId,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        active.delete(input.runId);
        await agent[Symbol.asyncDispose]();
      }
    },

    async cancel(runId) {
      await active.get(runId)?.cancel?.();
    },

    async generateConversationTitle(message, model) {
      return generateConversationTitleWithCursor({
        apiKey: options.apiKey,
        model: model ?? options.model,
        message,
      });
    },

    async listModels() {
      if (modelsCache && Date.now() - modelsCache.at < modelsCacheTtlMs) return modelsCache.models;
      try {
        const listed = await Cursor.models.list({ apiKey: options.apiKey });
        const models = normalizeModelOptions(
          listed.map((model) => ({
            id: model.id,
            label: model.displayName?.trim() || model.id,
          })),
        );
        modelsCache = { at: Date.now(), models };
        return models;
      } catch {
        const models = normalizeModelOptions(MODEL_OPTIONS.map((option) => ({ id: option.id, label: option.label })));
        modelsCache = { at: Date.now(), models };
        return models;
      }
    },
  };
}

async function createOrResume(agentId: string | null, options: AgentOptions) {
  if (agentId) return Agent.resume(agentId, options);
  return Agent.create(options);
}

function buildPrompt(input: AgentInput): string {
  if (input.accessPolicy === "chat") {
    return `このターンは会話のみです。Vault を読まず、ファイルを変更しないでください。\n\nユーザー:\n${input.message}`;
  }
  return input.message;
}
