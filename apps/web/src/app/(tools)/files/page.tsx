"use client";

import type { NoteRelations, VaultDocument } from "@nousarium/contracts";
import { parseFrontmatter } from "@nousarium/markdown";
import { BackIcon, Button, ConfirmDialog, EmptyState, IconButton, Pill, useToast } from "@nousarium/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MarkdownEditor } from "../../../features/editor/markdown-editor";
import { api } from "../../../lib/api";
import { filesHref, notesInSelection, titleFrom } from "../../../lib/tag-tree";
import { ConflictPanel, parseVaultConflict } from "../../../components/conflict-panel";
import { useChrome } from "../../../components/chrome-context";
import { notifyNotesChanged, useNotes } from "../../../components/notes-context";

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  return String(value);
}

function folderLabel(tag: string | null, untagged: boolean) {
  if (untagged) return "未分類";
  if (!tag) return "すべて";
  return tag.replaceAll("/", " / ");
}

function FilesWorkspace() {
  const { setTitle } = useChrome();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { items, knownNotes } = useNotes();
  const tag = params.get("tag");
  const untagged = params.get("untagged") === "1";
  const notePath = params.get("path");
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{ local: VaultDocument; disk: VaultDocument } | null>(null);
  const [relations, setRelations] = useState<NoteRelations | null>(null);
  const [metaOpen, setMetaOpen] = useState<"properties" | "relations" | null>(null);
  const [confirm, setConfirm] = useState<"save" | "reload" | null>(null);

  const visible = useMemo(() => notesInSelection(items, { tag, untagged }), [items, tag, untagged]);

  useEffect(() => {
    if (!notePath) {
      setTitle(folderLabel(tag, untagged));
      return () => setTitle("Nousarium");
    }
    const listed = items.find((item) => item.path === notePath);
    setTitle(listed?.title ?? "ノート");
    return () => setTitle("Nousarium");
  }, [notePath, tag, untagged, items, setTitle]);

  useEffect(() => {
    if (!notePath) {
      setDoc(null);
      setConflict(null);
      setError("");
      setRelations(null);
      setMetaOpen(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [file, linked] = await Promise.all([
          api<VaultDocument>(`/vault/file?path=${encodeURIComponent(notePath)}`),
          api<NoteRelations>(`/notes/relations?path=${encodeURIComponent(notePath)}`).catch(() => null),
        ]);
        if (cancelled) return;
        setDoc(file);
        setConflict(null);
        setError("");
        setRelations(linked);
        setMetaOpen(null);
        const { data, body } = parseFrontmatter(file.content);
        setTitle(titleFrom(file.path, body, data.aliases));
      } catch (err) {
        if (cancelled) return;
        setDoc(null);
        setError(err instanceof Error ? err.message : "ノートを開けませんでした");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notePath, setTitle]);

  async function saveDocument(target: VaultDocument, overwrite = false) {
    setError("");
    try {
      const savedDoc = await api<VaultDocument>("/vault/file", {
        method: "PUT",
        body: JSON.stringify({
          path: target.path,
          content: target.content,
          expectedHash: overwrite ? null : target.hash,
          overwrite,
        }),
      });
      setDoc(savedDoc);
      setConflict(null);
      toast("保存しました");
      notifyNotesChanged();
    } catch (err) {
      const payload = parseVaultConflict(err);
      if (payload && doc) {
        const disk = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(payload.path)}`);
        setConflict({ local: doc, disk });
        return;
      }
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  }

  async function reloadDocument() {
    if (!notePath) return;
    setError("");
    try {
      const file = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(notePath)}`);
      setDoc(file);
      setConflict(null);
      const { data, body } = parseFrontmatter(file.content);
      setTitle(titleFrom(file.path, body, data.aliases));
      toast("読み直しました");
      notifyNotesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み直せませんでした");
    }
  }

  function closeNote() {
    router.push(filesHref({ tag, untagged }));
  }

  const properties = doc ? parseFrontmatter(doc.content).data : {};
  const propertyRows = Object.entries(properties);

  if (!notePath) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-2 p-3 md:gap-3 md:p-4">
        <FolderHeading tag={tag} untagged={untagged} />
        {visible.length === 0 ? (
          <EmptyState title="ノートがありません" description="このフォルダに入るタグのノートはまだありません。" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {visible.map((item) => (
              <div key={item.path} className="rounded-lg px-3 py-2 hover:bg-surface">
                <Link
                  href={filesHref({ tag, untagged, path: item.path })}
                  className="block truncate text-left text-ui font-medium text-text-primary"
                >
                  {item.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {item.tags.map((itemTag) => (
                    <Link key={itemTag} href={filesHref({ tag: itemTag })}>
                      <Pill className="min-h-6 px-2">{itemTag}</Pill>
                    </Link>
                  ))}
                  {item.updatedAt ? (
                    <span className="text-caption text-text-muted">
                      {new Date(item.updatedAt).toLocaleDateString("ja-JP")}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-3 md:gap-3 md:p-4">
      {doc ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-1 sm:gap-2">
            <IconButton label="一覧に戻る" onClick={closeNote}>
              <BackIcon />
            </IconButton>
            <h2 className="min-w-0 flex-1 truncate text-heading font-medium">{doc.path}</h2>
            <HeaderPopover
              label="Properties"
              open={metaOpen === "properties"}
              onOpenChange={(open) => setMetaOpen(open ? "properties" : null)}
            >
              {propertyRows.length > 0 ? (
                <table className="w-full text-caption">
                  <tbody>
                    {propertyRows.map(([key, value]) => (
                      <tr key={key} className="border-t border-stroke first:border-t-0">
                        <th className="py-1 pr-3 text-left font-medium text-text-secondary">{key}</th>
                        <td className="py-1 text-text-primary">{formatValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-caption text-text-muted">Properties はありません。</p>
              )}
            </HeaderPopover>
            <HeaderPopover
              label="関連する対話"
              open={metaOpen === "relations"}
              onOpenChange={(open) => setMetaOpen(open ? "relations" : null)}
            >
              <RelatedConversations relations={relations} />
            </HeaderPopover>
            <Link
              href={`/?note=${encodeURIComponent(notePath)}`}
              className="inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-ui font-medium text-accent hover:bg-accent-soft"
            >
              このノートについて話す
            </Link>
          </div>
          {error ? <p className="text-ui text-danger">{error}</p> : null}
          {conflict ? (
            <ConflictPanel
              path={conflict.local.path}
              localContent={conflict.local.content}
              disk={conflict.disk}
              onKeepLocal={() => void saveDocument(conflict.local, true)}
              onUseDisk={() => {
                setDoc(conflict.disk);
                setConflict(null);
              }}
              onDismiss={() => setConflict(null)}
            />
          ) : null}
          <MarkdownEditor
            value={doc.content}
            knownNotes={knownNotes}
            onChange={(content) => {
              setDoc({ ...doc, content });
            }}
            toolbar={
              <>
                <Button variant="ghost" className="px-3" onClick={() => setConfirm("reload")}>
                  再読込
                </Button>
                <Button className="px-3" onClick={() => setConfirm("save")}>
                  保存
                </Button>
              </>
            }
          />
          <ConfirmDialog
            open={confirm !== null}
            onOpenChange={(open) => {
              if (!open) setConfirm(null);
            }}
            title={confirm === "reload" ? "ディスクから読み直しますか？" : "このノートを保存しますか？"}
            description={
              confirm === "reload"
                ? "編集中の内容は捨てて、Vault の最新を開きます。"
                : "Vault のファイルを更新します。"
            }
            confirmLabel={confirm === "reload" ? "読み直す" : "保存する"}
            confirmVariant={confirm === "reload" ? "danger" : "primary"}
            onConfirm={() => {
              if (confirm === "reload") void reloadDocument();
              else void saveDocument(doc);
            }}
          />
        </>
      ) : error ? (
        <p className="text-ui text-danger">{error}</p>
      ) : (
        <p className="text-ui text-text-secondary">読み込み中…</p>
      )}
    </section>
  );
}

function HeaderPopover({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (root.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={root} className="relative shrink-0">
      <Button
        variant="ghost"
        className="px-3"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
      >
        {label}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-40 mt-1 max-h-[min(24rem,70dvh)] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-stroke bg-surface-elevated p-3 shadow-float"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function RelatedConversations({ relations }: { relations: NoteRelations | null }) {
  if (relations && (relations.edited.length > 0 || relations.referenced.length > 0)) {
    return (
      <div className="space-y-3">
        <RelationGroup label="更新した対話" items={relations.edited} />
        <RelationGroup label="参照した対話" items={relations.referenced} />
      </div>
    );
  }
  return <p className="text-caption text-text-muted">まだ関連する対話はありません。</p>;
}

function RelationGroup({
  label,
  items,
}: {
  label: string;
  items: NoteRelations["edited"];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-caption text-text-muted">{label}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.journalPath}>
            {item.conversationId ? (
              <Link href={`/c/${item.conversationId}`} className="text-ui text-accent hover:underline">
                {item.title}
              </Link>
            ) : (
              <span className="text-ui text-text-secondary">{item.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FolderHeading({ tag, untagged }: { tag: string | null; untagged: boolean }) {
  if (untagged) {
    return <h2 className="text-heading font-medium">未分類</h2>;
  }
  if (!tag) {
    return <h2 className="text-heading font-medium">すべて</h2>;
  }
  const parts = tag.split("/");
  return (
    <h2 className="flex flex-wrap items-center gap-1 text-heading font-medium">
      {parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join("/");
        return (
          <span key={path} className="flex items-center gap-1">
            {index > 0 ? <span className="text-text-muted">/</span> : null}
            <Link href={filesHref({ tag: path })} className="hover:text-accent">
              {part}
            </Link>
          </span>
        );
      })}
    </h2>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ui text-text-secondary">読み込み中…</p>}>
      <FilesWorkspace />
    </Suspense>
  );
}
