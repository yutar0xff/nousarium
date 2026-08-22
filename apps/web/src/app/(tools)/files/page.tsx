"use client";

import type { VaultDocument } from "@nousarium/contracts";
import { parseFrontmatter } from "@nousarium/markdown";
import { BackIcon, Button, EmptyState, IconButton, Pill, useToast } from "@nousarium/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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
  const [propertiesOpen, setPropertiesOpen] = useState(false);

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
      setPropertiesOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const file = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(notePath)}`);
        if (cancelled) return;
        setDoc(file);
        setConflict(null);
        setError("");
        setPropertiesOpen(false);
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
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 p-3 md:gap-3 md:p-4">
      {doc ? (
        <>
          <div className="flex items-center gap-2">
            <IconButton label="一覧に戻る" onClick={closeNote}>
              <BackIcon />
            </IconButton>
            <h2 className="truncate text-heading font-medium">{doc.path}</h2>
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
          <details
            className="rounded-xl border border-stroke bg-surface-elevated"
            open={propertiesOpen}
            onToggle={(event) => setPropertiesOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-3 py-2 text-ui font-medium">Properties</summary>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-caption">
                <tbody>
                  {propertyRows.map(([key, value]) => (
                    <tr key={key} className="border-t border-stroke">
                      <th className="py-1 pr-3 text-left font-medium text-text-secondary">{key}</th>
                      <td className="py-1 text-text-primary">{formatValue(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <MarkdownEditor
            value={doc.content}
            knownNotes={knownNotes}
            onChange={(content) => {
              setDoc({ ...doc, content });
            }}
          />
          <Button onClick={() => void saveDocument(doc)}>保存</Button>
        </>
      ) : error ? (
        <p className="text-ui text-danger">{error}</p>
      ) : (
        <p className="text-ui text-text-secondary">読み込み中…</p>
      )}
    </section>
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
