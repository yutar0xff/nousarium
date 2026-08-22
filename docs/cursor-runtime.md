# Cursor Runtime

Nousarium の AI 実行は `@cursor/sdk` の Local Runtime 経由です。ファイル I/O は Vault 上で行い、推論は Cursor 側で処理されます。

## 配置

| 項目 | 場所 |
| --- | --- |
| SDK Adapter | `packages/agent-cursor` |
| Agent セッション | `runtime/cursor-agents`（`JsonlLocalAgentStore`） |
| 作業ディレクトリ | `NOUSARIUM_VAULT_PATH` |

`CURSOR_API_KEY` が無い場合、Scripted Adapter が UI と Git フローの開発用フォールバックとして使われます。

## 会話と Run

- 会話ごとに `Agent.create` または `Agent.resume(agentId)` を使う
- `tools` は resume 時に再指定する（SDK の制約）
- モードは `send(..., { mode: "plan" | "agent" })` で指定する
- イベントは `run.stream()` から取得し、SSE へ中継する
- 中断は `run.cancel()`（`run.supports("cancel")` を確認）

AccessPolicy は `packages/core` の `toolsForPolicy` で Cursor のツール名へ変換します。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `CURSOR_API_KEY` | Cursor User API Key（`crsr_...`） |
| `CURSOR_MODEL` | モデル ID（既定 `composer-2.5`） |

## 要件

- Node.js 22.13 以上
- `@cursor/sdk` 1.x（ワークスペースの lockfile に従う）
