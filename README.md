# Nousarium

自宅サーバー上で動く、個人知識空間のための対話型 Vault です。AI と会話しながら Markdown ノートを蓄積し、既存ノートを参照・編集しながら思想とノウハウを育てます。

システム本体（本リポジトリ）と個人 Vault は分離します。本リポジトリは公開可能です。ノート、対話ログ、API キー、実行時データベースは含めません。

## 機能

- Tailscale 経由でスマホ・PC からチャットする
- 会話を始め、AI が判断してノートを更新する
- Vault 更新の可否を切り替える
- AI による変更を Git で記録し、差分確認と復元ができる
- 人間の Web 編集と AI 編集が競合したとき、黙って上書きしない

## リポジトリの役割

| 名前 | 公開範囲 | 内容 |
| --- | --- | --- |
| `nousarium` | Public | アプリ、ドキュメント、合成デモ Vault |
| `nousarium-my-vault` | Private | 個人の Markdown、対話ログ、添付 |
| runtime（Git 管理外） | 非公開 | SQLite、Cursor セッション、キャッシュ |

Vault と runtime のパスは環境変数で指定します。

```env
NOUSARIUM_VAULT_PATH=/srv/nousarium/vault
NOUSARIUM_RUNTIME_PATH=/srv/nousarium/runtime
NOUSARIUM_APP_SECRET=...
CURSOR_API_KEY=...
```

## 構成

```text
apps/web              Next.js PWA
apps/agent-service    会話・権限・Git・Vault の API
packages/core         ユースケースと Port
packages/contracts    共有スキーマ
packages/agent-cursor Cursor SDK Adapter
packages/vault-fs     ファイル操作と Git
packages/markdown     Frontmatter / Wikilink / タグ
packages/ui           デザイントークンと共通部品
examples/demo-vault   合成データのみ
```

依存の向きは `apps → core ← adapters` です。Cursor SDK、CodeMirror、Node のファイル API は Adapter の内側に閉じ込めます。

## 文書

- [製品仕様](docs/product-spec.md)
- [アーキテクチャ](docs/architecture.md)
- [UI 設計](docs/design.md)
- [Vault 規約](docs/vault-spec.md)
- [セキュリティ](docs/security.md)
- [運用](docs/operations.md)
- [Cursor Runtime](docs/cursor-runtime.md)

## 開発

必要環境: Node.js 22.13 以上、pnpm 10、Docker Compose、Git。

`agent-service` は Docker で起動し、web だけを `pnpm` で開発します。

```bash
pnpm install
cp .env.example .env
pnpm vault:init --path ./data/vault
pnpm agent:up
pnpm dev
```

- web: `http://127.0.0.1:3000`
- agent-service: `http://127.0.0.1:8787`（Compose）

本番起動は [運用](docs/operations.md) を参照してください。
