"use client";

import type { AccessPolicy, AgentEvent, Conversation, FileDiff, Message } from "@nousarium/contracts";
import { DEFAULT_ACCESS_POLICY } from "@nousarium/core";
import { isJournalPath, noteTitleFromPath } from "@nousarium/markdown";
import {
  Button,
  ChevronDownIcon,
  cn,
  IconButton,
  MicIcon,
  Select,
  SendIcon,
  Sheet,
  SpeechCancelIcon,
  SpeechEditIcon,
  SpeechSendIcon,
  StopIcon,
  Textarea,
  useToast,
} from "@nousarium/ui";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, streamMessage } from "../lib/api";
import { consumeNewConversationRequest, NEW_CONVERSATION } from "../lib/new-conversation";
import { RUN_STATUS_LABELS, runStatusLabel, toolStatusLabel } from "../lib/run-status";
import { replaceConversationPath } from "../lib/pathname";
import { useSpeechInput } from "../lib/use-speech-input";
import { useWikiNavigation } from "../lib/use-wiki-navigation";
import { isWikiJournalTarget } from "../lib/wiki-nav";
import { MarkdownPreview } from "../features/editor/preview";
import {
  ComposerAttachControls,
  ComposerAttachmentCapsules,
  createNoteAttachment,
  serializeComposerMessage,
  type ComposerAttachment,
} from "./composer-attach";
import { DiffView, summarizeDiffs } from "./diff-view";
import { notifyConversationsChanged } from "./conversation-sidebar";
import { useChrome } from "./chrome-context";
import { useModels } from "../lib/use-models";
import { VaultPeekDialog, type VaultPeek } from "./vault-peek";

type ToolRow = {
  id: string;
  tool: string;
  detail?: string;
  status: "started" | "completed";
};

function UserBubble({
  content,
  knownNotes,
  onWikiLink,
  onImageClick,
}: {
  content: string;
  knownNotes: string[];
  onWikiLink: (target: string) => void;
  onImageClick: (path: string, alt?: string) => void;
}) {
  const preview = content.replace(/\s+/g, " ").trim();
  const hasMarkdown = content.includes("[[") || content.includes("![") || content.includes("\n") || content.includes("`");
  return (
    <article className="flex justify-end">
      <details className="group max-w-[min(80%,24rem)] rounded-2xl bg-accent-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-caption text-text-secondary [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 truncate group-open:hidden">{preview}</span>
          <span className="hidden min-w-0 flex-1 text-caption text-text-muted group-open:block">自分</span>
          <ChevronDownIcon className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
        </summary>
        {hasMarkdown ? (
          <div className="px-3 pb-3">
            <MarkdownPreview
              value={content}
              knownNotes={knownNotes}
              onWikiLink={onWikiLink}
              onImageClick={onImageClick}
            />
          </div>
        ) : (
          <div className="whitespace-pre-wrap px-3 pb-3 text-body text-text-primary">{content}</div>
        )}
      </details>
    </article>
  );
}

function isJournalDiff(diff: FileDiff) {
  return isJournalPath(diff.path);
}

