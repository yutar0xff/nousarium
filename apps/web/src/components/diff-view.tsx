"use client";

import type { FileDiff } from "@nousarium/contracts";
import { cn } from "@nousarium/ui";

function DiffLine({ line }: { line: string }) {
  const added = line.startsWith("+") && !line.startsWith("+++");
  const removed = line.startsWith("-") && !line.startsWith("---");
  return (
    <div
      className={cn(
        "px-2 font-mono text-mono",
        added && "bg-success-soft text-success",
        removed && "bg-danger-soft text-danger",
        !added && !removed && "text-text-secondary",
      )}
    >
      {line || " "}
    </div>
  );
}

function lineCounts(patch: string) {
  let added = 0;
  let removed = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  return { added, removed };
}

export function summarizeDiffs(diffs: FileDiff[]) {
  if (diffs.length === 0) return "ノートの変更はありません";
  const files = diffs.length;
  const totals = diffs.reduce(
    (acc, diff) => {
      const counts = lineCounts(diff.patch);
      acc.added += counts.added;
      acc.removed += counts.removed;
      return acc;
    },
    { added: 0, removed: 0 },
  );
  return `${files} ファイルを更新（+${totals.added} / −${totals.removed}）`;
}

export function DiffView({ diffs }: { diffs: FileDiff[] }) {
  if (diffs.length === 0) return null;

  const added = diffs.filter((d) => d.status === "added").length;
  const modified = diffs.filter((d) => d.status === "modified").length;
  const deleted = diffs.filter((d) => d.status === "deleted").length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-muted">
        {diffs.length} ファイル（追加 {added} / 変更 {modified} / 削除 {deleted}）
      </p>
      {diffs.map((diff) => {
        const counts = lineCounts(diff.patch);
        return (
          <details key={diff.path} className="rounded-xl border border-stroke bg-surface-elevated p-2">
            <summary className="cursor-pointer text-ui font-medium">
              {diff.path}{" "}
              <span className="text-text-muted">
                +{counts.added} / −{counts.removed}
              </span>
            </summary>
            <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-surface-sunken py-2">
              {diff.patch.split("\n").map((line, index) => (
                <DiffLine key={`${diff.path}-${index}`} line={line} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
