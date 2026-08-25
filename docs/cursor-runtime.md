# Cursor Runtime

Nousarium の AI 実行は `@cursor/sdk` の Local Runtime 経由です。ファイル I/O は Vault 上で行い、推論は Cursor 側で処理されます。

## 配置

| 項目 | 場所 |
| --- | --- |
| SDK Adapter | `packages/agent-cursor` |
| Agent セッション | `runtime/cursor-agents`（`JsonlLocalAgentStore`） |
| 作業ディレクトリ | `NOUSARIUM_VAULT_PATH` |

`CURSOR_API_KEY` が無い場合、Scripted Adapter が UI と Git フローの開発用フォールバックとして使われます。

## 指示の入り方

Vault を `cwd` に渡すと、SDK のワークスペース走査が次を読みます。

- `AGENTS.md` — 毎ターンの判断基準
- `.cursor/rules/*.mdc` — 取り扱い別の書式（`Notes/**` `Journal/**` `System/**`）
- `System/Schemas/tags.md` — タグの語彙と再構成の合図
- `.cursorignore` — 読ませないパス（`_protected/` と `ai_access: excluded`）

Adapter は `local.settingSources: ["project"]` を指定し、Vault 外のユーザー設定を混ぜません。会話モードは `agent` 固定です。プロンプトへ憲章を複製しません。会話のみ権限のときだけ、ファイルを触らない旨を付けます。

## 会話と Run

- 会話ごとに `Agent.create` または `Agent.resume(agentId)` を使う
- `tools` は resume 時に再指定する（SDK の制約）
- `chat` はツールなし、`vault` は制限なし
- イベントは `run.stream()` から取得し、SSE へ中継する
- 中断は `run.cancel()`（`run.supports("cancel")` を確認）

AccessPolicy は `packages/core` の `toolsForPolicy` で Cursor のツール名へ変換します。

モデル一覧は `Cursor.models.list` で取得し、`GET /models` から返します。取得できないときは `MODEL_OPTIONS` を使います。

初回送信の会話タイトル生成は、本応答の Agent 実行と並行します。タイトルは対話ログのファイル名にも使います。Journal 追記の直前にタイトル確定を待ちます。

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `CURSOR_API_KEY` | Cursor User API Key（`crsr_...`） |
| `CURSOR_MODEL` | モデル ID（既定 `auto`） |

## 要件

- Node.js 22.13 以上
- `@cursor/sdk` 1.x（ワークスペースの lockfile に従う）
