"use client";

import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./browser-storage";

const SIDEBAR_KEY = "nousarium-sidebar";
const DESKTOP_QUERY = "(min-width: 768px)";

function readOpen(): boolean {
  const value = readStorage(SIDEBAR_KEY);
  if (value === "closed") return false;
  if (value === "open") return true;
  return true;
}

export function sidebarActionLabel(onFiles: boolean, action: "open" | "close") {
  const panel = onFiles ? "フォルダ" : "会話リスト";
  return `${panel}を${action === "close" ? "閉じる" : "開く"}`;
}

export function useSidebar() {
  const [open, setOpen] = useState(true);
  const [desktop, setDesktop] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setOpen(readOpen());
  }, []);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function setDesktopOpen(next: boolean) {
    setOpen(next);
    writeStorage(SIDEBAR_KEY, next ? "open" : "closed");
  }

  function onMenuClick() {
    if (desktop) {
      setDesktopOpen(!open);
      return;
    }
    setSheetOpen(true);
  }

  return { open, desktop, sheetOpen, setSheetOpen, setDesktopOpen, onMenuClick };
}
