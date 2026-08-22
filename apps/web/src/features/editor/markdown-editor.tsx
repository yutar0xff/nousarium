"use client";

import type { EditorProps } from "./types";
import { CodeMirrorMarkdownEditor } from "./adapters/codemirror/codemirror-editor";
import { MarkdownPreview } from "./preview";
import { useState } from "react";

export function MarkdownEditor(props: EditorProps) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  return (
    <div className="overflow-hidden rounded-sm border border-stroke">
      <div className="flex gap-2 border-b border-stroke px-2 py-1 text-xs">
        <button type="button" className={tab === "edit" ? "text-accent" : "text-text-secondary"} onClick={() => setTab("edit")}>
          編集
        </button>
        <button type="button" className={tab === "preview" ? "text-accent" : "text-text-secondary"} onClick={() => setTab("preview")}>
          プレビュー
        </button>
      </div>
      {tab === "edit" ? <CodeMirrorMarkdownEditor {...props} /> : <MarkdownPreview value={props.value} />}
    </div>
  );
}
