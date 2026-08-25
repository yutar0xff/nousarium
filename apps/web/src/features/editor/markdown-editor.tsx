"use client";

import type { EditorProps } from "./types";
import { CodeMirrorMarkdownEditor } from "./adapters/codemirror/codemirror-editor";
import { MarkdownPreview } from "./preview";
import { useState, type ReactNode } from "react";
import { cn, IconButton, SinglePaneIcon, SplitPaneIcon } from "@nousarium/ui";
import { useEditorLayout } from "../../lib/use-editor-layout";

export function MarkdownEditor({
  knownNotes,
  toolbar,
  onWikiLink,
  ...props
}: EditorProps & {
  knownNotes?: string[];
  toolbar?: ReactNode;
  onWikiLink?: (target: string) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const { layout, setEditorLayout } = useEditorLayout();
  const split = layout === "split";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stroke">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-stroke p-1">
        {split ? (
          <p className="px-3 text-ui text-text-secondary">原文とプレビュー</p>
        ) : (
          <div className="flex gap-1 text-ui" role="tablist" aria-label="表示">
            <EditorTab selected={tab === "edit"} onClick={() => setTab("edit")}>
              編集
            </EditorTab>
            <EditorTab selected={tab === "preview"} onClick={() => setTab("preview")}>
              プレビュー
            </EditorTab>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {toolbar}
          <IconButton
            label={split ? "1ペインにする" : "2ペインにする"}
            aria-pressed={split}
            onClick={() => setEditorLayout(split ? "tab" : "split")}
          >
            {split ? <SinglePaneIcon /> : <SplitPaneIcon />}
          </IconButton>
        </div>
      </div>
      <div className={cn("flex min-h-0 flex-1 overflow-hidden", split ? "flex-row" : "flex-col")}>
        <section
          aria-label="編集"
          className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden", !split && tab !== "edit" && "hidden")}
        >
          <div className="absolute inset-0 min-h-0 overflow-hidden">
            <CodeMirrorMarkdownEditor {...props} />
          </div>
        </section>
        <section
          aria-label="プレビュー"
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-auto",
            split && "border-l border-stroke",
            !split && tab !== "preview" && "hidden",
          )}
        >
          <div className="p-4">
            <MarkdownPreview value={props.value} knownNotes={knownNotes} onWikiLink={onWikiLink} />
          </div>
        </section>
      </div>
    </div>
  );
}

function EditorTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={cn(
        "min-h-11 rounded-lg px-3",
        selected ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
