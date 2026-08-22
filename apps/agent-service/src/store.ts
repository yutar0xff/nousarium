import type { Conversation, AccessPolicy, Message, Run } from "@nousarium/contracts";
import type { ConversationStore } from "@nousarium/core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createSqliteStore(runtimePath: string): ConversationStore {
  mkdirSync(runtimePath, { recursive: true });
  const db = new DatabaseSync(path.join(runtimePath, "nousarium.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cursor_agent_id TEXT,
      model TEXT NOT NULL,
      access_policy TEXT NOT NULL,
      pending_access_policy TEXT,
      pending_model TEXT,
      journal_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      run_id TEXT,
      access_policy TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      access_policy TEXT NOT NULL,
      git_before TEXT,
      git_after TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );
  `);

  return {
    async listConversations() {
      const rows = db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as Record<string, unknown>[];
      return rows.map(mapConversation);
    },
    async getConversation(id) {
      const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      return row ? mapConversation(row) : null;
    },
    async createConversation(input) {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        title: input.title,
        cursorAgentId: null,
        model: input.model,
        accessPolicy: input.accessPolicy,
        pendingAccessPolicy: null,
        pendingModel: null,
        journalPath: null,
        createdAt: now,
        updatedAt: now,
      };
      db.prepare(
        `INSERT INTO conversations (id, title, cursor_agent_id, model, access_policy, pending_access_policy, pending_model, journal_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        conversation.id,
        conversation.title,
        conversation.cursorAgentId,
        conversation.model,
        conversation.accessPolicy,
        conversation.pendingAccessPolicy,
        conversation.pendingModel,
        conversation.journalPath,
        conversation.createdAt,
        conversation.updatedAt,
      );
      return conversation;
    },
    async updateConversation(id, patch) {
      const current = await this.getConversation(id);
      if (!current) throw new Error("conversation not found");
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      db.prepare(
        `UPDATE conversations SET title=?, cursor_agent_id=?, model=?, access_policy=?, pending_access_policy=?, pending_model=?, journal_path=?, updated_at=? WHERE id=?`,
      ).run(
        next.title,
        next.cursorAgentId,
        next.model,
        next.accessPolicy,
        next.pendingAccessPolicy,
        next.pendingModel,
        next.journalPath,
        next.updatedAt,
        id,
      );
      return next;
    },
    async listMessages(conversationId) {
      const rows = db
        .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
        .all(conversationId) as Record<string, unknown>[];
      return rows.map(mapMessage);
    },
    async addMessage(message) {
      const row: Message = {
        id: message.id ?? crypto.randomUUID(),
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        runId: message.runId,
        accessPolicy: message.accessPolicy,
        createdAt: new Date().toISOString(),
      };
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, run_id, access_policy, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(row.id, row.conversationId, row.role, row.content, row.runId, row.accessPolicy, row.createdAt);
      return row;
    },
    async createRun(run) {
      const row: Run = {
        id: run.id,
        conversationId: run.conversationId,
        status: run.status,
        model: run.model,
        accessPolicy: run.accessPolicy,
        gitBefore: run.gitBefore,
        gitAfter: run.gitAfter ?? null,
        error: run.error ?? null,
        startedAt: run.startedAt,
        finishedAt: null,
      };
      db.prepare(
        `INSERT INTO runs (id, conversation_id, status, model, access_policy, git_before, git_after, error, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.id,
        row.conversationId,
        row.status,
        row.model,
        row.accessPolicy,
        row.gitBefore,
        row.gitAfter,
        row.error,
        row.startedAt,
        row.finishedAt,
      );
      return row;
    },
    async updateRun(id, patch) {
      const current = await this.getRun(id);
      if (!current) throw new Error("run not found");
      const next = { ...current, ...patch };
      db.prepare(
        `UPDATE runs SET status=?, git_before=?, git_after=?, error=?, finished_at=? WHERE id=?`,
      ).run(next.status, next.gitBefore, next.gitAfter, next.error, next.finishedAt, id);
      return next;
    },
    async listRuns(conversationId) {
      const rows = conversationId
        ? (db.prepare("SELECT * FROM runs WHERE conversation_id = ? ORDER BY started_at DESC").all(conversationId) as Record<string, unknown>[])
        : (db.prepare("SELECT * FROM runs ORDER BY started_at DESC").all() as Record<string, unknown>[]);
      return rows.map(mapRun);
    },
    async getRun(id) {
      const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      return row ? mapRun(row) : null;
    },
  };
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    title: String(row.title),
    cursorAgentId: row.cursor_agent_id ? String(row.cursor_agent_id) : null,
    model: row.model ? String(row.model) : "auto",
    accessPolicy: row.access_policy as AccessPolicy,
    pendingAccessPolicy: row.pending_access_policy ? (row.pending_access_policy as AccessPolicy) : null,
    pendingModel: row.pending_model ? String(row.pending_model) : null,
    journalPath: row.journal_path ? String(row.journal_path) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: row.role as Message["role"],
    content: String(row.content),
    runId: row.run_id ? String(row.run_id) : null,
    accessPolicy: row.access_policy ? (row.access_policy as AccessPolicy) : null,
    createdAt: String(row.created_at),
  };
}

function mapRun(row: Record<string, unknown>): Run {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    status: row.status as Run["status"],
    model: row.model ? String(row.model) : "auto",
    accessPolicy: row.access_policy as AccessPolicy,
    gitBefore: row.git_before ? String(row.git_before) : null,
    gitAfter: row.git_after ? String(row.git_after) : null,
    error: row.error ? String(row.error) : null,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}
