"use client";

import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorProps } from "../../types";

export function CodeMirrorMarkdownEditor({ value, onChange, readOnly }: EditorProps) {
  return (
    <CodeMirror
      value={value}
      height="320px"
      editable={!readOnly}
      extensions={[markdown()]}
      onChange={onChange}
      basicSetup={{ lineNumbers: false }}
    />
  );
}
