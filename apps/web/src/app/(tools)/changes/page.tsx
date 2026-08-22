"use client";

import type { FileDiff, Run } from "@nousarium/contracts";
import { ACCESS_POLICY_LABELS } from "@nousarium/core";
import { BackIcon, Button, EmptyState, IconButton, Pill, useToast } from "@nousarium/ui";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { DiffView, summarizeDiffs } from "../../../components/diff-view";
import { useChrome } from "../../../components/chrome-context";

const STATUS_LABELS: Record<Run["status"], string> = {
  queued: "待機中",
  running: "実行中",
  finished: "完了",
  error: "エラー",
  cancelled: "中断",
};

const STATUS_TONE: Record<Run["status"], "neutral" | "accent" | "success" | "danger" | "warning"> = {
  queued: "neutral",
  running: "accent",
  finished: "success",
  error: "danger",
  cancelled: "warning",
};

export default function ChangesPage() {
  const { setTitle } = useChrome();
  const { toast } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<{ run: Run; diffs: FileDiff[] } | null>(null);

  useEffect(() => {
    setTitle("変更");
    return () => setTitle("Nousarium");
  }, [setTitle]);

  useEffect(() => {
    void api<Run[]>("/runs").then(setRuns);
  }, []);

  async function openRun(run: Run) {
    setSelected(await api(`/runs/${run.id}`));
  }

  const listPane = (
    <aside className="flex min-h-0 w-full flex-col gap-2 overflow-y-auto md:w-[320px] md:shrink-0 md:border-r md:border-stroke md:pr-4">
      {runs.length === 0 ? (
        <EmptyState title="まだ変更がありません" description="Vault を更新する対話が Run として並びます。" />
      ) : (
        runs.map((run) => {
          const active = selected?.run.id === run.id;
          return (
            <button
              key={run.id}
              type="button"
              className={`rounded-xl border px-3 py-2 text-left ${active ? "border-accent bg-accent-soft" : "border-stroke bg-surface-elevated hover:bg-surface"}`}
              onClick={() => void openRun(run)}
            >
              <div className="flex items-center gap-2">
                <Pill tone={STATUS_TONE[run.status]}>{STATUS_LABELS[run.status]}</Pill>
              </div>
              <div className="mt-1 text-caption text-text-muted">{new Date(run.startedAt).toLocaleString("ja-JP")}</div>
            </button>
          );
        })
      )}
    </aside>
  );

  const detailPane = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {selected ? (
        <>
          <div className="flex items-center gap-2 md:hidden">
            <IconButton label="一覧に戻る" onClick={() => setSelected(null)}>
              <BackIcon />
            </IconButton>
            <h2 className="text-heading font-medium">Run {selected.run.id.slice(0, 8)}</h2>
          </div>
          <h2 className="hidden text-heading font-medium md:block">Run {selected.run.id.slice(0, 8)}</h2>
          <p className="text-ui text-text-secondary">
            {STATUS_LABELS[selected.run.status]} · {ACCESS_POLICY_LABELS[selected.run.accessPolicy]} · {summarizeDiffs(selected.diffs)}
          </p>
          <Button
            variant="danger"
            onClick={async () => {
              await api(`/runs/${selected.run.id}/revert`, { method: "POST" });
              toast("この Run の変更を取り消しました");
              const next = await api<Run[]>("/runs");
              setRuns(next);
              setSelected(null);
            }}
          >
            この変更を取り消す
          </Button>
          <DiffView diffs={selected.diffs} />
        </>
      ) : (
        <p className="hidden text-ui text-text-secondary md:block">Run を選ぶと差分と復元ができます。</p>
      )}
    </section>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-3 md:flex-row md:gap-4 md:p-4">
      <div className={selected ? "hidden md:flex md:flex-col" : "flex min-h-0 flex-1 md:flex-none"}>{listPane}</div>
      <div className={selected ? "flex min-h-0 flex-1" : "hidden md:flex"}>{detailPane}</div>
    </div>
  );
}
