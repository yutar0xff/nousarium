export const RUN_STATUS_LABELS = {
  sending: "送信しています",
  titling: "会話名を決めています",
  checkpoint: "記録を取っています",
  starting: "エージェントを準備しています",
  thinking: "考えています",
} as const;

export type RunStatusPhase = keyof typeof RUN_STATUS_LABELS;

export function runStatusLabel(phase: string): string {
  return RUN_STATUS_LABELS[phase as RunStatusPhase] ?? RUN_STATUS_LABELS.thinking;
}

export function toolStatusLabel(tool: string): string {
  const name = tool.toLowerCase();
  if (name.includes("websearch") || name.includes("web_search") || name.includes("web-search")) {
    return "Web を検索しています";
  }
  if (name.includes("grep") || name.includes("search") || name.includes("glob")) return "ノートを探しています";
  if (name.includes("read") || name.includes("ls") || name.includes("semsearch")) return "ノートを読んでいます";
  if (name.includes("write") || name.includes("edit") || name.includes("apply")) return "ノートを更新しています";
  if (name.includes("shell") || name.includes("bash")) return "コマンドを実行しています";
  return "作業しています";
}
