"use client";

import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { ChromeProvider } from "./chrome-context";
import { ChatWorkspace } from "./chat-workspace";
import { useEffectivePathname } from "../lib/pathname";

function conversationIdFromPath(pathname: string): string | undefined {
  if (!pathname.startsWith("/c/")) return undefined;
  const id = pathname.slice(3).split("/")[0];
  return id || undefined;
}

export function ChatRouteLayout({ children }: { children: ReactNode }) {
  const pathname = useEffectivePathname();
  const conversationId = conversationIdFromPath(pathname);

  return (
    <ChromeProvider>
      <AppShell>
        <ChatWorkspace conversationId={conversationId} />
        {children}
      </AppShell>
    </ChromeProvider>
  );
}
