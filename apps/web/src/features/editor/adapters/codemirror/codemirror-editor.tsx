"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorProps } from "../../types";

const fillParent = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { overflow: "auto" },
});

export function CodeMirrorMarkdownEditor({ value, onChange, readOnly }: EditorProps) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      minHeight="0"
      maxHeight="100%"
      editable={!readOnly}
      extensions={[markdown(), fillParent]}
      onChange={onChange}
      basicSetup={{ lineNumbers: false }}
      className="block h-full min-h-0"
    />
  );
}
