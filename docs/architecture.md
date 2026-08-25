# アーキテクチャ

## 配置

```text
スマホ / PC
  → Tailscale Serve (HTTPS, tailnet 限定)
    → web (Next.js, 127.0.0.1:13000)
      → agent-service (127.0.0.1:8787 / Compose)
        → Cursor SDK Local Runtime（cwd = Vault）
        → Vault (bind mount)
        → runtime SQLite (volume)
```

ローカル開発では `agent-service` を Docker で起動し、web だけ `pnpm dev`（`http://127.0.0.1:3000`）で動かします。

`web` は Vault をマウントしません。ファイル操作と Agent 実行は `agent-service` に集約します。

判断・検索・ノート編集は Cursor が行います。規約は Vault の `AGENTS.md` と `.cursor/rules` です。Nousarium は会話の器、対話ログの追記、Git の安全網を担当します。

## モノレポ

```text
nousarium/
├─ apps/web
├─ apps/agent-service
├─ packages/core
├─ packages/contracts
├─ packages/agent-cursor
├─ packages/vault-fs
├─ packages/markdown
├─ packages/ui
├─ examples/demo-vault
└─ docs
```

依存の向き:

```text
apps/web           → contracts, core, markdown, ui
apps/agent-service → core, contracts, agent-cursor, vault-fs, markdown
packages/core      → contracts
packages/agent-cursor → core, contracts, @cursor/sdk
packages/vault-fs  → core, contracts, markdown
packages/markdown  → marked, yaml
packages/ui        → React, Tailwind, Radix Primitives
```

`core` と `contracts` は `@cursor/sdk`、`next`、`codemirror`、`node:fs` を import しません。

## 主要 Port

```ts
interface AgentPort {
  send(input: AgentInput): AsyncIterable<AgentEvent>;
  cancel(runId: string): Promise<void>;
  generateConversationTitle(message: string, model?: string): Promise<string>;
  listModels(): Promise<Array<{ id: string; label: string }>>;
}

interface VaultPort {
  list(path?: VaultPath): Promise<VaultEntry[]>;
  read(path: VaultPath): Promise<VaultDocument>;
  save(input: SaveDocumentInput): Promise<SaveResult>;
  search(query: SearchQuery): Promise<SearchHit[]>;
}

interface VersionControlPort {
  checkpoint(label: string): Promise<GitRef>;
  commitRun(runId: string, message: string): Promise<GitRef>;
  diff(from: GitRef, to?: GitRef): Promise<FileDiff[]>;
  revertRun(runId: string): Promise<GitRef>;
  changedPaths(from: GitRef): Promise<string[]>;
}
```

Cursor 固有の Agent ID やツール名は `packages/agent-cursor` の内側で変換します。詳細は [Cursor Runtime](cursor-runtime.md) を参照してください。

## 会話と Run

1. クライアントがメッセージを POST する
2. サービスが現在の `AccessPolicy` をスナップショットする
3. 初回送信なら会話タイトル（対話ログのファイル名にも使う）の生成を本応答と並行で始める
4. Git チェックポイントを取る（対話ログの追記があるため）
5. `vault` 権限なら Vault ロックのうえで Agent を動かす
6. `AgentPort.send` が Cursor Agent を resume し、許可ツールを指定して送信する
7. イベントを SSE で中継する（タイトルが決まり次第 `conversation.titled` も送る）
8. 対話本文を Journal Markdown に追記する。Frontmatter に `conversation_id`、本文に参照・更新したノートを書く。編集したノートの `## 関係` に `derived-from` を足す
9. リンクを含めて Run 単位で commit する

同一会話への送信は直列化します。異なる会話は並列できますが、Vault 書き込みは全体で 1 件です。

ノートと対話の相互リンクは Vault の Markdown が正本です。runtime SQLite は `journal_path` から会話を引く索引としてだけ使います。

- `GET /notes/relations?path=Notes/xxx.md` — ノートが更新した対話と、参照された対話
- `GET /conversations/by-journal?path=Journal/Conversations/...` — 対話ログから会話を引く
- `GET /models` — 利用できるモデル。`AgentPort.listModels` の結果
- `SearchQuery.prefix` — 検索の走査範囲（参照の逆引きは `Journal/Conversations` に絞る）

## リアルタイム

通常チャットは HTTP POST + SSE です。WebSocket は使いません。中断は別エンドポイントです。

イベント種別:

- `run.started`
- `run.status`（`sending` `checkpoint` `starting` `thinking`）
- `agent.bound`
- `assistant.delta`
- `tool.started` / `tool.completed`
- `conversation.titled`
- `run.finished`（`status`: `finished` | `error` | `cancelled`、任意で `diffs`）

## 永続化

| データ | 置き場 |
| --- | --- |
| ノート本文 | Vault Markdown |
| 対話全文 | `Journal/Conversations/*.md` |
| 会話メタ、Agent ID、Run、権限 | runtime SQLite |
| Cursor ローカル状態 | runtime 配下 |
| 変更履歴 | Vault の Git |
| AI の判断基準 | Vault の `AGENTS.md` と `.cursor/rules` |

## 交換可能性

- AI ランタイム: `AgentPort` の実装を差し替える
- ファイル層: `VaultPort` の実装を差し替える
- Markdown 編集 UI: `MarkdownEditor` の Adapter を差し替える
- プレビュー: レンダラだけ差し替える
- 音声入力: Azure Speech Adapter（既定）と Web Speech Adapter を設定で切替。Azure のキーは agent-service のみが持ち、短命トークンを発行する

交換しても残るものは、Vault の Markdown、Properties、Wikilink、Git 履歴、`AGENTS.md` です。
