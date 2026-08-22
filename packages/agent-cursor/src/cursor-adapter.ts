import { Agent, type AgentOptions, Cursor, JsonlLocalAgentStore } from "@cursor/sdk";
import type { AgentEvent } from "@nousarium/contracts";
import type { AgentInput, AgentPort } from "@nousarium/core";
import { isDangerousShell, toolsForPolicy } from "@nousarium/core";
import { mkdirSync } from "node:fs";
import { mapCursorEvent } from "./map-events.js";

interface CursorAgentPortOptions {
  apiKey: string;
  model?: string;
  storePath: string;
  sandboxEnabled?: boolean;
}

export function createCursorAgentPort(options: CursorAgentPortOptions): AgentPort {
  mkdirSync(options.storePath, { recursive: true });
  const store = new JsonlLocalAgentStore(options.storePath);
  Cursor.configure({ local: { store } });
  const active = new Map<string, { cancel?: () => Promise<void> }>();

  return {
    async *send(input: AgentInput): AsyncIterable<AgentEvent> {
      yield {
        type: "run.started",
        runId: input.runId,
        conversationId: input.conversation.id,
        mode: input.mode,
        accessPolicy: input.accessPolicy,
      };

      const tools = toolsForPolicy(input.accessPolicy);
      const sandboxEnabled = options.sandboxEnabled ?? true;
      const base: AgentOptions = {
        apiKey: options.apiKey,
        model: { id: options.model ?? "composer-2.5" },
        mode: input.mode,
        ...(tools ? { tools } : {}),
        local: {
          cwd: input.vaultPath,
          store,
          ...(sandboxEnabled ? { sandboxOptions: { enabled: true } } : {}),
        },
      };

      let agent;
      try {
        agent = await createOrResume(input.conversation.cursorAgentId, base);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (sandboxEnabled && base.local) {
          try {
            agent = await createOrResume(input.conversation.cursorAgentId, {
              ...base,
              local: { cwd: base.local.cwd, store: base.local.store },
            });
          } catch {
            yield { type: "run.finished", runId: input.runId, status: "error", error: message };
            return;
          }
        } else {
          yield { type: "run.finished", runId: input.runId, status: "error", error: message };
          return;
        }
      }

      yield { type: "agent.bound", runId: input.runId, agentId: agent.agentId };

      const run = await agent.send(buildPrompt(input), { mode: input.mode });
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
  };
}

async function createOrResume(agentId: string | null, options: AgentOptions) {
  if (agentId) return Agent.resume(agentId, options);
  return Agent.create(options);
}

function buildPrompt(input: AgentInput): string {
  const exclusion = [
    "保護ディレクトリ `_protected/` には入らない。",
    "対話ログの生本文は追記以外で書き換えない。",
    "git push、reset --hard、clean、ホスト外への通信はしない。",
    input.accessPolicy === "chat" ? "Vault を読まない。" : "",
    input.accessPolicy === "read" ? "読み取りと検索のみ。ファイルを変更しない。" : "",
    input.accessPolicy === "vault-work"
      ? "必要なら Markdown を作成・編集する。新規ノートは Inbox または Knowledge の適切な場所へ置く。"
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${exclusion}\n\nユーザー:\n${input.message}`;
}
