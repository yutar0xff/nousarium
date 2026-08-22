"use client";

import type {
  AccessPolicy,
  AgentEvent,
  Conversation,
  ConversationIntent,
  ConversationMode,
  FileDiff,
  Message,
  NoteProposal,
  VaultDocument,
} from "@nousarium/contracts";
import {
  ACCESS_POLICY_LABELS,
  CONVERSATION_INTENT_DESCRIPTIONS,
  CONVERSATION_INTENT_LABELS,
  CONVERSATION_MODE_LABELS,
  DEFAULT_INTENT_SETTINGS,
  MODEL_OPTIONS,
} from "@nousarium/core";
import { Button, Field, Pill } from "@nousarium/ui";
import { useEffect, useRef, useState } from "react";
import { api, streamMessage } from "../lib/api";
import { replaceConversationPath } from "../lib/pathname";
import { MarkdownEditor } from "../features/editor/markdown-editor";
import { MarkdownPreview } from "../features/editor/preview";
import { ConflictPanel, parseVaultConflict } from "./conflict-panel";
import { DiffView } from "./diff-view";
import { notifyConversationsChanged } from "./conversation-sidebar";

type ToolRow = {
  id: string;
  tool: string;
  detail?: string;
  status: "started" | "completed";
};

const INTENTS: ConversationIntent[] = ["question", "explore", "research", "vault"];

