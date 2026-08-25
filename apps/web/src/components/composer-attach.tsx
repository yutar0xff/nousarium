"use client";

import type { VaultEntry } from "@nousarium/contracts";
import { noteTitleFromPath } from "@nousarium/markdown";
import {
  CloseIcon,
  cn,
  IconButton,
  ImageIcon,
  Menu,
  MenuItem,
  NotesIcon,
  PlusIcon,
  TextInput,
} from "@nousarium/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, uploadVaultAsset } from "../lib/api";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type ComposerAttachment =
  | { id: string; kind: "image"; path: string; label: string }
  | { id: string; kind: "note"; title: string };

export function createImageAttachment(path: string, label: string): Extract<ComposerAttachment, { kind: "image" }> {
  return { id: `image-${path}`, kind: "image", path, label };
}

export function createNoteAttachment(title: string): Extract<ComposerAttachment, { kind: "note" }> {
  return { id: `note-${title}`, kind: "note", title };
}

export function serializeComposerMessage(attachments: ComposerAttachment[], text: string): string {
  const parts: string[] = [];
  for (const item of attachments) {
    if (item.kind === "image") parts.push(`![${item.label}](${item.path})`);
    else parts.push(`[[${item.title}]]`);
  }
  const body = text.trim();
  if (body) parts.push(body);
  return parts.join("\n\n");
}

export function ComposerAttachmentCapsules({
  attachments,
  disabled,
  onPreview,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  disabled?: boolean;
  onPreview: (item: ComposerAttachment) => void;
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5 px-1" aria-label="添付">
      {attachments.map((item) => {
        const label = item.kind === "image" ? item.label : item.title;
        return (
          <li key={item.id}>
            <span className="inline-flex max-w-[14rem] items-center gap-0.5 rounded-lg bg-accent-soft text-accent">
              <button
                type="button"
                className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-caption hover:bg-accent/10"
                disabled={disabled}
                onClick={() => onPreview(item)}
              >
                {item.kind === "image" ? (
                  <ImageIcon className="size-3.5 shrink-0" />
                ) : (
                  <NotesIcon className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{label}</span>
              </button>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-accent hover:bg-accent/10 disabled:opacity-50"
                aria-label={`${label}を削除`}
                disabled={disabled}
                onClick={() => onRemove(item.id)}
              >
                <CloseIcon className="size-3.5" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ComposerAttachControls({
  disabled,
  onAttach,
  onError,
}: {
  disabled?: boolean;
  onAttach: (item: ComposerAttachment) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  async function onPickImage(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    if (!IMAGE_MIME.has(file.type)) {
      onError("JPEG / PNG / WebP / GIF のみアップロードできます");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadVaultAsset({
        filename: file.name,
        mimeType: file.type as ImageMime,
        file,
      });
      const label = file.name.replace(/\.[^.]+$/, "") || "image";
      onAttach(createImageAttachment(uploaded.path, label));
    } catch (error) {
      onError(error instanceof Error ? error.message : "画像のアップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="relative shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => void onPickImage(event.target.files)}
      />
      <Menu
        trigger={
          <IconButton variant="ghost" label="添付メニュー" disabled={disabled || uploading} aria-expanded={noteOpen}>
            <PlusIcon />
          </IconButton>
        }
      >
        <MenuItem
          disabled={disabled || uploading}
          onSelect={() => {
            window.setTimeout(() => fileRef.current?.click(), 0);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <ImageIcon className="size-4" />
            {uploading ? "アップロード中…" : "画像を追加"}
          </span>
        </MenuItem>
        <MenuItem
          disabled={disabled || uploading}
          onSelect={() => {
            window.setTimeout(() => setNoteOpen(true), 0);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <NotesIcon className="size-4" />
            ノートをメンション
          </span>
        </MenuItem>
      </Menu>
      {noteOpen ? (
        <NoteMentionPicker
          onClose={() => setNoteOpen(false)}
          onPick={(title) => {
            onAttach(createNoteAttachment(title));
            setNoteOpen(false);
          }}
          onError={(message) => onErrorRef.current(message)}
        />
      ) : null}
    </div>
  );
}

function NoteMentionPicker({
  onPick,
  onClose,
  onError,
}: {
  onPick: (title: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Array<{ path: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await api<VaultEntry[]>("/vault/tree?path=Notes");
        if (cancelled) return;
        setNotes(
          entries
            .filter((entry) => entry.kind === "file" && entry.name.endsWith(".md"))
            .map((entry) => ({
              path: entry.path,
              title: noteTitleFromPath(entry.path),
            }))
            .sort((a, b) => a.title.localeCompare(b.title, "ja")),
        );
      } catch (error) {
        if (!cancelled) {
          onErrorRef.current(error instanceof Error ? error.message : "ノート一覧を取得できませんでした");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (root.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes.slice(0, 40);
    return notes.filter((note) => note.title.toLowerCase().includes(needle)).slice(0, 40);
  }, [notes, query]);

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="ノートをメンション"
      className="absolute bottom-[calc(100%+0.5rem)] left-0 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-stroke bg-surface-elevated p-2 shadow-float"
    >
      <TextInput
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ノート名で検索"
        aria-label="ノート名で検索"
      />
      <div className="mt-2 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="px-2 py-3 text-caption text-text-muted">読み込み中…</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-caption text-text-muted">該当するノートがありません</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((note) => (
              <li key={note.path}>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-ui text-text-primary",
                    "hover:bg-accent-soft",
                  )}
                  onClick={() => onPick(note.title)}
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
