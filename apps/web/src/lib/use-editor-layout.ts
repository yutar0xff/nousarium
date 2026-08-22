import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./browser-storage";

export type EditorLayout = "split" | "tab";

const LAYOUT_KEY = "nousarium-files-editor-layout";
const DESKTOP_QUERY = "(min-width: 64rem)";

function asLayout(value: string | null): EditorLayout | null {
  return value === "split" || value === "tab" ? value : null;
}

export function useEditorLayout() {
  const [layout, setLayout] = useState<EditorLayout>("tab");

  useEffect(() => {
    const stored = asLayout(readStorage(LAYOUT_KEY));
    if (stored) {
      setLayout(stored);
      return;
    }
    setLayout(window.matchMedia(DESKTOP_QUERY).matches ? "split" : "tab");
  }, []);

  function setEditorLayout(next: EditorLayout) {
    setLayout(next);
    writeStorage(LAYOUT_KEY, next);
  }

  return { layout, setEditorLayout };
}
