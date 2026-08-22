"use client";

import type { SearchHit, VaultDocument, VaultEntry } from "@nousarium/contracts";
import { Button, Field } from "@nousarium/ui";
import { useEffect, useState } from "react";
import { MarkdownEditor } from "../../features/editor/markdown-editor";
import { api } from "../../lib/api";

export default function FilesPage() {
  const [prefix, setPrefix] = useState("");
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [doc, setDoc] = useState<VaultDocument | null>(null);
  const [error, setError] = useState("");

  async function load(path = prefix) {
    setEntries(await api<VaultEntry[]>(`/vault/tree?path=${encodeURIComponent(path)}`));
  }

  useEffect(() => {
    void load("");
  }, []);

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
            onClick={async () => setDoc(await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(hit.path)}`))}
          >
            {hit.path}:{hit.line} {hit.preview}
          </button>
        ))}
      </aside>
      <section>
        {doc ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">{doc.path}</h1>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <MarkdownEditor value={doc.content} onChange={(content) => setDoc({ ...doc, content })} />
            <Button
              onClick={async () => {
                setError("");
                try {
                  const saved = await api<VaultDocument>("/vault/file", {
                    method: "PUT",
                    body: JSON.stringify({ path: doc.path, content: doc.content, expectedHash: doc.hash }),
                  });
                  setDoc(saved);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "保存に失敗しました");
                }
              }}
            >
              保存
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">ノートを選ぶと編集できます。</p>
        )}
      </section>
    </div>
  );
}
