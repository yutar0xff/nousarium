"use client";

import { renderMarkdownToHtml } from "@nousarium/markdown";
import { useMemo } from "react";
import { cn } from "@nousarium/ui";

export function MarkdownPreview({
  value,
  knownNotes = [],
  streaming = false,
  onWikiLink,
}: {
  value: string;
  knownNotes?: string[];
  streaming?: boolean;
  onWikiLink?: (target: string) => void;
}) {
  const html = useMemo(() => {
    let rendered = renderMarkdownToHtml(value);
    if (knownNotes.length > 0) {
      const names = new Set(knownNotes);
      rendered = rendered.replace(/class="wikilink" data-target="([^"]+)"/g, (all, target: string) => {
        if (target.includes("/") || names.has(target)) return all;
        return all.replace('class="wikilink"', 'class="wikilink is-missing"');
      });
    }
    return rendered;
  }, [value, knownNotes]);

  return (
    <div
      className={cn("markdown-body max-w-none")}
      onClick={(event) => {
        if (!onWikiLink) return;
        const target = (event.target as HTMLElement).closest("a.wikilink");
        if (!target) return;
        event.preventDefault();
        const name = target.getAttribute("data-target");
        if (name) onWikiLink(name);
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {streaming ? <span className="stream-caret" /> : null}
    </div>
  );
}
