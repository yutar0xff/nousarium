"use client";

import type { VaultDocument } from "@nousarium/contracts";
import { Button } from "@nousarium/ui";

export function ConflictPanel({
  path,
  localContent,
  disk,
  onKeepLocal,
  onUseDisk,
  onDismiss,
}: {
  path: string;
  localContent: string;
  disk: VaultDocument;
  onKeepLocal: () => void;
  onUseDisk: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="rounded-sm border border-danger bg-surface-elevated p-3">
      <h2 className="mb-2 text-sm font-semibold text-danger">編集が競合しています</h2>
      <p className="mb-3 text-xs text-text-secondary">
        {path} は別の編集で更新されています。どちらを使うか選んでください。
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-medium">編集中の内容</h3>
          <pre className="max-h-48 overflow-auto rounded-sm bg-surface p-2 text-xs whitespace-pre-wrap">{localContent}</pre>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-medium">ディスク上の内容</h3>
          <pre className="max-h-48 overflow-auto rounded-sm bg-surface p-2 text-xs whitespace-pre-wrap">{disk.content}</pre>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger" onClick={onKeepLocal}>
          編集中の内容で上書き
        </Button>
        <Button variant="secondary" onClick={onUseDisk}>
          ディスク版を読み込む
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          閉じる
        </Button>
      </div>
    </section>
  );
}

export type VaultConflictPayload = {
  error: "conflict";
  path: string;
  currentHash: string;
};

export function parseVaultConflict(error: unknown): VaultConflictPayload | null {
  if (!(error instanceof Error)) return null;
  try {
    const parsed = JSON.parse(error.message) as VaultConflictPayload;
    if (parsed.error === "conflict" && parsed.path && parsed.currentHash) return parsed;
  } catch {
    return null;
  }
  return null;
}
