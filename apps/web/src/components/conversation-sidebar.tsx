"use client";

import type { Conversation } from "@nousarium/contracts";
import { cn } from "@nousarium/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { requestNewConversation } from "../lib/new-conversation";
import { useEffectivePathname } from "../lib/pathname";

export function notifyConversationsChanged() {
  window.dispatchEvent(new Event("nousarium:conversations-changed"));
}

export function useConversations() {
  const pathname = useEffectivePathname();
  const [items, setItems] = useState<Conversation[]>([]);

  const refresh = useCallback(async () => {
    try {
      setItems(await api<Conversation[]>("/conversations"));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    function onRefresh() {
      void refresh();
    }
    window.addEventListener("nousarium:conversations-changed", onRefresh);
    return () => window.removeEventListener("nousarium:conversations-changed", onRefresh);
  }, [refresh]);

  return { items, pathname };
}

export function ConversationList({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { items, pathname } = useConversations();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-stroke p-3">
        <Link
          href="/"
          title="Ctrl+Shift+O"
          aria-keyshortcuts="Control+Shift+O"
          onClick={() => {
            requestNewConversation();
            onNavigate?.();
          }}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-lg border border-stroke bg-surface px-3 text-ui font-medium",
            "hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
          )}
        >
          新しい対話
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="会話">
        {items.map((item) => {
          const active = pathname === `/c/${item.id}`;
          return (
            <Link
              key={item.id}
              href={`/c/${item.id}`}
              onClick={onNavigate}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-ui",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
                active ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface",
              )}
            >
              <span className="block truncate font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
