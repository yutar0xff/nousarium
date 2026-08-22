"use client";

import type { Conversation } from "@nousarium/contracts";
import { CONVERSATION_INTENT_LABELS } from "@nousarium/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useEffectivePathname } from "../lib/pathname";

export function ConversationSidebar() {
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

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-stroke bg-surface-elevated md:flex">
      <div className="border-b border-stroke p-3">
        <Link
          href="/"
          className="flex min-h-10 items-center justify-center rounded-sm border border-stroke bg-surface px-3 text-sm font-medium hover:bg-accent-soft"
        >
          新しい対話
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active = pathname === `/c/${item.id}`;
          return (
            <Link
              key={item.id}
              href={`/c/${item.id}`}
              className={`rounded-sm px-3 py-2 text-left text-sm ${active ? "bg-accent-soft text-accent" : "hover:bg-surface"}`}
            >
              <div className="truncate font-medium">{item.title}</div>
              <div className="truncate text-xs text-text-secondary">{CONVERSATION_INTENT_LABELS[item.intent]}</div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

export function MobileConversationNav() {
  const pathname = useEffectivePathname();
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    void api<Conversation[]>("/conversations")
      .then(setItems)
      .catch(() => setItems([]));
  }, [pathname]);

  useEffect(() => {
    function onRefresh() {
      void api<Conversation[]>("/conversations")
        .then(setItems)
        .catch(() => setItems([]));
    }
    window.addEventListener("nousarium:conversations-changed", onRefresh);
    return () => window.removeEventListener("nousarium:conversations-changed", onRefresh);
  }, []);

  const current = pathname.startsWith("/c/") ? pathname.slice(3) : "";

  return (
    <div className="border-b border-stroke p-2 md:hidden">
      <select
        className="w-full"
        value={current}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value ? `/c/${value}` : "/");
        }}
      >
        <option value="">新しい対話</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title} ({CONVERSATION_INTENT_LABELS[item.intent]})
          </option>
        ))}
      </select>
    </div>
  );
}

export function notifyConversationsChanged() {
  window.dispatchEvent(new Event("nousarium:conversations-changed"));
}
