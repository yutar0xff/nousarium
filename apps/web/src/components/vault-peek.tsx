"use client";

import type { VaultDocument } from "@nousarium/contracts";
import { noteTitleFromPath, parseFrontmatter, resolveWikiTarget } from "@nousarium/markdown";
import { Button, PeekDialog } from "@nousarium/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MarkdownPreview } from "../features/editor/preview";
import { api, fetchVaultRaw } from "../lib/api";
import { filesHref } from "../lib/tag-tree";

export type VaultPeek =
  | { kind: "note"; target: string }
  | { kind: "image"; path: string; alt?: string };

function peekTitle(peek: VaultPeek): string {
  if (peek.kind === "note") return noteTitleFromPath(resolveWikiTarget(peek.target));
  return peek.alt || peek.path.split("/").pop() || "画像";
}

export function VaultPeekDialog({
  peek,
  onOpenChange,
  knownNotes = [],
  onWikiLink,
  onImageClick,
}: {
  peek: VaultPeek | null;
  onOpenChange: (open: boolean) => void;
  knownNotes?: string[];
  onWikiLink?: (target: string) => void;
  onImageClick?: (path: string, alt?: string) => void;
}) {
  return (
    <PeekDialog open={peek !== null} onOpenChange={onOpenChange} title={peek ? peekTitle(peek) : "プレビュー"}>
      {peek?.kind === "note" ? (
        <NotePeekBody
          target={peek.target}
          knownNotes={knownNotes}
          onWikiLink={onWikiLink}
          onImageClick={onImageClick}
        />
      ) : null}
      {peek?.kind === "image" ? <ImagePeekBody path={peek.path} alt={peek.alt} /> : null}
    </PeekDialog>
  );
}

function NotePeekBody({
  target,
  knownNotes,
  onWikiLink,
  onImageClick,
}: {
  target: string;
  knownNotes: string[];
  onWikiLink?: (target: string) => void;
  onImageClick?: (path: string, alt?: string) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const path = resolveWikiTarget(target);
  const noteName = noteTitleFromPath(path);
  const missing = !target.includes("/") && !knownNotes.includes(noteName);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBody(null);
    void (async () => {
      try {
        const doc = await api<VaultDocument>(`/vault/file?path=${encodeURIComponent(path)}`);
        if (cancelled) return;
        const parsed = parseFrontmatter(doc.content);
        setBody(parsed.body.trim() || doc.content);
      } catch {
        if (!cancelled) setError(missing ? "ノートがまだありません。" : "ノートを読み込めませんでした。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, missing]);

  if (loading) return <p className="text-ui text-text-secondary">読み込み中…</p>;
  if (error) return <p className="text-ui text-text-secondary">{error}</p>;
  if (!body) return null;

  return (
    <div className="flex flex-col gap-4">
      <MarkdownPreview value={body} knownNotes={knownNotes} onWikiLink={onWikiLink} onImageClick={onImageClick} />
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={() => router.push(filesHref({ path }))}>
          ノートを開く
        </Button>
      </div>
    </div>
  );
}

function ImagePeekBody({ path, alt }: { path: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = alt || path.split("/").pop() || "画像";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    void (async () => {
      try {
        const blob = await fetchVaultRaw(path);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError("画像を読み込めませんでした。");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (error) return <p className="text-ui text-text-secondary">{error}</p>;
  if (!url) return <p className="text-ui text-text-secondary">読み込み中…</p>;
  return <img src={url} alt={label} className="mx-auto max-h-[min(70dvh,32rem)] w-auto max-w-full object-contain" />;
}
