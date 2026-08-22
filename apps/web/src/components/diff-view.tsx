"use client";

import type { FileDiff } from "@nousarium/contracts";

function DiffLine({ line }: { line: string }) {
  const className = line.startsWith("+")
    ? "text-success"
    : line.startsWith("-")
      ? "text-danger"
      : "text-text-secondary";
  return <div className={`font-mono text-xs ${className}`}>{line || " "}</div>;
}

export function DiffView({ diffs }: { diffs: FileDiff[] }) {
  if (diffs.length === 0) return null;

  const added = diffs.filter((d) => d.status === "added").length;
  const modified = diffs.filter((d) => d.status === "modified").length;
  const deleted = diffs.filter((d) => d.status === "deleted").length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-secondary">
        {diffs.length} ファイル（追加 {added} / 変更 {modified} / 削除 {deleted}）
      </p>
      {diffs.map((diff) => (
        <details key={diff.path} className="rounded-sm border border-stroke bg-surface-elevated p-2">
          <summary className="cursor-pointer text-sm font-medium">
            {diff.path} <span className="text-text-secondary">({diff.status})</span>
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-sm bg-surface p-2">
            {diff.patch.split("\n").map((line, index) => (
              <DiffLine key={`${diff.path}-${index}`} line={line} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