export function ChatWorkspace({ conversationId }: { conversationId?: string }) {
  const { setTitle, setChat } = useChrome();
  const { optionsFor, defaultModel } = useModels();
  const { toast } = useToast();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const speech = useSpeechInput({
    onError: (message) => toast(message, "danger"),
  });
  const speechRef = useRef(speech);
  speechRef.current = speech;
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [finishedRunId, setFinishedRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitLabel, setWaitLabel] = useState<string | null>(null);
  const [runDiffs, setRunDiffs] = useState<FileDiff[]>([]);
  const [retryContent, setRetryContent] = useState<string | null>(null);
  const [model, setModel] = useState("auto");
  const [excluded, setExcluded] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [knownNotes, setKnownNotes] = useState<string[]>([]);
  const [peek, setPeek] = useState<VaultPeek | null>(null);
  const navigateWikiTarget = useWikiNavigation();
  const bottom = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const followOutputRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef<string | undefined>(conversationId);
  const streamGen = useRef(0);
  const skipLoadRef = useRef(false);
  const seededNoteRef = useRef(false);

  const activeConversationId = conversationId ?? conversation?.id;
  const isNewChat = !activeConversationId;
  const currentModel = conversation ? (conversation.pendingModel ?? conversation.model) : model;
  const pending = conversation?.pendingModel ? "次の送信から適用" : null;
  const noteDiffs = runDiffs.filter((diff) => !isJournalDiff(diff));
  const journalDiffs = runDiffs.filter(isJournalDiff);
  const showWelcome = isNewChat && messages.length === 0 && !busy;
  const hasAssistantContent = messages.some(
    (message) => message.role === "assistant" && message.runId === runId && message.content,
  );
  const showWait = Boolean(busy && waitLabel && !hasAssistantContent && tools.length === 0);
  const diffSummary = summarizeDiffs(noteDiffs);

  function openChatWiki(target: string) {
    if (isWikiJournalTarget(target)) {
      setPeek(null);
      void navigateWikiTarget(target);
      return;
    }
    setPeek({ kind: "note", target });
  }

  function openChatImage(path: string, alt?: string) {
    setPeek({ kind: "image", path, alt });
  }

  async function load(id: string) {
    const data = await api<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`);
    let next = data.conversation;
    if (next.accessPolicy !== "vault" || next.pendingAccessPolicy === "chat") {
      next = await api<Conversation>(`/conversations/${id}/policy`, {
        method: "PATCH",
        body: JSON.stringify({ accessPolicy: DEFAULT_ACCESS_POLICY }),
      });
    }
    setConversation(next);
    setMessages(data.messages);
    setModel(next.model);
  }

  function resetChatState() {
    if (speechRef.current.listening) void speechRef.current.stop();
    setConversation(null);
    setMessages([]);
    setTools([]);
    setRunDiffs([]);
    setRunId(null);
    setFinishedRunId(null);
    setRetryContent(null);
    setExcluded(false);
    setContextOpen(false);
    setPeek(null);
    setInput("");
    setAttachments([]);
    setBusy(false);
    setWaitLabel(null);
    followOutputRef.current = true;
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
    if (conversationId || conversation) return;
    setModel(defaultModel);
  }, [defaultModel, conversationId, conversation]);

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
    if (conversationId || seededNoteRef.current) return;
    const note = new URLSearchParams(window.location.search).get("note");
    if (!note) return;
    seededNoteRef.current = true;
    setAttachments([createNoteAttachment(noteTitleFromPath(note))]);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [conversationId]);

  useEffect(() => {
    if (!followOutputRef.current) return;
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, tools, waitLabel]);

  function resumeFollow() {
    followOutputRef.current = true;
  }

  function onScrollerScroll() {
    if (!busy) return;
    const el = scrollerRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (gap > 80) followOutputRef.current = false;
  }

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
      excluded,
      onExclude: () => void excludeJournal(),
      pending,
      status: busy ? waitLabel : null,
    });
  }, [activeConversationId, excluded, pending, conversation?.id, busy, waitLabel, setChat]);

  useEffect(() => {
    return () => setChat(null);
  }, [setChat]);

  async function changePolicy(patch: { accessPolicy?: AccessPolicy; model?: string }) {
    if (!activeConversationId) {
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
        accessPolicy: DEFAULT_ACCESS_POLICY,
      }),
    });
    notifyConversationsChanged();
    setConversation(created);
    return created.id;
  }

  async function sendMessage(content: string, targetId = activeConversationId, syncUrl = false) {
    if (!targetId) return;
    const gen = ++streamGen.current;
    resumeFollow();
    setBusy(true);
    setWaitLabel(RUN_STATUS_LABELS.sending);
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
          accessPolicy: conversation?.accessPolicy ?? DEFAULT_ACCESS_POLICY,
          createdAt: new Date().toISOString(),
        },
      ]);
      let assembled = "";
      await streamMessage(targetId, { content }, (raw) => {
        if (gen !== streamGen.current) return;
        const event = raw as AgentEvent;
        if (event.type === "run.status") {
          setWaitLabel(runStatusLabel(event.phase));
        }
        if (event.type === "run.started") {
          setRunId(event.runId);
          setWaitLabel(RUN_STATUS_LABELS.starting);
          upsertAssistantMessage(event.runId, targetId, "", {
            accessPolicy: conversation?.accessPolicy ?? DEFAULT_ACCESS_POLICY,
          });
        }
        if (event.type === "agent.bound") {
          setWaitLabel(RUN_STATUS_LABELS.thinking);
        }
        if (event.type === "assistant.delta") {
          assembled += event.text;
          setWaitLabel(null);
          upsertAssistantMessage(event.runId, targetId, assembled);
        }
        if (event.type === "tool.started") {
          setWaitLabel(toolStatusLabel(event.tool));
          setTools((current) => [
            ...current,
            { id: `${event.runId}-${current.length}`, tool: event.tool, detail: event.detail, status: "started" },
          ]);
        }
        if (event.type === "tool.completed") {
          if (!assembled) setWaitLabel(RUN_STATUS_LABELS.thinking);
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
          setWaitLabel(null);
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
      setWaitLabel(null);
    }
  }

  async function sendContent(raw: string) {
    const content = serializeComposerMessage(attachments, raw);
    if (!content.trim() || busy) return;
    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
    resumeFollow();
    setBusy(true);
    setWaitLabel(RUN_STATUS_LABELS.sending);
    try {
      const activeId = await ensureConversation();
      await sendMessage(content, activeId, !conversationId);
    } catch {
      setBusy(false);
      setWaitLabel(null);
    }
  }

  async function send() {
    await sendContent(input);
  }

  useEffect(() => {
    if (!speech.listening) return;
    setInput(speech.draft);
    requestAnimationFrame(() => resizeTextarea());
  }, [speech.draft, speech.listening]);

  useEffect(() => {
    return () => {
      if (speechRef.current.listening) void speechRef.current.stop();
    };
  }, [conversationId]);

  function startSpeech() {
    if (busy || speech.listening) return;
    speech.start(input);
  }

  async function cancelSpeech() {
    if (!speech.listening) return;
    await speech.stop();
    setInput(speech.baseText);
    requestAnimationFrame(() => resizeTextarea());
  }

  async function editSpeech() {
    if (!speech.listening) return;
    const content = await speech.stop();
    setInput(content);
    requestAnimationFrame(() => {
      resizeTextarea();
      textareaRef.current?.focus();
    });
  }

  async function sendSpeechNow() {
    if (!speech.listening) return;
    const content = await speech.stop();
    await sendContent(content);
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
    if (speech.listening) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function addAttachment(item: ComposerAttachment) {
    setAttachments((prev) => (prev.some((entry) => entry.id === item.id) ? prev : [...prev, item]));
  }

  function previewAttachment(item: ComposerAttachment) {
    if (item.kind === "image") setPeek({ kind: "image", path: item.path, alt: item.label });
    else setPeek({ kind: "note", target: item.title });
  }

  const canSend = Boolean(input.trim() || attachments.length > 0);

  const contextBody = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
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

  const modelPicker = (
    <Select
      aria-label="モデル"
      className="w-[10rem] px-2"
      value={currentModel}
      onChange={(event) => void changePolicy({ model: event.target.value })}
    >
      {optionsFor(currentModel).map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  );

  const composer = (
    <div
      className={cn(
        "mx-auto w-full max-w-[46rem] rounded-2xl border border-stroke bg-surface-elevated p-2 shadow-float",
        "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stroke-strong",
      )}
    >
      <ComposerAttachmentCapsules
        attachments={attachments}
        disabled={busy || speech.listening}
        onPreview={previewAttachment}
        onRemove={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))}
      />
      <div className="flex items-end gap-2">
        <ComposerAttachControls
          disabled={busy || speech.listening}
          onAttach={addAttachment}
          onError={(message) => toast(message, "danger")}
        />
        <Textarea
          ref={textareaRef}
          className="max-h-[14rem] min-h-11 w-auto min-w-0 flex-1 border-0 bg-transparent focus-visible:outline-none"
          value={input}
          rows={1}
          placeholder={speech.listening ? "聞いています…" : "メッセージを書く"}
          readOnly={speech.listening}
          onChange={(event) => {
            if (speech.listening) return;
            setInput(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={onComposerKey}
        />
        {speech.listening ? (
          <>
            <IconButton variant="danger" label="音声入力をキャンセル" onClick={() => void cancelSpeech()}>
              <SpeechCancelIcon />
            </IconButton>
            <IconButton variant="ghost" label="音声入力を止めて編集" onClick={() => void editSpeech()}>
              <SpeechEditIcon />
            </IconButton>
            <IconButton variant="primary" label="音声入力を送信" onClick={() => void sendSpeechNow()}>
              <SpeechSendIcon />
            </IconButton>
          </>
        ) : speech.supported ? (
          <IconButton
            variant="ghost"
            label="音声入力を開始"
            aria-pressed={false}
            onClick={startSpeech}
            disabled={busy}
          >
            <MicIcon />
          </IconButton>
        ) : speech.provider === "azure" ? (
          <IconButton
            variant="ghost"
            label="Azure 音声が未設定です。設定で Web Speech に切り替えられます"
            disabled
          >
            <MicIcon />
          </IconButton>
        ) : null}
        {speech.listening ? null : busy && activeConversationId ? (
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
          <IconButton variant="primary" label="送信" onClick={() => void send()} disabled={busy || !canSend}>
            <SendIcon />
          </IconButton>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute left-3 top-2 z-10 md:left-4">{modelPicker}</div>
        {showWelcome ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 py-6 md:px-4">
            <div className="flex w-full max-w-[46rem] flex-col gap-6">
              <div className="text-center">
                <h2 className="text-title font-semibold text-text-primary md:text-display">何を考えていますか？</h2>
                <p className="mt-2 text-ui text-text-secondary">考えを深めたり、ノートを指したり、画像を添えたりできます。</p>
              </div>
              {composer}
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollerRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-16 md:px-4 md:pb-4"
              onScroll={onScrollerScroll}
            >
              <div className="mx-auto flex max-w-[46rem] flex-col gap-6" aria-live="polite">
                {messages.map((message) => {
                  if (message.role === "assistant" && !message.content) return null;
                  const streaming = Boolean(busy && message.role === "assistant" && message.runId === runId);
                  if (message.role === "user") {
                    return (
                      <UserBubble
                        key={message.runId ?? message.id}
                        content={message.content}
                        knownNotes={knownNotes}
                        onWikiLink={openChatWiki}
                        onImageClick={openChatImage}
                      />
                    );
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
                        onWikiLink={openChatWiki}
                        onImageClick={openChatImage}
                      />
                    </article>
                  );
                })}
                {showWait ? (
                  <article className="border-l-2 border-accent pl-4">
                    <p className="text-ui text-text-secondary">
                      {waitLabel}
                      <span className="stream-caret" />
                    </p>
                  </article>
                ) : null}
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
                      setContextOpen(true);
                    }}
                  >
                    {diffSummary}
                  </button>
                ) : null}
                <div ref={bottom} />
              </div>
            </div>
            <div className="shrink-0 px-3 pb-3 pt-1 md:px-4">{composer}</div>
          </>
        )}
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

      <VaultPeekDialog
        peek={peek}
        onOpenChange={(next) => {
          if (!next) setPeek(null);
        }}
        knownNotes={knownNotes}
        onWikiLink={openChatWiki}
        onImageClick={openChatImage}
      />
    </div>
  );
}
