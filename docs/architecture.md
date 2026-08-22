# アーキテクチャ

## 配置

```text
スマホ / PC
  → Tailscale Serve (HTTPS, tailnet 限定)
    → web (Next.js, 127.0.0.1:13000)
      → agent-service (Compose 内部)
        → Cursor SDK Local Runtime
        → Vault (bind mount)
        → runtime SQLite (volume)
```

`web` は Vault をマウントしません。ファイル操作と Agent 実行は `agent-service` に集約します。

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
apps/web           → contracts, ui
apps/agent-service → core, contracts, agent-cursor, vault-fs
packages/core      → contracts
packages/agent-cursor → core, contracts, @cursor/sdk
packages/vault-fs  → core, contracts
packages/markdown  → contracts
packages/ui        → なし（React / Tailwind のみ）
```

`core` と `contracts` は `@cursor/sdk`、`next`、`codemirror`、`node:fs` を import しません。

## 主要 Port

```ts
interface AgentPort {
  send(input: AgentInput): AsyncIterable<AgentEvent>;
  cancel(runId: string): Promise<void>;
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
}
```

Cursor 固有の Agent ID やツール名は `packages/agent-cursor` の内側で変換します。詳細は [Cursor Runtime](cursor-runtime.md) を参照してください。

## 会話と Run

1. クライアントがメッセージを POST する
2. サービスが現在の `ConversationMode` と `AccessPolicy` をスナップショットする
3. 書き込みが必要な場合は Vault ロックと Git チェックポイントを取る
4. `AgentPort.send` が Cursor Agent を resume し、許可ツールを指定して送信する
5. イベントを SSE で中継する
6. 完了後、差分があれば Run 単位で commit する
7. 対話本文を Journal Markdown に追記する

同一会話への送信は直列化します。異なる会話は並列できますが、Vault 書き込みは全体で 1 件です。

## リアルタイム

通常チャットは HTTP POST + SSE です。WebSocket は使いません。中断は別エンドポイントです。

イベント種別:

- `run.started`
- `agent.bound`
- `assistant.delta`
- `tool.started` / `tool.completed`
- `note.proposed`
- `run.finished`（`status`: `finished` | `error` | `cancelled`）

## 永続化

| データ | 置き場 |
| --- | --- |
| ノート本文 | Vault Markdown |
| 対話全文 | `10_Journal/Conversations/*.md` |
| 会話メタ、Agent ID、Run、権限 | runtime SQLite |
| Cursor ローカル状態 | runtime 配下 |
| 変更履歴 | Vault の Git |

## 交換可能性

- AI ランタイム: `AgentPort` の実装を差し替える
- ファイル層: `VaultPort` の実装を差し替える
- Markdown 編集 UI: `MarkdownEditor` の Adapter を差し替える
- プレビュー: レンダラだけ差し替える

交換しても残るものは、Vault の Markdown、Properties、Wikilink、Git 履歴です。
