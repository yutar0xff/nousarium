"use client";

import {
  BarButton,
  ChangesIcon,
  ChatIcon,
  ChevronLeftIcon,
  cn,
  IconButton,
  NotesIcon,
  SettingsIcon,
  Sheet,
} from "@nousarium/ui";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useChrome } from "./chrome-context";
import { ConversationList } from "./conversation-sidebar";
import { NotesProvider } from "./notes-context";
import { TagFolderNav } from "./tag-folder-nav";
import { useNewConversationShortcut } from "../lib/use-new-conversation-shortcut";
import { sidebarActionLabel, useSidebar } from "../lib/use-sidebar";
import { useEffectivePathname } from "../lib/pathname";
import { applyThemePreference, readThemePreference, type ThemePreference } from "../lib/theme";
import {
  applySpeechProvider,
  readSpeechProvider,
  type SpeechProvider,
} from "../lib/speech/provider";

const NAV = [
  { href: "/", label: "対話", icon: ChatIcon, match: (path: string) => path === "/" || path.startsWith("/c/") },
  { href: "/files", label: "ノート", icon: NotesIcon, match: (path: string) => path.startsWith("/files") },
  { href: "/changes", label: "変更", icon: ChangesIcon, match: (path: string) => path.startsWith("/changes") },
] as const;

function NavLinks({
  orientation,
  onNavigate,
}: {
  orientation: "row" | "col";
  onNavigate?: () => void;
}) {
  const pathname = useEffectivePathname();
  return (
    <nav
      aria-label="主ナビゲーション"
      className={cn(
        orientation === "row"
          ? "flex min-h-14 items-stretch border-t border-stroke bg-surface-elevated pb-[env(safe-area-inset-bottom)] md:hidden"
          : "flex flex-col gap-1 border-t border-stroke p-2",
      )}
    >
      {NAV.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg text-ui",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
              orientation === "row" ? "min-h-14 flex-1 flex-col gap-0.5" : "min-h-11 justify-start px-3",
              active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-surface hover:text-text-primary",
            )}
          >
            <Icon className={cn("size-6", active ? "text-accent" : "text-text-muted")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-start gap-2 rounded-lg px-3 text-ui",
        "text-text-secondary hover:bg-surface hover:text-text-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
      )}
    >
      <SettingsIcon className="size-6 text-text-muted" />
      設定
    </button>
  );
}

function SettingsPanel() {
  const { chat } = useChrome();
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>("azure");

  useEffect(() => {
    setTheme(readThemePreference());
    setSpeechProvider(readSpeechProvider());
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="mb-2 text-ui font-medium text-text-secondary">テーマ</h2>
        <div role="radiogroup" aria-label="テーマ" className="flex flex-col">
          {(
            [
              ["system", "システム"],
              ["light", "ライト"],
              ["dark", "ダーク"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                applyThemePreference(value);
              }}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-left text-ui",
                theme === value ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-ui font-medium text-text-secondary">音声入力</h2>
        <div role="radiogroup" aria-label="音声入力" className="flex flex-col">
          {(
            [
              ["azure", "Azure Speech（推奨）"],
              ["web", "Web Speech（ブラウザ内蔵）"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={speechProvider === value}
              onClick={() => {
                setSpeechProvider(value);
                applySpeechProvider(value);
              }}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-left text-ui",
                speechProvider === value ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-3 text-caption text-text-muted">
          Azure はサーバー設定のキーを使います。Web Speech は Chrome 向けで、Brave では使えません。
        </p>
      </section>
      {chat?.conversationId ? (
        <section>
          <h2 className="mb-2 text-ui font-medium text-text-secondary">この対話</h2>
          <button
            type="button"
            disabled={chat.excluded}
            onClick={chat.onExclude}
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-ui text-text-primary hover:bg-accent-soft disabled:opacity-50"
          >
            {chat.excluded ? "除外済み" : "この対話を隠す"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function AppMark() {
  return <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />;
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useEffectivePathname();
  if (pathname.startsWith("/files")) {
    return (
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <TagFolderNav onNavigate={onNavigate} />
      </Suspense>
    );
  }
  return <ConversationList onNavigate={onNavigate} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { title, chat } = useChrome();
  const pathname = useEffectivePathname();
  const onFiles = pathname.startsWith("/files");
  const { open, desktop, sheetOpen, setSheetOpen, setDesktopOpen, onMenuClick } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  useNewConversationShortcut();

  useEffect(() => {
    document.title = title === "Nousarium" ? "Nousarium" : `${title} · Nousarium`;
  }, [title]);

  function openSettings() {
    setSheetOpen(false);
    setSettingsOpen(true);
  }

  return (
    <NotesProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-surface text-text-primary md:flex-row">
        <aside
          className={cn(
            "w-[260px] shrink-0 flex-col border-r border-stroke bg-surface-elevated",
            open ? "hidden md:flex" : "hidden",
          )}
        >
          <div className="flex h-12 items-center px-2">
            <BarButton
              label={sidebarActionLabel(onFiles, "close")}
              start={<AppMark />}
              end={<ChevronLeftIcon />}
              onClick={() => setDesktopOpen(false)}
            >
              Nousarium
            </BarButton>
          </div>
          <SidebarBody />
          <NavLinks orientation="col" />
          <div className="border-t border-stroke p-2">
            <SettingsButton onClick={openSettings} />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {desktop && open ? null : (
            <div className="flex h-12 shrink-0 items-center px-2">
              <IconButton label={sidebarActionLabel(onFiles, "open")} onClick={onMenuClick}>
                <AppMark />
              </IconButton>
            </div>
          )}
          {chat?.status ? (
            <p className="border-b border-accent-soft bg-accent-soft px-4 py-1 text-center text-caption text-accent">
              {chat.status}
            </p>
          ) : chat?.pending ? (
            <p className="border-b border-warning-soft bg-warning-soft px-4 py-1 text-center text-caption text-warning">
              {chat.pending}
            </p>
          ) : null}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
          <NavLinks orientation="row" />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Nousarium" start={<AppMark />}>
          <div className="flex h-full min-h-0 flex-col">
            <SidebarBody onNavigate={() => setSheetOpen(false)} />
            <NavLinks orientation="col" onNavigate={() => setSheetOpen(false)} />
            <div className="border-t border-stroke p-2">
              <SettingsButton onClick={openSettings} />
            </div>
          </div>
        </Sheet>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} side="right" title="設定">
          <SettingsPanel />
        </Sheet>
      </div>
    </NotesProvider>
  );
}
