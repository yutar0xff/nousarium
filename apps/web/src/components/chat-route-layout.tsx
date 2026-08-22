"use client";

import type { ReactNode } from "react";
import { ChatShell } from "./chat-shell";
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
    <ChatShell>
      <ChatWorkspace conversationId={conversationId} />
      {children}
    </ChatShell>
  );
}
