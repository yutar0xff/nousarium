"use client";

import type { AccessPolicy, AgentEvent, Conversation, FileDiff, Message, VaultDocument } from "@nousarium/contracts";
import { DEFAULT_ACCESS_POLICY } from "@nousarium/core";
import {
  Button,
  ChevronDownIcon,
  IconButton,
  SendIcon,
  Sheet,
  StopIcon,
  Switch,
  Textarea,
} from "@nousarium/ui";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, streamMessage } from "../lib/api";
import { consumeNewConversationRequest, NEW_CONVERSATION } from "../lib/new-conversation";
import { replaceConversationPath } from "../lib/pathname";
import { MarkdownPreview } from "../features/editor/preview";
import { DiffView, summarizeDiffs } from "./diff-view";
import { notifyConversationsChanged } from "./conversation-sidebar";
import { useChrome } from "./chrome-context";

type ToolRow = {
  id: string;
  tool: string;
  detail?: string;
  status: "started" | "completed";
};

function UserBubble({ content }: { content: string }) {
  const preview = content.replace(/\s+/g, " ").trim();
  return (
    <article className="flex justify-end">
      <details className="group max-w-[min(80%,24rem)] rounded-2xl bg-accent-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-caption text-text-secondary [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 truncate group-open:hidden">{preview}</span>
          <span className="hidden min-w-0 flex-1 text-caption text-text-muted group-open:block">自分</span>
          <ChevronDownIcon className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="whitespace-pre-wrap px-3 pb-3 text-body text-text-primary">{content}</div>
      </details>
    </article>
  );
}

function isJournalDiff(diff: FileDiff) {
  return diff.path.startsWith("Journal/Conversations/");
}

function notePathFromTarget(target: string) {
  const name = target.replace(/\.md$/, "");
  return `Notes/${name}.md`;
}

