"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ChatChrome = {
  conversationId: string | null;
  excluded: boolean;
  onExclude: () => void;
  pending: string | null;
  status: string | null;
};

type ChromeContextValue = {
  title: string;
  setTitle: (title: string) => void;
  chat: ChatChrome | null;
  setChat: (chat: ChatChrome | null) => void;
};

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Nousarium");
  const [chat, setChat] = useState<ChatChrome | null>(null);
  const value = useMemo(() => ({ title, setTitle, chat, setChat }), [title, chat]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeContextValue {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error("useChrome must be used within ChromeProvider");
  return ctx;
}
