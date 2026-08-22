"use client";

import {
  BarButton,
  ChangesIcon,
  ChatIcon,
  ChevronLeftIcon,
  cn,
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
} from "@nousarium/ui";
import { MODEL_OPTIONS } from "@nousarium/core";
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
  useNewConversationShortcut();

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
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="grid h-12 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b border-stroke px-2">
            <div className="flex items-center">
              {desktop && open ? null : (
                <IconButton label={sidebarActionLabel(onFiles, "open")} onClick={onMenuClick}>
                  <AppMark />
                </IconButton>
              )}
            </div>
            <h1 className="truncate text-center text-heading font-medium">{title}</h1>
            <div className="flex items-center justify-end">
              <OverflowMenu />
            </div>
          </header>
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
          <SidebarBody onNavigate={() => setSheetOpen(false)} />
        </Sheet>
      </div>
    </NotesProvider>
  );
}
