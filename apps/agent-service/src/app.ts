import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  createConversationRequestSchema,
  proposedNoteRequestSchema,
  saveDocumentRequestSchema,
  searchQuerySchema,
  sendMessageRequestSchema,
  updatePolicyRequestSchema,
} from "@nousarium/contracts";
import { applyPendingPolicy, buildNoteProposal, snapshotPolicy } from "@nousarium/core";
import type { AgentPort, ConversationStore, VaultPort, VersionControlPort } from "@nousarium/core";
import { VaultConflictError } from "@nousarium/vault-fs";
import { authMiddleware, signToken } from "./auth.js";
import type { AppConfig } from "./config.js";
import { appendJournal } from "./journal.js";
import { Mutex } from "./mutex.js";

export function createApp(input: {
  config: AppConfig;
  store: ConversationStore;
  vault: VaultPort;
  git: VersionControlPort;
  agent: AgentPort;
}) {
  const { config, store, vault, git, agent } = input;
  const vaultLock = new Mutex();
  const conversationLocks = new Map<string, Mutex>();
  const running = new Set<string>();

  function conversationLock(id: string): Mutex {
    const existing = conversationLocks.get(id);
    if (existing) return existing;
    const mutex = new Mutex();
    conversationLocks.set(id, mutex);
    return mutex;
  }

  const app = new Hono();
  app.use("*", cors({ origin: config.webOrigin, allowHeaders: ["content-type", "authorization"], credentials: true }));
  app.use("*", authMiddleware(config.appSecret));

  app.get("/health", (c) =>
    c.json({
      ok: true,
      cursor: Boolean(config.cursorApiKey),
    }),
  );

  app.post("/login", async (c) => c.json({ token: signToken(config.appSecret, "owner") }));

  app.get("/conversations", async (c) => c.json(await store.listConversations()));

  app.post("/conversations", async (c) => {
    const body = createConversationRequestSchema.parse(await c.req.json());
    const conversation = await store.createConversation({
      title: body.title?.trim() || "新しい対話",
      mode: body.mode,
      accessPolicy: body.accessPolicy,
    });
    return c.json(conversation);
  });

  app.get("/conversations/:id", async (c) => {
    const conversation = await store.getConversation(c.req.param("id"));
    if (!conversation) return c.json({ error: "not found" }, 404);
    const messages = await store.listMessages(conversation.id);
    return c.json({ conversation, messages });
  });

  app.patch("/conversations/:id/policy", async (c) => {
    const conversation = await store.getConversation(c.req.param("id"));
    if (!conversation) return c.json({ error: "not found" }, 404);
    const body = updatePolicyRequestSchema.parse(await c.req.json());
    const next = applyPendingPolicy(conversation, body, running.has(conversation.id));
    return c.json(await store.updateConversation(conversation.id, next));
  });

  app.post("/conversations/:id/cancel", async (c) => {
    const runId = c.req.query("runId");
    if (runId) await agent.cancel(runId);
    return c.json({ ok: true });
  });

  app.post("/conversations/:id/messages", async (c) => {
    const conversationId = c.req.param("id");
    const body = sendMessageRequestSchema.parse(await c.req.json());
    return streamSSE(c, async (stream) => {
      await conversationLock(conversationId).run(async () => {
        let conversation = await store.getConversation(conversationId);
        if (!conversation) {
          await stream.writeSSE({ data: JSON.stringify({ type: "run.finished", runId: "", status: "error", error: "not found" }) });
          return;
        }
        if (body.mode || body.accessPolicy) {
          conversation = await store.updateConversation(
            conversation.id,
            applyPendingPolicy(conversation, body, false),
          );
        }
        const policy = snapshotPolicy(conversation);
        conversation = await store.updateConversation(conversation.id, {
          mode: policy.mode,
          accessPolicy: policy.accessPolicy,
          pendingMode: null,
          pendingAccessPolicy: null,
        });
        const userMessage = await store.addMessage({
          conversationId,
          role: "user",
          content: body.content,
          runId: null,
          mode: policy.mode,
          accessPolicy: policy.accessPolicy,
        });
        if (conversation.title === "新しい対話") {
          conversation = await store.updateConversation(conversation.id, {
            title: body.content.slice(0, 40),
          });
        }
        const runId = crypto.randomUUID();
        const history = await store.listMessages(conversationId);
        running.add(conversationId);
        const writes = policy.accessPolicy === "vault-work";
        try {
          const gitBefore = writes
            ? await vaultLock.run(async () => git.checkpoint(`nousarium-pre:${runId}`))
            : await git.currentHead();
          await store.createRun({
            id: runId,
            conversationId,
            status: "running",
            mode: policy.mode,
            accessPolicy: policy.accessPolicy,
            gitBefore,
            startedAt: new Date().toISOString(),
          });

          let assistant = "";
          let agentStatus: "finished" | "error" | "cancelled" = "finished";
          let agentError: string | undefined;
          const send = async () => {
            for await (const event of agent.send({
              conversation,
              runId,
              message: userMessage.content,
              history,
              mode: policy.mode,
              accessPolicy: policy.accessPolicy,
              vaultPath: config.vaultPath,
            })) {
              if (event.type === "assistant.delta") assistant += event.text;
              if (event.type === "agent.bound") {
                conversation = await store.updateConversation(conversation.id, { cursorAgentId: event.agentId });
              }
              if (event.type === "run.finished") {
                agentStatus = event.status;
                agentError = event.error;
                if (event.result && !assistant) assistant = event.result;
                continue;
              }
              await stream.writeSSE({ data: JSON.stringify(event) });
            }
          };
          if (writes) await vaultLock.run(send);
          else await send();

          if (agentStatus === "error") {
            await store.updateRun(runId, {
              status: "error",
              error: agentError,
              finishedAt: new Date().toISOString(),
            });
            await stream.writeSSE({
              data: JSON.stringify({ type: "run.finished", runId, status: "error", error: agentError }),
            });
            return;
          }

          if (assistant) {
            await store.addMessage({
              conversationId,
              role: "assistant",
              content: assistant,
              runId,
              mode: policy.mode,
              accessPolicy: policy.accessPolicy,
            });
          }
          const all = await store.listMessages(conversationId);
          const gitAfter = await vaultLock.run(async () => {
            const journalPath = await appendJournal(vault, conversation, all);
            await store.updateConversation(conversation.id, { journalPath });
            return git.commitRun(runId, conversation.title);
          });
          const diffs = gitBefore && gitAfter ? await git.diff(gitBefore, gitAfter) : [];
          await store.updateRun(runId, {
            status: agentStatus === "cancelled" ? "cancelled" : "finished",
            gitAfter,
            finishedAt: new Date().toISOString(),
          });
          await stream.writeSSE({
            data: JSON.stringify({
              type: "run.finished",
              runId,
              status: agentStatus === "cancelled" ? "cancelled" : "finished",
              result: assistant,
              diffs,
            }),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await store.updateRun(runId, {
            status: "error",
            error: message,
            finishedAt: new Date().toISOString(),
          });
          await stream.writeSSE({
            data: JSON.stringify({ type: "run.finished", runId, status: "error", error: message }),
          });
        } finally {
          running.delete(conversationId);
        }
      });
    });
  });

  app.post("/conversations/:id/notes", async (c) => {
    const conversation = await store.getConversation(c.req.param("id"));
    if (!conversation) return c.json({ error: "not found" }, 404);
    const body = proposedNoteRequestSchema.parse(await c.req.json());
    const messages = await store.listMessages(conversation.id);
    return c.json(buildNoteProposal({ title: body.title, directory: body.directory, messages }));
  });

  app.get("/vault/tree", async (c) => {
    const prefix = c.req.query("path") ?? "";
    return c.json(await vault.list(prefix));
  });

  app.get("/vault/file", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path required" }, 400);
    return c.json(await vault.read(filePath));
  });

  app.put("/vault/file", async (c) => {
    const body = saveDocumentRequestSchema.parse(await c.req.json());
    try {
      const saved = await vaultLock.run(async () => {
        const doc = await vault.save(body);
        await git.commitRun(`manual-${crypto.randomUUID()}`, `save ${body.path}`);
        return doc;
      });
      return c.json(saved);
    } catch (error) {
      if (error instanceof VaultConflictError) {
        return c.json({ error: "conflict", path: error.path, currentHash: error.currentHash }, 409);
      }
      throw error;
    }
  });

  app.get("/vault/search", async (c) => {
    const parsed = searchQuerySchema.parse({ q: c.req.query("q") ?? "", limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined });
    return c.json(await vault.search(parsed));
  });

  app.get("/runs", async (c) => c.json(await store.listRuns(c.req.query("conversationId") ?? undefined)));

  app.get("/runs/:id", async (c) => {
    const run = await store.getRun(c.req.param("id"));
    if (!run) return c.json({ error: "not found" }, 404);
    const diffs = run.gitBefore ? await git.diff(run.gitBefore, run.gitAfter ?? undefined) : [];
    return c.json({ run, diffs });
  });

  app.post("/runs/:id/revert", async (c) => {
    const run = await store.getRun(c.req.param("id"));
    if (!run) return c.json({ error: "not found" }, 404);
    const sha = await vaultLock.run(async () => git.revertRun(run.id));
    return c.json({ ok: true, sha });
  });

  return app;
}
