import type { ReactNode } from "react";
import Link from "next/link";
import { ConversationSidebar, MobileConversationNav } from "./conversation-sidebar";

export function ChatShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stroke px-4 py-3">
        <Link href="/" className="text-base font-semibold">
          Nousarium
        </Link>
        <nav className="flex gap-3 text-sm text-text-secondary">
          <Link href="/files">ノート</Link>
          <Link href="/changes">変更</Link>
        </nav>
      </header>
      <MobileConversationNav />
      <div className="flex min-h-0 flex-1">
        <ConversationSidebar />
        <main className="relative min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
