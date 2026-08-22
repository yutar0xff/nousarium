"use client";

import type { EditorProps } from "./types";
import { CodeMirrorMarkdownEditor } from "./adapters/codemirror/codemirror-editor";
import { MarkdownPreview } from "./preview";
import { useState } from "react";
import { cn } from "@nousarium/ui";

export function MarkdownEditor({ knownNotes, ...props }: EditorProps & { knownNotes?: string[] }) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stroke">
      <div className="flex gap-1 border-b border-stroke p-1 text-ui lg:hidden" role="tablist" aria-label="表示">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "edit"}
          className={cn(
            "min-h-11 rounded-lg px-3",
            tab === "edit" ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface",
          )}
          onClick={() => setTab("edit")}
        >
          編集
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "preview"}
          className={cn(
            "min-h-11 rounded-lg px-3",
            tab === "preview" ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface",
          )}
          onClick={() => setTab("preview")}
        >
          プレビュー
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section
          aria-label="編集"
          className={cn("h-full min-h-0 min-w-0 overflow-hidden", tab !== "edit" && "max-lg:hidden")}
        >
          <CodeMirrorMarkdownEditor {...props} />
        </section>
        <section
          aria-label="プレビュー"
          className={cn(
            "h-full min-h-0 min-w-0 overflow-auto lg:border-l lg:border-stroke",
            tab !== "preview" && "max-lg:hidden",
          )}
        >
          <div className="p-4">
            <MarkdownPreview value={props.value} knownNotes={knownNotes} />
          </div>
        </section>
      </div>
    </div>
  );
}
