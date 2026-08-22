"use client";

import type { FileDiff, Run } from "@nousarium/contracts";
import { Button } from "@nousarium/ui";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { DiffView } from "../../../components/diff-view";

const STATUS_LABELS: Record<Run["status"], string> = {
  queued: "待機中",
  running: "実行中",
  finished: "完了",
  error: "エラー",
  cancelled: "中断",
};

export default function ChangesPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<{ run: Run; diffs: FileDiff[] } | null>(null);

  useEffect(() => {
    void api<Run[]>("/runs").then(setRuns);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-2">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            className="rounded-sm border border-stroke bg-surface-elevated px-3 py-2 text-left text-sm"
            onClick={async () => setSelected(await api(`/runs/${run.id}`))}
          >
            <div>{STATUS_LABELS[run.status]}</div>
            <div className="text-xs text-text-secondary">{new Date(run.startedAt).toLocaleString("ja-JP")}</div>
          </button>
        ))}
      </aside>
      <section>
        {selected ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Run {selected.run.id.slice(0, 8)}</h1>
            <p className="text-sm text-text-secondary">
              {STATUS_LABELS[selected.run.status]} · {ACCESS_POLICY_LABEL(selected.run.accessPolicy)}
            </p>
            <Button
              variant="danger"
              onClick={async () => {
                await api(`/runs/${selected.run.id}/revert`, { method: "POST" });
                const next = await api<Run[]>("/runs");
                setRuns(next);
                setSelected(null);
              }}
            >
              この Run の変更を取り消す
            </Button>
            <DiffView diffs={selected.diffs} />
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Run を選ぶと差分と復元ができます。</p>
        )}
      </section>
    </div>
  );
}

function ACCESS_POLICY_LABEL(policy: Run["accessPolicy"]) {
  if (policy === "chat") return "会話";
  if (policy === "read") return "参照";
  return "Vault作業";
}
