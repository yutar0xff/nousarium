"use client";

import type { SearchHit } from "@nousarium/contracts";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  cn,
  FolderIcon,
  NotesIcon,
  Skeleton,
  TextInput,
} from "@nousarium/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import {
  buildTagTree,
  filesHref,
  filterTagTree,
  noteHref,
  type NoteListItem,
  type TagFolder,
} from "../lib/tag-tree";
import { useNotes } from "./notes-context";

const UNTAGGED_KEY = "__untagged__";

export function TagFolderNav({ onNavigate }: { onNavigate?: () => void }) {
  const { items, loading } = useNotes();
  const params = useSearchParams();
  const selectedTag = params.get("tag");
  const untaggedSelected = params.get("untagged") === "1";
  const selectedPath = params.get("path");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => buildTagTree(items), [items]);
  const visible = useMemo(() => filterTagTree(tree.folders, tree.untagged, query), [tree, query]);
  const searching = query.trim().length > 0;

  async function search(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setHits([]);
      return;
    }
    try {
      const found = await api<SearchHit[]>(`/vault/search?q=${encodeURIComponent(value)}`);
      setHits(found.filter((hit) => hit.path.startsWith("Notes/")));
    } catch {
      setHits([]);
    }
  }

  function isExpanded(path: string, depth: number) {
    if (searching) return true;
    if (Object.hasOwn(expandedOverride, path)) return expandedOverride[path] === true;
    return depth === 0;
  }

  function toggle(path: string, depth: number) {
    setExpandedOverride((current) => ({
      ...current,
      [path]: !(Object.hasOwn(current, path) ? current[path] === true : depth === 0),
    }));
  }

  const noteByPath = useMemo(() => new Map(items.map((item) => [item.path, item])), [items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-stroke p-3">
        <TextInput
          value={query}
          placeholder="ノートを検索"
          onChange={(event) => void search(event.target.value)}
        />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2" aria-label="タグフォルダ">
        {loading && items.length === 0 ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : (
          <>
            <NavRow
              href={filesHref({})}
              label="すべて"
              count={items.length}
              active={!selectedTag && !untaggedSelected}
              icon={<NotesIcon className="size-4 shrink-0" />}
              onNavigate={onNavigate}
            />
            {visible.folders.map((folder) => (
              <FolderBranch
                key={folder.path}
                folder={folder}
                depth={0}
                selectedTag={selectedTag}
                selectedPath={selectedPath}
                isExpanded={isExpanded}
                onToggle={toggle}
                onNavigate={onNavigate}
              />
            ))}
            {visible.untagged.length > 0 || untaggedSelected ? (
              <FolderGroup
                id={UNTAGGED_KEY}
                label="未分類"
                href={filesHref({ untagged: true })}
                notes={visible.untagged}
                count={tree.untagged.length}
                depth={0}
                active={untaggedSelected}
                selectedPath={selectedPath}
                expanded={isExpanded(UNTAGGED_KEY, 0)}
                onToggle={() => toggle(UNTAGGED_KEY, 0)}
                onNavigate={onNavigate}
              />
            ) : null}
            {hits.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1 border-t border-stroke pt-3">
                <p className="px-3 text-caption text-text-muted">本文ヒット</p>
                {hits.map((hit) => {
                  const note = noteByPath.get(hit.path);
                  const href = note ? noteHref(note) : filesHref({ path: hit.path });
                  return (
                    <Link
                      key={`${hit.path}:${hit.line}`}
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-caption text-text-secondary",
                        "hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
                      )}
                    >
                      <span className="block truncate">{hit.path.replace(/^Notes\//, "")}</span>
                      <span className="block truncate">
                        {hit.line}: {hit.preview}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </nav>
    </div>
  );
}

function FolderBranch({
  folder,
  depth,
  selectedTag,
  selectedPath,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  folder: TagFolder;
  depth: number;
  selectedTag: string | null;
  selectedPath: string | null;
  isExpanded: (path: string, depth: number) => boolean;
  onToggle: (path: string, depth: number) => void;
  onNavigate?: () => void;
}) {
  const expanded = isExpanded(folder.path, depth);
  const hasChildren = folder.children.length > 0 || folder.notes.length > 0;

  return (
    <div>
      <NavRow
        href={filesHref({ tag: folder.path })}
        label={folder.segment}
        count={folder.count}
        active={selectedTag === folder.path}
        depth={depth}
        expandable={hasChildren}
        expanded={expanded}
        onToggle={() => onToggle(folder.path, depth)}
        icon={<FolderIcon className="size-4 shrink-0" />}
        onNavigate={onNavigate}
      />
      {expanded ? (
        <>
          {folder.children.map((child) => (
            <FolderBranch
              key={child.path}
              folder={child}
              depth={depth + 1}
              selectedTag={selectedTag}
              selectedPath={selectedPath}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
          {folder.notes.map((note) => (
            <NoteRow
              key={`${folder.path}:${note.path}`}
              item={note}
              href={noteHref(note, folder.path)}
              depth={depth + 1}
              active={selectedPath === note.path}
              onNavigate={onNavigate}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function FolderGroup({
  id,
  label,
  href,
  notes,
  count,
  depth,
  active,
  selectedPath,
  expanded,
  onToggle,
  onNavigate,
}: {
  id: string;
  label: string;
  href: string;
  notes: NoteListItem[];
  count: number;
  depth: number;
  active: boolean;
  selectedPath: string | null;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <NavRow
        href={href}
        label={label}
        count={count}
        active={active}
        depth={depth}
        expandable={notes.length > 0}
        expanded={expanded}
        onToggle={onToggle}
        icon={<FolderIcon className="size-4 shrink-0" />}
        onNavigate={onNavigate}
      />
      {expanded
        ? notes.map((note) => (
            <NoteRow
              key={`${id}:${note.path}`}
              item={note}
              href={noteHref(note)}
              depth={depth + 1}
              active={selectedPath === note.path}
              onNavigate={onNavigate}
            />
          ))
        : null}
    </div>
  );
}

function NavRow({
  href,
  label,
  count,
  active,
  depth = 0,
  expandable,
  expanded,
  onToggle,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  icon: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? "閉じる" : "開く"}
          aria-expanded={expanded}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted",
            "hover:bg-surface hover:text-text-primary",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
          )}
          onClick={onToggle}
        >
          {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
        </button>
      ) : (
        <span className="inline-flex size-8 shrink-0" aria-hidden="true" />
      )}
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-2 text-ui",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
          active ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface",
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className={cn("text-caption", active ? "text-accent" : "text-text-muted")}>{count}</span>
      </Link>
    </div>
  );
}

function NoteRow({
  item,
  href,
  depth,
  active,
  onNavigate,
}: {
  item: NoteListItem;
  href: string;
  depth: number;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
      <span className="inline-flex size-8 shrink-0" aria-hidden="true" />
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-2 text-ui",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-strong",
          active ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-surface",
        )}
      >
        <NotesIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
      </Link>
    </div>
  );
}
