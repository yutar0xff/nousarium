"use client";

import {
  ChangesIcon,
  ChatIcon,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MoreIcon,
  NotesIcon,
  Sheet,
  ChevronLeftIcon,
  cn,
} from "@nousarium/ui";
import { MODEL_OPTIONS } from "@nousarium/core";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useChrome } from "./chrome-context";
import { ConversationList } from "./conversation-sidebar";
import { NotesProvider } from "./notes-context";
import { TagFolderNav } from "./tag-folder-nav";
import { useNewConversationShortcut } from "../lib/use-new-conversation-shortcut";
import { useEffectivePathname } from "../lib/pathname";
import { applyThemePreference, readThemePreference, type ThemePreference } from "../lib/theme";

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

function OverflowMenu() {
  const { chat } = useChrome();
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    setTheme(readThemePreference());
  }, []);

  return (
    <Menu
      trigger={
        <IconButton label="メニュー">
          <MoreIcon />
        </IconButton>
      }
    >
      {chat ? (
        <>
          <MenuLabel>モデル</MenuLabel>
          <MenuRadioGroup value={chat.model} onValueChange={chat.onModelChange}>
            {MODEL_OPTIONS.map((option) => (
              <MenuRadioItem key={option.id} value={option.id}>
                {option.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
        </>
      ) : null}
      <MenuLabel>テーマ</MenuLabel>
      <MenuRadioGroup
        value={theme}
        onValueChange={(value) => {
          const next = value as ThemePreference;
          setTheme(next);
          applyThemePreference(next);
        }}
      >
        <MenuRadioItem value="system">システム</MenuRadioItem>
        <MenuRadioItem value="light">ライト</MenuRadioItem>
        <MenuRadioItem value="dark">ダーク</MenuRadioItem>
      </MenuRadioGroup>
      {chat?.conversationId ? (
        <>
          <MenuSeparator />
          <MenuItem disabled={chat.excluded} onSelect={chat.onExclude}>
            {chat.excluded ? "除外済み" : "この対話を隠す"}
          </MenuItem>
        </>
      ) : null}
    </Menu>
  );
}

const SIDEBAR_KEY = "nousarium-sidebar";

function readSidebarOpen(): boolean {
  try {
    const value = localStorage.getItem(SIDEBAR_KEY);
    if (value === "closed") return false;
    if (value === "open") return true;
  } catch {
    // ignore
  }
  return true;
}

function writeSidebarOpen(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
  } catch {
    // ignore
  }
}

function HitSlot({ children }: { children: ReactNode }) {
  return <span className="inline-flex size-11 shrink-0 items-center justify-center">{children}</span>;
}

function AppMark() {
  return <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />;
}

function AppMarkSlot() {
  return (
    <HitSlot>
      <AppMark />
    </HitSlot>
  );
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
  useNewConversationShortcut();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setSidebarOpen(readSidebarOpen());
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function setDesktopSidebar(open: boolean) {
    setSidebarOpen(open);
    writeSidebarOpen(open);
  }

  function onMenuClick() {
    if (desktop) {
      setDesktopSidebar(!sidebarOpen);
      return;
    }
    setSheetOpen(true);
  }

  const menuLabel = desktop
    ? onFiles
      ? sidebarOpen
        ? "フォルダを閉じる"
        : "フォルダを開く"
      : sidebarOpen
        ? "会話リストを閉じる"
        : "会話リストを開く"
    : onFiles
      ? "フォルダを開く"
      : "会話リストを開く";

  return (
    <NotesProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-surface text-text-primary md:flex-row">
        <aside
          className={cn(
            "w-[260px] shrink-0 flex-col border-r border-stroke bg-surface-elevated",
            sidebarOpen ? "hidden md:flex" : "hidden",
          )}
        >
          <div className="flex h-12 items-center px-2">
            <IconButton
              label={onFiles ? "フォルダを閉じる" : "会話リストを閉じる"}
              className="w-auto min-w-0 flex-1 justify-start"
              onClick={() => setDesktopSidebar(false)}
            >
              <AppMarkSlot />
              <span className="min-w-0 flex-1 truncate text-left text-heading font-semibold">Nousarium</span>
              <HitSlot>
                <ChevronLeftIcon />
              </HitSlot>
            </IconButton>
          </div>
          <SidebarBody />
          <NavLinks orientation="col" />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="grid h-12 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b border-stroke px-2">
            <div className="flex items-center">
              {desktop && sidebarOpen ? null : (
                <IconButton label={menuLabel} onClick={onMenuClick}>
                  <AppMark />
                </IconButton>
              )}
            </div>
            <h1 className="truncate text-center text-heading font-medium">{title}</h1>
            <div className="flex items-center justify-end">
              <OverflowMenu />
            </div>
          </header>
          {chat?.pending ? (
            <p className="border-b border-warning-soft bg-warning-soft px-4 py-1 text-center text-caption text-warning">
              {chat.pending}
            </p>
          ) : null}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
          <NavLinks orientation="row" />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Nousarium" start={<AppMarkSlot />}>
          <SidebarBody onNavigate={() => setSheetOpen(false)} />
        </Sheet>
      </div>
    </NotesProvider>
  );
}
