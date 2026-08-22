"use client";

import { renderMarkdownToHtml } from "@nousarium/markdown";

export function MarkdownPreview({ value }: { value: string }) {
  return (
    <div
      className="prose max-w-none p-3 text-sm"
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(value) }}
    />
  );
}
