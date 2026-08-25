"use client";

import { renderMarkdownToHtml } from "@nousarium/markdown";
import { cn } from "@nousarium/ui";
import { useEffect, useMemo, useRef } from "react";
import { fetchVaultRaw } from "../../lib/api";

function rewriteVaultImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (all, before, src, after) => {
    if (/^(https?:|data:|blob:|\/api\/)/i.test(src)) return all;
    const path = decodeURIComponent(src.replace(/^\.\//, "").replace(/^\/+/, ""));
    if (!path || path.includes("://")) return all;
    return `<img${before}src="" data-vault-path="${escapeAttr(path)}"${after}>`;
  });
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function vaultImageFromEvent(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest("img[data-vault-path]");
}

export function MarkdownPreview({
  value,
  knownNotes = [],
  streaming = false,
  onWikiLink,
  onImageClick,
}: {
  value: string;
  knownNotes?: string[];
  streaming?: boolean;
  onWikiLink?: (target: string) => void;
  onImageClick?: (path: string, alt?: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    let rendered = renderMarkdownToHtml(value);
    if (knownNotes.length > 0) {
      const names = new Set(knownNotes);
      rendered = rendered.replace(/class="wikilink" data-target="([^"]+)"/g, (all, target: string) => {
        if (target.includes("/") || names.has(target)) return all;
        return all.replace('class="wikilink"', 'class="wikilink is-missing"');
      });
    }
    return rewriteVaultImages(rendered);
  }, [value, knownNotes]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const images = [...root.querySelectorAll<HTMLImageElement>("img[data-vault-path]")];
    const objectUrls: string[] = [];
    let cancelled = false;

    void (async () => {
      for (const img of images) {
        const path = img.getAttribute("data-vault-path");
        if (!path) continue;
        try {
          const blob = await fetchVaultRaw(path);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          img.src = url;
          if (onImageClick) {
            img.classList.add("is-peekable");
            img.setAttribute("role", "button");
            img.tabIndex = 0;
          }
        } catch {
          img.alt = img.alt || "画像を読み込めませんでした";
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [html, onImageClick]);

  function emitImageClick(image: HTMLImageElement) {
    if (!onImageClick) return;
    const path = image.getAttribute("data-vault-path");
    if (path) onImageClick(path, image.getAttribute("alt") || undefined);
  }

  return (
    <div
      ref={rootRef}
      className={cn("markdown-body max-w-none")}
      onClick={(event) => {
        const image = vaultImageFromEvent(event.target);
        if (image && onImageClick) {
          event.preventDefault();
          emitImageClick(image);
          return;
        }
        if (!onWikiLink) return;
        const link = event.target instanceof Element ? event.target.closest("a.wikilink") : null;
        if (!link) return;
        event.preventDefault();
        const name = link.getAttribute("data-target");
        if (name) onWikiLink(name);
      }}
      onKeyDown={(event) => {
        if (!onImageClick) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        const image = vaultImageFromEvent(event.target);
        if (!image) return;
        event.preventDefault();
        emitImageClick(image);
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {streaming ? <span className="stream-caret" /> : null}
    </div>
  );
}
