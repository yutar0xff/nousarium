import type { ReactNode } from "react";
import Link from "next/link";

export function ToolsShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stroke bg-surface px-4 py-3">
        <Link href="/" className="text-base font-semibold">
          Nousarium
        </Link>
        <nav className="flex gap-3 text-sm text-text-secondary">
          <Link href="/">対話</Link>
          <Link href="/files">ノート</Link>
          <Link href="/changes">変更</Link>
        </nav>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
