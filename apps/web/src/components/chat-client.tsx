"use client";

import type { AccessPolicy, AgentEvent, Conversation, ConversationMode, FileDiff, Message, NoteProposal } from "@nousarium/contracts";
import { ACCESS_POLICY_LABELS, CONVERSATION_MODE_LABELS } from "@nousarium/core";
import { Button, Field, Pill } from "@nousarium/ui";
import { useEffect, useRef, useState } from "react";
import { api, streamMessage } from "../lib/api";
import { MarkdownEditor } from "../features/editor/markdown-editor";

export function ChatClient({ conversationId }: { conversationId: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [proposal, setProposal] = useState<NoteProposal | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDir, setNoteDir] = useState("00_Inbox");
  const bottom = useRef<HTMLDivElement>(null);

  async function load() {
    const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${conversationId}`);
    setConversation(data.conversation);
    setMessages(data.messages);
  }

  useEffect(() => {
    void load();
  }, [conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  async function changePolicy(patch: { mode?: ConversationMode; accessPolicy?: AccessPolicy }) {
    const next = await api<Conversation>(`/conversations/${conversationId}/policy`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setConversation(next);
  }

  async function send() {
    if (!input.trim() || busy) return;
    const content = input.trim();
    setInput("");
    setBusy(true);
    setStreaming("");
    setDiffs([]);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        conversationId,
        role: "user",
        content,
        runId: null,
        mode: conversation?.mode ?? null,
        accessPolicy: conversation?.accessPolicy ?? null,
        createdAt: new Date().toISOString(),
      },
    ]);
    let assembled = "";
    await streamMessage(conversationId, { content }, (raw) => {
      const event = raw as AgentEvent;
      if (event.type === "run.started") setRunId(event.runId);
      if (event.type === "assistant.delta") {
        assembled += event.text;
        setStreaming(assembled);
      }
      if (event.type === "run.finished") {
        if (event.status === "error" && event.error) {
          const errorText = event.error;
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              conversationId,
              role: "assistant" as const,
              content: errorText,
              runId: event.runId,
              mode: conversation?.mode ?? null,
              accessPolicy: conversation?.accessPolicy ?? null,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
        setDiffs(event.diffs ?? []);
        setStreaming("");
        setRunId(null);
      }
    });
    await load();
    setBusy(false);
  }

  const pending =
    conversation?.pendingAccessPolicy || conversation?.pendingMode
      ? "次の送信から適用"
      : null;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="sticky top-14 z-10 rounded-sm border border-stroke bg-surface-elevated p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{conversation?.title ?? "対話"}</h1>
          {pending ? <Pill>{pending}</Pill> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="モード">
            <select
              value={conversation?.pendingMode ?? conversation?.mode ?? "plan"}
              onChange={(event) => void changePolicy({ mode: event.target.value as ConversationMode })}
            >
              <option value="plan">{CONVERSATION_MODE_LABELS.plan}</option>
              <option value="agent">{CONVERSATION_MODE_LABELS.agent}</option>
            </select>
          </Field>
          <Field label="権限">
            <select
              value={conversation?.pendingAccessPolicy ?? conversation?.accessPolicy ?? "read"}
              onChange={(event) => void changePolicy({ accessPolicy: event.target.value as AccessPolicy })}
            >
              <option value="chat">{ACCESS_POLICY_LABELS.chat}</option>
              <option value="read">{ACCESS_POLICY_LABELS.read}</option>
              <option value="vault-work">{ACCESS_POLICY_LABELS["vault-work"]}</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className="rounded-sm border border-stroke bg-surface-elevated p-3">
            <div className="mb-1 text-xs text-text-secondary">
              {message.role === "user" ? "自分" : "AI"}
              {message.accessPolicy ? ` · ${ACCESS_POLICY_LABELS[message.accessPolicy]}` : ""}
            </div>
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          </article>
        ))}
        {streaming ? (
          <article className="rounded-sm border border-stroke bg-accent-soft p-3 text-sm whitespace-pre-wrap">
            {streaming}
          </article>
        ) : null}
        <div ref={bottom} />
      </div>

      {diffs.length > 0 ? (
        <section className="rounded-sm border border-stroke p-3">
          <h2 className="mb-2 text-sm font-semibold">この Run の差分</h2>
          {diffs.map((diff) => (
            <details key={diff.path} className="mb-2">
              <summary>
                {diff.path} ({diff.status})
              </summary>
              <pre>{diff.patch}</pre>
            </details>
          ))}
        </section>
      ) : null}

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
            const created = await api<NoteProposal>(`/conversations/${conversationId}/notes`, {
              method: "POST",
              body: JSON.stringify({ title: noteTitle || conversation?.title || "新しいノート", directory: noteDir }),
            });
            setProposal(created);
          }}
        >
          下書きを作る
        </Button>
        {proposal ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-text-secondary">{proposal.path}</p>
            <MarkdownEditor value={proposal.content} onChange={(value) => setProposal({ ...proposal, content: value })} />
            <Button
              onClick={async () => {
                await api("/vault/file", {
                  method: "PUT",
                  body: JSON.stringify({ path: proposal.path, content: proposal.content, expectedHash: null }),
                });
                setProposal(null);
                setNoteTitle("");
              }}
            >
              保存する
            </Button>
          </div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-6xl gap-2 border-t border-stroke bg-surface p-3">
        <textarea
          className="min-h-14 flex-1"
          value={input}
          placeholder="考えていること、疑問、残したいことを書く"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <Button
            variant="danger"
            onClick={async () => {
              if (runId) await api(`/conversations/${conversationId}/cancel?runId=${runId}`, { method: "POST" });
            }}
          >
            停止
          </Button>
        ) : (
          <Button onClick={() => void send()}>送信</Button>
        )}
      </div>
    </div>
  );
}
