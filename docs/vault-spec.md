# Vault 規約

個人 Vault は非公開 Git リポジトリです。システムリポジトリとは別パスに置きます。

## 表記

| 対象 | 言語 |
| --- | --- |
| ディレクトリ名 | 英語 |
| Property キー | 英語 |
| 機械判定用 Property 値 | 英語 |
| タイトル | 日本語 |
| 本文 | 日本語 |
| タグ | 日本語 |

## 軸の責務

上から順に当てて、最初に当たったところで止める。

| 問い | 軸 |
| --- | --- |
| 誰が書くか・AI に見せるかが変わるか | ディレクトリ |
| 特定の 1 ノートを指しているか | Wikilink |
| 語彙が閉じていて、機械が絞り込むか。ノート自身の状態か | プロパティ |
| 内容そのもので、多値で、増えていくか | タグ |

ディレクトリは取り扱いの分離です。知識ノートは扱いが同じなので分けません。分野横断の構造はタグではなく Wikilink と概念ノートで表します。

## ディレクトリ

```text
vault/
├─ AGENTS.md
├─ .cursor/
│  └─ rules/
├─ Notes/
├─ Journal/
│  └─ Conversations/
├─ System/
│  ├─ Templates/
│  └─ Schemas/
├─ _assets/
├─ _protected/
└─ Trash/
```

| パス | 取り扱い |
| --- | --- |
| `Notes/` | 知識ノート。フラット。AI が作り、育てる |
| `Journal/Conversations/` | 対話ログ。システムが追記。AI は書き換えない |
| `System/` | 規約・テンプレート・語彙。参照する。語彙の追加は人間の承認が要る |
| `_assets/` | 添付 |
| `_protected/` | Agent から物理的に読ませない |
| `Trash/` | 復元待ち |

知識ノートのタイトルは Vault 全体で一意です。分類のためにファイルを移動しません。

## Properties

共通フィールド:

```yaml
---
type: [method, concept]
status: developing
confidence: high
tags: [思考/内省]
aliases: []
created: 2026-08-23
updated: 2026-08-23
ai_access: normal
---
```

| キー | 値 |
| --- | --- |
| `type` | 多値。`concept` `question` `method` `decision` `project` `source` `map` `conversation` |
| `status` | `seed` `developing` `stable` `superseded` `archived` `raw` |
| `confidence` | `low` `medium` `high` |
| `ai_access` | `normal` `excluded` |
| `retention` | `permanent`（対話ログのみ） |

`review_after` は期限を切って見直すときだけ足します。分類が決まらないノートは `status: seed` のまま `Notes/` に置きます。

## タグ

主題の 1 軸だけです。語彙と運用の正本は `System/Schemas/tags.md` です。

```yaml
tags: [思考/内省, 技術/TypeScript]
```

- 第1段は閉じた語彙。第2段は自由。深さは 2 まで
- 1 ノートあたり 1〜3 個
- 第1段に当てはまらなければ新語を作らず、タグを付けずに `status: seed` にする
- 第1段を増やせるのは人間だけ
- プロジェクト名や固有名詞はタグにせず、`[[ノート名]]` で指す

分野をまたぐ共通の構造はタグではなく Wikilink で表します。リンク先は未作成で構いません。表記ゆれは対象ノートの `aliases` で吸収します。

## 関係

本文に明示します。

```markdown
## 関係

- supports: [[知識は接続によって再利用可能になる]]
- contradicts: [[知識量を増やせば理解は深まる]]
- derived-from: [[Journal/Conversations/2026/08/20260823T003235-アファンタジア|アファンタジアの対話]]
```

`derived-from` はシステムが書きます。パス形式なので Obsidian でも解決できます。矛盾する主張は片方を消さず、両方を残して接続します。

## 対話ログ

パス例: `Journal/Conversations/2026/08/20260823T003235-vault_整理.md`

ファイル名の先頭タイムスタンプは ISO 8601 基本形式（`YYYYMMDDTHHMMSS`）。Frontmatter の `created` / `updated` は `YYYY-MM-DD` のまま。

ファイル名の区切り: `-` はタイムスタンプとタイトルなど役割の境界、`_` はタイトル内の単語区切り。

- `type: [conversation]`
- `status: raw`
- `retention: permanent`
- Frontmatter の `conversation_id` はシステムが書く
- 本文の「参照・更新したノート」はシステムが書く。`updated` は Run で編集したノート、`referenced` は応答中の `[[ノート名]]`
- 本文の対話セクションは追記専用
- 再利用知識は `Notes/` へ抽出し、ログからリンクする

## AI の判断基準

規約の実行時の正本は Vault ルートの `AGENTS.md` と `.cursor/rules/` です。初期化コマンドが生成し、以降は Vault 側で編集します。タグ語彙は `System/Schemas/tags.md` に置き、rules へ複製しません。

| ファイル | 対象 |
| --- | --- |
| `AGENTS.md` | 毎ターンの判断、Vault 検索、Web 検索、応答の深さ、残す / 残さない、分類の歪みの提案 |
| `.cursor/rules/note-format.mdc` | `Notes/**` の書式、type、タグ参照 |
| `.cursor/rules/journal.mdc` | 対話ログは追記専用 |
| `.cursor/rules/system.mdc` | System は参照のみ。語彙追加は承認が要る |
| `System/Schemas/tags.md` | 第1段語彙、書き方、再構成の合図 |
| `System/Schemas/properties.md` | type / status / confidence の語彙 |

自動実行してよいもの: 明示指示に基づく新規ノート、seed と developing ノートの更新、Properties 補完、タグ正規化、壊れたリンクの指摘。

確認後: タグ語彙の変更、ノート統合、`stable` 本文の変更、タイトル変更。

行わないもの: 対話ログの改変、矛盾する主張の一方削除、保護領域への侵入、`git push` や履歴破壊、第1段タグの無断追加。

`.cursorignore` は `_protected/` と `ai_access: excluded` のノートから生成します。

## テンプレート

`System/Templates/` に種別ごとの雛形を置きます。初期化コマンドが生成します。複数の type を持つノートは、該当する雛形の節を合成します。