export function ChatWorkspace({ conversationId }: { conversationId?: string }) {
  const { setTitle, setChat } = useChrome();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [finishedRunId, setFinishedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runDiffs, setRunDiffs] = useState<FileDiff[]>([]);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [model, setModel] = useState("auto");
  const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>(DEFAULT_ACCESS_POLICY);
  const [excluded, setExcluded] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [preview, setPreview] = useState<VaultDocument | null>(null);
  const [knownNotes, setKnownNotes] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef<string | undefined>(conversationId);
  const streamGen = useRef(0);
  const skipLoadRef = useRef(false);

  const activeConversationId = conversationId ?? conversation?.id;
  const isNewChat = !activeConversationId;
  const currentAccess = conversation
    ? (conversation.pendingAccessPolicy ?? conversation.accessPolicy)
    : accessPolicy;
  const currentModel = conversation ? (conversation.pendingModel ?? conversation.model) : model;
  const pending = conversation?.pendingAccessPolicy || conversation?.pendingModel ? "次の送信から適用" : null;
  const noteDiffs = runDiffs.filter((diff) => !isJournalDiff(diff));
  const journalDiffs = runDiffs.filter(isJournalDiff);
  const showWelcome = isNewChat && messages.length === 0 && !busy;
  const diffSummary = summarizeDiffs(noteDiffs);

  async function load(id: string) {
    const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`);
    setConversation(data.conversation);
    setMessages(data.messages);
    setModel(data.conversation.model);
    setAccessPolicy(data.conversation.accessPolicy);
  }

  function resetChatState() {
    setConversation(null);
    setMessages([]);
    setTools([]);
    setRunDiffs([]);
    setRunId(null);
    setFinishedRunId(null);
    setRetryContent(null);
    setExcluded(false);
    setPreview(null);
    setContextOpen(false);
    setInput("");
    setBusy(false);
    if (textareaRef.current) textareaRef.current.style.height = "";
  }

  function beginNewConversation() {
    streamGen.current += 1;
    skipLoadRef.current = true;
    hydratedIdRef.current = null;
    resetChatState();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function upsertAssistantMessage(
    targetRunId: string,
    targetId: string,
    content: string,
    patch?: Partial<Pick<Message, "accessPolicy">>,
  ) {
    setMessages((current) => {
      const index = current.findIndex((message) => message.runId === targetRunId && message.role === "assistant");
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
          runId: targetRunId,
          accessPolicy: patch?.accessPolicy ?? conversation?.accessPolicy ?? null,
          createdAt: new Date().toISOString(),
        },
      ];
    });
  }

  useEffect(() => {
    if (!conversationId) {
      skipLoadRef.current = false;
      const prev = prevConversationIdRef.current;
      prevConversationIdRef.current = conversationId;
      if (prev) {
        streamGen.current += 1;
        hydratedIdRef.current = null;
        resetChatState();
      }
      return;
    }
    if (skipLoadRef.current) return;
    prevConversationIdRef.current = conversationId;
    if (busy) return;
    if (hydratedIdRef.current === conversationId) return;
    hydratedIdRef.current = conversationId;
    void load(conversationId);
  }, [conversationId, busy]);

  useEffect(() => {
    function onNew() {
      if (!consumeNewConversationRequest()) return;
      beginNewConversation();
    }
    if (consumeNewConversationRequest()) beginNewConversation();
    window.addEventListener(NEW_CONVERSATION, onNew);
    return () => window.removeEventListener(NEW_CONVERSATION, onNew);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, tools]);

  useEffect(() => {
    void api<{ name: string; kind: string }[]>("/vault/tree?path=Notes")
      .then((entries) =>
        setKnownNotes(
          entries
            .filter((entry) => entry.kind === "file" && entry.name.endsWith(".md"))
            .map((entry) => entry.name.replace(/\.md$/, "")),
        ),
      )
      .catch(() => setKnownNotes([]));
  }, [runDiffs]);

  useEffect(() => {
    setTitle(conversation?.title ?? "新しい対話");
  }, [conversation?.title, setTitle]);

  useEffect(() => {
    setChat({
      conversationId: activeConversationId ?? null,
      model: currentModel,
      onModelChange: (next) => void changePolicy({ model: next }),
      excluded,
      onExclude: () => void excludeJournal(),
      pending,
    });
  }, [activeConversationId, currentModel, excluded, pending, conversation?.id]);

  useEffect(() => {
    return () => setChat(null);
  }, [setChat]);

  async function changePolicy(patch: { accessPolicy?: AccessPolicy; model?: string }) {
    if (!activeConversationId) {
      if (patch.accessPolicy) setAccessPolicy(patch.accessPolicy);
      if (patch.model) setModel(patch.model);
      return;
    }
    const next = await api<Conversation>(`/conversations/${activeConversationId}/policy`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setConversation(next);
  }

  async function ensureConversation(): Promise<string> {
    if (activeConversationId) return activeConversationId;
    const created = await api<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({
        model,
        accessPolicy,
      }),
    });
    notifyConversationsChanged();
    setConversation(created);
    return created.id;
  }

  async function sendMessage(content: string, targetId = activeConversationId, syncUrl = false) {
    if (!targetId) return;
    const gen = ++streamGen.current;
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
          accessPolicy: conversation?.accessPolicy ?? accessPolicy,
          createdAt: new Date().toISOString(),
        },
      ]);
      let assembled = "";
      await streamMessage(targetId, { content }, (raw) => {
        if (gen !== streamGen.current) return;
        const event = raw as AgentEvent;
        if (event.type === "run.started") {
          setRunId(event.runId);
          upsertAssistantMessage(event.runId, targetId, "", {
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
        if (event.type === "run.finished") {
          if (event.status === "error" && event.error) {
            failed = true;
            setRetryContent(content);
            upsertAssistantMessage(event.runId, targetId, event.error ?? "エラーが発生しました");
          } else if (event.status === "finished" && (assembled || event.result)) {
            upsertAssistantMessage(event.runId, targetId, assembled || event.result || "");
          }
          setRunDiffs(event.diffs ?? []);
          setFinishedRunId(event.runId);
          setRunId(null);
        }
      });
      if (gen !== streamGen.current) return;
      if (!failed) {
        setRetryContent(null);
      } else {
        try {
          const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${targetId}`);
          if (gen !== streamGen.current) return;
          setConversation(data.conversation);
        } catch {
          // keep optimistic error message
        }
      }
      notifyConversationsChanged();
    } finally {
      if (gen !== streamGen.current) return;
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
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
    const activeId = await ensureConversation();
    await sendMessage(content, activeId, !conversationId);
  }

  async function revertLastRun() {
    if (!finishedRunId) return;
    setReverting(true);
    try {
      await api(`/runs/${finishedRunId}/revert`, { method: "POST" });
      setRunDiffs([]);
      setFinishedRunId(null);
    } finally {
      setReverting(false);
    }
  }

  async function excludeJournal() {
    if (!activeConversationId) return;
    const next = await api<Conversation>(`/conversations/${activeConversationId}/exclude`, { method: "POST" });
    setConversation(next);
    setExcluded(true);
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 16 * 1.5 * 8;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }

  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  async function openNote(target: string) {
    try {
      const doc = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(notePathFromTarget(target))}`);
      setPreview(doc);
      setContextOpen(true);
    } catch {
      setPreview({ path: notePathFromTarget(target), content: "", hash: "" });
      setContextOpen(true);
    }
  }

  const contextBody = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {preview ? (
        <section>
          <h2 className="mb-2 text-heading font-medium">{preview.path.replace(/^Notes\//, "").replace(/\.md$/, "")}</h2>
          {preview.content ? (
            <MarkdownPreview value={preview.content} knownNotes={knownNotes} />
          ) : (
            <p className="text-ui text-text-muted">まだノートはありません。</p>
          )}
        </section>
      ) : null}
      {runDiffs.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-heading font-medium">この会話で更新されたノート</h2>
            {finishedRunId ? (
              <Button variant="danger" onClick={() => void revertLastRun()} disabled={reverting}>
                この変更を取り消す
              </Button>
            ) : null}
          </div>
          {noteDiffs.length > 0 ? (
            <DiffView diffs={noteDiffs} />
          ) : (
            <p className="text-ui text-text-secondary">ノートの変更はありません。</p>
          )}
          {journalDiffs.length > 0 ? (
            <details className="mt-3">
              <summary className="text-caption text-text-secondary">対話ログ</summary>
              <div className="mt-2">
                <DiffView diffs={journalDiffs} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  const composer = (
    <div className="shrink-0 border-t border-stroke bg-surface px-3 py-2">
      <div className="mx-auto flex max-w-[46rem] items-end gap-2">
        <Switch
          checked={currentAccess === "vault"}
          onCheckedChange={(checked) => void changePolicy({ accessPolicy: checked ? "vault" : "chat" })}
          label="Vault"
        />
        <Textarea
          ref={textareaRef}
          className="max-h-[14rem] min-h-11 w-auto min-w-0 flex-1"
          value={input}
          rows={1}
          placeholder="メッセージを書く"
          onChange={(event) => {
            setInput(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={onComposerKey}
        />
        {busy && activeConversationId ? (
          <IconButton
            variant="danger"
            label="停止"
            onClick={async () => {
              if (runId) await api(`/conversations/${activeConversationId}/cancel?runId=${runId}`, { method: "POST" });
            }}
          >
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton variant="primary" label="送信" onClick={() => void send()} disabled={busy || !input.trim()}>
            <SendIcon />
          </IconButton>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
          {showWelcome ? (
            <div className="mx-auto flex max-w-[46rem] flex-col items-center gap-3 px-2 pt-8 text-center md:pt-16">
              <h2 className="text-title font-semibold text-text-primary md:text-display">何を考えていますか？</h2>
              <p className="text-ui text-text-secondary">質問の深さも、ノートに残すかも、AI が判断します。</p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-[46rem] flex-col gap-6" aria-live="polite">
              {messages.map((message) => {
                if (message.role === "assistant" && !message.content) return null;
                const streaming = Boolean(busy && message.role === "assistant" && message.runId === runId);
                if (message.role === "user") {
                  return <UserBubble key={message.runId ?? message.id} content={message.content} />;
                }
                return (
                  <article key={message.runId ?? message.id} className="border-l-2 border-accent pl-4">
                    {retryContent && message.content && !streaming ? (
                      <div className="mb-2" aria-live="assertive">
                        <Button variant="secondary" onClick={() => void sendMessage(retryContent)}>
                          再送
                        </Button>
                      </div>
                    ) : null}
                    <MarkdownPreview
                      value={message.content}
                      knownNotes={knownNotes}
                      streaming={streaming}
                      onWikiLink={openNote}
                    />
                  </article>
                );
              })}
              {tools.length > 0 ? (
                <section className="flex flex-col gap-1">
                  {tools.map((tool) => (
                    <details key={tool.id} className="text-caption text-text-muted">
                      <summary className="cursor-pointer">
                        {tool.tool} · {tool.status === "completed" ? "完了" : "実行中"}
                      </summary>
                      {tool.detail ? <pre className="mt-1 overflow-x-auto rounded-xl bg-surface-sunken p-2 font-mono text-mono">{tool.detail}</pre> : null}
                    </details>
                  ))}
                </section>
              ) : null}
              {runDiffs.length > 0 ? (
                <button
                  type="button"
                  className="self-start rounded-lg text-ui text-accent underline-offset-2 hover:underline"
                  onClick={() => {
                    setPreview(null);
                    setContextOpen(true);
                  }}
                >
                  {diffSummary}
                </button>
              ) : null}
              <div ref={bottom} />
            </div>
          )}
        </div>
        {composer}
      </div>

      {contextOpen ? (
        <aside className="hidden w-[360px] shrink-0 border-l border-stroke bg-surface-elevated lg:flex lg:flex-col">
          {contextBody}
        </aside>
      ) : null}

      <div className="absolute h-0 w-0 overflow-hidden lg:hidden">
        <Sheet open={contextOpen} onOpenChange={setContextOpen} side="right" title="詳細">
          {contextBody}
        </Sheet>
      </div>
    </div>
  );
}
