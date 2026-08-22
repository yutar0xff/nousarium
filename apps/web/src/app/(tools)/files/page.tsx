"use client";

import type { SearchHit, VaultDocument, VaultEntry } from "@nousarium/contracts";
import { Button, Field } from "@nousarium/ui";
import { useEffect, useState } from "react";
import { MarkdownEditor } from "../../../features/editor/markdown-editor";
import { api } from "../../../lib/api";
import { ConflictPanel, parseVaultConflict } from "../../../components/conflict-panel";

export default function FilesPage() {
  const [prefix, setPrefix] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<{ local: VaultDocument; disk: VaultDocument } | null>(null);

  async function load(path = prefix) {
    setEntries(await api<VaultEntry[]>(`/vault/tree?path=${encodeURIComponent(path)}`));
  }

  useEffect(() => {
    void load("");
  }, []);

  async function saveDocument(target: VaultDocument, overwrite = false) {
    setError("");
    setSaved(false);
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
      setSaved(true);
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

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-3">
        <Field label="検索">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === "Enter" && query) {
                setHits(await api<SearchHit[]>(`/vault/search?q=${encodeURIComponent(query)}`));
              }
            }}
          />
        </Field>
        <Button variant="secondary" onClick={() => void load("")}>
          ルート
        </Button>
        <div className="flex flex-col gap-1">
          {entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              className="rounded-sm px-2 py-2 text-left text-sm hover:bg-accent-soft"
              onClick={async () => {
                if (entry.kind === "directory") {
                  setPrefix(entry.path);
                  await load(entry.path);
                } else {
                  setDoc(await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(entry.path)}`));
                  setConflict(null);
                  setSaved(false);
                }
              }}
            >
              {entry.kind === "directory" ? `${entry.name}/` : entry.name}
            </button>
          ))}
        </div>
        {hits.map((hit) => (
          <button
            key={`${hit.path}:${hit.line}`}
            type="button"
            className="text-left text-xs text-text-secondary"
            onClick={async () => {
              setDoc(await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(hit.path)}`));
              setConflict(null);
              setSaved(false);
            }}
          >
            {hit.path}:{hit.line} {hit.preview}
          </button>
        ))}
      </aside>
      <section className="flex flex-col gap-3">
        {doc ? (
          <>
            <h1 className="text-lg font-semibold">{doc.path}</h1>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {saved ? <p className="text-sm text-success">保存しました</p> : null}
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
              onChange={(content) => {
                setDoc({ ...doc, content });
                setSaved(false);
              }}
            />
            <Button onClick={() => void saveDocument(doc)}>保存</Button>
          </>
        ) : (
          <p className="text-sm text-text-secondary">ノートを選ぶと編集できます。</p>
        )}
      </section>
    </div>
  );
}