function modelLabel(id: string) {
  return MODEL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function ChatWorkspace({ conversationId }: { conversationId?: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runDiffs, setRunDiffs] = useState<FileDiff[]>([]);
  const [proposal, setProposal] = useState<NoteProposal | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDir, setNoteDir] = useState("00_Inbox");
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [noteConflict, setNoteConflict] = useState<{ local: NoteProposal; disk: VaultDocument } | null>(null);
  const [intent, setIntent] = useState<ConversationIntent>("explore");
  const [model, setModel] = useState("auto");
  const [mode, setMode] = useState<ConversationMode>(DEFAULT_INTENT_SETTINGS.explore.mode);
  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>(DEFAULT_INTENT_SETTINGS.explore.accessPolicy);
  const bottom = useRef<HTMLDivElement>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef<string | undefined>(conversationId);

  const activeConversationId = conversationId ?? conversation?.id;
  const isNewChat = !activeConversationId;

  async function load(id: string) {
    const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`);
    setConversation(data.conversation);
    setMessages(data.messages);
  }

  function resetChatState() {
    setConversation(null);
    setMessages([]);
    setTools([]);
    setRunDiffs([]);
    setRunId(null);
    setProposal(null);
    setRetryContent(null);
  }

  function upsertAssistantMessage(
    runId: string,
    targetId: string,
    content: string,
    patch?: Partial<Pick<Message, "mode" | "accessPolicy">>,
  ) {
    setMessages((current) => {
      const index = current.findIndex((message) => message.runId === runId && message.role === "assistant");
      if (index >= 0) {
        return current.map((message, i) => (i === index ? { ...message, content } : message));
      }
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          conversationId: targetId,
          role: "assistant",
          content,
          runId,
          mode: patch?.mode ?? conversation?.mode ?? null,
          accessPolicy: patch?.accessPolicy ?? conversation?.accessPolicy ?? null,
          createdAt: new Date().toISOString(),
        },
      ];
    });
  }

  useEffect(() => {
    const prev = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;

    if (!conversationId) {
      if (busy) return;
      if (prev) {
        hydratedIdRef.current = null;
        resetChatState();
      }
      return;
    }
    if (busy) return;
    if (hydratedIdRef.current === conversationId) return;
    hydratedIdRef.current = conversationId;
    void load(conversationId);
  }, [conversationId, busy]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, tools]);

  function selectIntent(next: ConversationIntent) {
    setIntent(next);
    const defaults = DEFAULT_INTENT_SETTINGS[next];
    setMode(defaults.mode);
    setAccessPolicy(defaults.accessPolicy);
  }

  async function changePolicy(patch: { mode?: ConversationMode; accessPolicy?: AccessPolicy; model?: string }) {
    if (!activeConversationId) return;
    const next = await api<Conversation>(`/conversations/${activeConversationId}/policy`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setConversation(next);
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (activeConversationId) return activeConversationId;
    const created = await api<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({
        intent,
        model,
        mode,
        accessPolicy,
      }),
    });
    notifyConversationsChanged();
    setConversation(created);
    return created.id;
  }

  async function sendMessage(content: string, targetId = activeConversationId, syncUrl = false) {
    if (!targetId) return;
    setBusy(true);
    let failed = false;
    try {
      setTools([]);
      setRunDiffs([]);
      setRetryContent(null);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          conversationId: targetId,
          role: "user",
          content,
          runId: null,
          mode: conversation?.mode ?? mode,
          accessPolicy: conversation?.accessPolicy ?? accessPolicy,
          createdAt: new Date().toISOString(),
        },
      ]);
      let assembled = "";
      await streamMessage(targetId, { content }, (raw) => {
        const event = raw as AgentEvent;
        if (event.type === "run.started") {
          setRunId(event.runId);
          upsertAssistantMessage(event.runId, targetId, "", {
            mode: conversation?.mode ?? mode,
            accessPolicy: conversation?.accessPolicy ?? accessPolicy,
          });
        }
        if (event.type === "assistant.delta") {
          assembled += event.text;
          upsertAssistantMessage(event.runId, targetId, assembled);
        }
        if (event.type === "tool.started") {
          setTools((current) => [
            ...current,
            { id: `${event.runId}-${current.length}`, tool: event.tool, detail: event.detail, status: "started" },
          ]);
        }
        if (event.type === "tool.completed") {
          setTools((current) => {
            const index = [...current].reverse().findIndex((row) => row.tool === event.tool && row.status === "started");
            if (index < 0) {
              return [...current, { id: `${event.runId}-done`, tool: event.tool, detail: event.detail, status: "completed" }];
            }
            const actual = current.length - 1 - index;
            return current.map((row, i) =>
              i === actual ? { ...row, detail: event.detail ?? row.detail, status: "completed" } : row,
            );
          });
        }
        if (event.type === "conversation.titled") {
          setConversation((current) => (current ? { ...current, title: event.title } : current));
          notifyConversationsChanged();
        }
        if (event.type === "note.proposed") {
          setProposal(event.proposal);
          setNoteTitle(event.proposal.title);
          setNoteDir(event.proposal.path.replace(/\/[^/]+$/, "") || "00_Inbox");
          setNoteConflict(null);
        }
        if (event.type === "run.finished") {
          if (event.status === "error" && event.error) {
            failed = true;
            setRetryContent(content);
            upsertAssistantMessage(event.runId, targetId, event.error ?? "エラーが発生しました");
          } else if (event.status === "finished" && (assembled || event.result)) {
            upsertAssistantMessage(event.runId, targetId, assembled || event.result || "");
          }
          setRunDiffs(event.diffs ?? []);
          setRunId(null);
        }
      });
      if (!failed) {
        setRetryContent(null);
      } else {
        try {
          const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${targetId}`);
          setConversation(data.conversation);
        } catch {
          // keep optimistic error message
        }
      }
      notifyConversationsChanged();
    } finally {
      if (syncUrl && targetId && !failed) {
        hydratedIdRef.current = targetId;
        replaceConversationPath(targetId);
      }
      setBusy(false);
    }
  }

  async function send() {
    if (!input.trim() || busy) return;
    const content = input.trim();
    setInput("");
    const activeId = await ensureConversation(content);
    await sendMessage(content, activeId, !conversationId);
  }

  async function saveProposal(target: NoteProposal, overwrite = false) {
    try {
      await api<VaultDocument>("/vault/file", {
        method: "PUT",
        body: JSON.stringify({
          path: target.path,
          content: target.content,
          expectedHash: null,
          overwrite,
        }),
      });
      setProposal(null);
      setNoteTitle("");
      setNoteConflict(null);
    } catch (error) {
      const conflict = parseVaultConflict(error);
      if (conflict) {
        const disk = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(conflict.path)}`);
        setNoteConflict({ local: target, disk });
        return;
      }
      throw error;
    }
  }

  const pending =
    conversation?.pendingAccessPolicy || conversation?.pendingMode || conversation?.pendingModel
      ? "次の送信から適用"
      : null;

  const showWelcome = isNewChat && messages.length === 0 && !busy;

  return (
    <div className="flex h-full flex-col">
      {!isNewChat && conversation ? (
        <div className="shrink-0 border-b border-stroke bg-surface-elevated p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{conversation.title}</h1>
            <Pill>{CONVERSATION_INTENT_LABELS[conversation.intent]}</Pill>
            {pending ? <Pill tone="warning">{pending}</Pill> : null}
          </div>
          <p className="mb-2 text-xs text-text-secondary">
            現在: {modelLabel(conversation.model)} · {CONVERSATION_MODE_LABELS[conversation.mode]} /{" "}
            {ACCESS_POLICY_LABELS[conversation.accessPolicy]}
            {pending ? (
              <>
                {" "}
                · 次回: {modelLabel(conversation.pendingModel ?? conversation.model)} ·{" "}
                {CONVERSATION_MODE_LABELS[conversation.pendingMode ?? conversation.mode]} /{" "}
                {ACCESS_POLICY_LABELS[conversation.pendingAccessPolicy ?? conversation.accessPolicy]}
              </>
            ) : null}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="モデル（次回送信）">
              <select
                value={conversation.pendingModel ?? conversation.model}
                onChange={(event) => void changePolicy({ model: event.target.value })}
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="モード（次回送信）">
              <select
                value={conversation.pendingMode ?? conversation.mode}
                onChange={(event) => void changePolicy({ mode: event.target.value as ConversationMode })}
              >
                <option value="plan">{CONVERSATION_MODE_LABELS.plan}</option>
                <option value="agent">{CONVERSATION_MODE_LABELS.agent}</option>
              </select>
            </Field>
            <Field label="権限（次回送信）">
              <select
                value={conversation.pendingAccessPolicy ?? conversation.accessPolicy}
                onChange={(event) => void changePolicy({ accessPolicy: event.target.value as AccessPolicy })}
              >
                <option value="chat">{ACCESS_POLICY_LABELS.chat}</option>
                <option value="read">{ACCESS_POLICY_LABELS.read}</option>
                <option value="vault-work">{ACCESS_POLICY_LABELS["vault-work"]}</option>
              </select>
            </Field>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {showWelcome ? (
          <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-8">
            <div className="text-center">
              <h1 className="text-2xl font-semibold">何をしたいですか？</h1>
              <p className="mt-2 text-sm text-text-secondary">用途を選んでからメッセージを送ると、AI の振る舞いが変わります。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectIntent(value)}
                  className={`rounded-sm border px-4 py-3 text-left ${
                    intent === value ? "border-accent bg-accent-soft" : "border-stroke bg-surface-elevated hover:bg-surface"
                  }`}
                >
                  <div className="font-medium">{CONVERSATION_INTENT_LABELS[value]}</div>
                  <div className="mt-1 text-xs text-text-secondary">{CONVERSATION_INTENT_DESCRIPTIONS[value]}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="モデル">
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="モード">
                <select value={mode} onChange={(event) => setMode(event.target.value as ConversationMode)}>
                  <option value="plan">{CONVERSATION_MODE_LABELS.plan}</option>
                  <option value="agent">{CONVERSATION_MODE_LABELS.agent}</option>
                </select>
              </Field>
              <Field label="権限">
                <select value={accessPolicy} onChange={(event) => setAccessPolicy(event.target.value as AccessPolicy)}>
                  <option value="chat">{ACCESS_POLICY_LABELS.chat}</option>
                  <option value="read">{ACCESS_POLICY_LABELS.read}</option>
                  <option value="vault-work">{ACCESS_POLICY_LABELS["vault-work"]}</option>
                </select>
              </Field>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3" aria-live="polite">
            {messages.map((message) => {
              if (message.role === "assistant" && !message.content) return null;
              return (
              <article key={message.runId ?? message.id} className="rounded-sm border border-stroke bg-surface-elevated p-3">
                <div className="mb-1 text-xs text-text-secondary">
                  {message.role === "user" ? "自分" : "AI"}
                  {message.accessPolicy ? ` · ${ACCESS_POLICY_LABELS[message.accessPolicy]}` : ""}
                </div>
                {message.role === "assistant" ? (
                  <MarkdownPreview value={message.content} />
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                )}
              </article>
              );
            })}
            {tools.length > 0 ? (
              <section className="rounded-sm border border-stroke p-2">
                <h2 className="mb-2 text-xs font-semibold text-text-secondary">ツール実行</h2>
                {tools.map((tool) => (
                  <details key={tool.id} className="mb-1 text-sm">
                    <summary>
                      {tool.tool} {tool.status === "completed" ? "完了" : "実行中"}
                    </summary>
                    {tool.detail ? <pre className="mt-1 text-xs">{tool.detail}</pre> : null}
                  </details>
                ))}
              </section>
            ) : null}
            {retryContent ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void sendMessage(retryContent)}>
                  再送
                </Button>
              </div>
            ) : null}
            {runDiffs.length > 0 ? (
              <section className="rounded-sm border border-stroke p-3">
                <h2 className="mb-2 text-sm font-semibold">この Run の差分</h2>
                <DiffView diffs={runDiffs} />
              </section>
            ) : null}
            {!isNewChat && conversation && activeConversationId ? (
              <section className="rounded-sm border border-stroke p-3">
                <h2 className="mb-2 text-sm font-semibold">この会話からノートを作成</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="タイトル">
                    <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
                  </Field>
                  <Field label="保存先">
                    <input value={noteDir} onChange={(event) => setNoteDir(event.target.value)} />
                  </Field>
                </div>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={async () => {
                    const created = await api<NoteProposal>(`/conversations/${activeConversationId}/notes`, {
                      method: "POST",
                      body: JSON.stringify({
                        title: noteTitle || conversation.title || "新しいノート",
                        directory: noteDir,
                      }),
                    });
                    setProposal(created);
                    setNoteConflict(null);
                  }}
                >
                  下書きを作る
                </Button>
                {noteConflict ? (
                  <div className="mt-3">
                    <ConflictPanel
                      path={noteConflict.local.path}
                      localContent={noteConflict.local.content}
                      disk={noteConflict.disk}
                      onKeepLocal={() => void saveProposal(noteConflict.local, true)}
                      onUseDisk={() => {
                        setProposal({ ...noteConflict.local, content: noteConflict.disk.content });
                        setNoteConflict(null);
                      }}
                      onDismiss={() => setNoteConflict(null)}
                    />
                  </div>
                ) : null}
                {proposal ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-xs text-text-secondary">{proposal.path}</p>
                    <MarkdownEditor
                      value={proposal.content}
                      onChange={(value) => setProposal({ ...proposal, content: value })}
                    />
                    <Button onClick={() => void saveProposal(proposal)}>保存する</Button>
                  </div>
                ) : null}
              </section>
            ) : null}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stroke bg-surface p-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            className="min-h-14 flex-1"
            value={input}
            placeholder={
              showWelcome
                ? `${CONVERSATION_INTENT_LABELS[intent]}の用途で、メッセージを入力…`
                : "考えていること、疑問、残したいことを書く"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {busy && activeConversationId ? (
            <Button
              variant="danger"
              onClick={async () => {
                if (runId) await api(`/conversations/${activeConversationId}/cancel?runId=${runId}`, { method: "POST" });
              }}
            >
              停止
            </Button>
          ) : (
            <Button onClick={() => void send()} disabled={busy}>
              送信
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
