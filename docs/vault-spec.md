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

## ディレクトリ

```text
vault/
├─ 00_Inbox/
├─ 10_Journal/
│  ├─ Daily/
│  └─ Conversations/
├─ 20_Knowledge/
│  ├─ Concepts/
│  ├─ Questions/
│  ├─ Methods/
│  └─ Decisions/
├─ 30_Projects/
│  ├─ Active/
│  ├─ Incubating/
│  └─ Archived/
├─ 40_Sources/
│  ├─ Books/
│  ├─ Articles/
│  ├─ Web/
│  └─ People/
├─ 50_Outputs/
│  ├─ Drafts/
│  └─ Published/
├─ 80_Maps/
├─ 90_System/
│  ├─ Templates/
│  ├─ Schemas/
│  ├─ Prompts/
│  └─ Reports/
├─ _assets/
└─ Trash/
```

ディレクトリは運用上の置き場所です。知識分野はタグ、意味関係は Wikilink で表します。階層は 3 段以内です。

## Properties

共通フィールド:

```yaml
---
id: 01K36N7P7Z0F4B6A2M8J
type: concept
status: developing
created: 2026-08-22
updated: 2026-08-22
aliases: []
tags: []
projects: []
sources: []
confidence: medium
ai_access: normal
review_after:
---
```

| キー | 値 |
| --- | --- |
| `type` | `inbox` `daily` `conversation` `concept` `question` `method` `decision` `project` `source` `output` `map` |
| `status` | `seed` `developing` `stable` `superseded` `archived` `raw` |
| `ai_access` | `normal` `excluded` |
| `confidence` | `low` `medium` `high` |
| `retention` | `permanent`（対話ログ） |

`id` は生成後に変更しません。ファイル名を変えても同一ノートとして扱います。

## タグ

3 系統に限定します。

```text
#分野/哲学/認識論
#分野/技術/AI
#観点/安全性
#観点/使いやすさ
#要確認/検証
#要確認/矛盾
```

プロジェクト名はタグにせず、`projects` からプロジェクトノートへ Wikilink します。

## 関係

本文に明示します。

```markdown
## 関係

- supports: [[知識は接続によって再利用可能になる]]
- contradicts: [[知識量を増やせば理解は深まる]]
- derived-from: [[関連する対話ログ]]
```

矛盾する主張は片方を消さず、両方を残して接続します。

## 対話ログ

パス例: `10_Journal/Conversations/2026/08/20260822T162045-vault_整理.md`

ファイル名の先頭タイムスタンプは ISO 8601 基本形式（`YYYYMMDDTHHMMSS`）。Frontmatter の `created` / `updated` は `YYYY-MM-DD` のまま。

ファイル名の区切り: `-` はタイムスタンプとタイトルなど役割の境界、`_` はタイトル内の単語区切り。

- `type: conversation`
- `status: raw`
- `retention: permanent`
- 本文の対話セクションは追記専用
- 再利用知識は `20_Knowledge` へ抽出し、ログからリンクする

## AI の整理範囲

自動実行してよいもの: Properties 補完、タグ正規化、壊れたリンク検出、Inbox 分類候補、MOC 更新候補。

確認後: ノート移動、統合、`stable` 本文の変更、タイトル変更。

行わないもの: 対話ログの改変、矛盾する主張の一方削除、保護領域への侵入、`git push` や履歴破壊。

## テンプレート

`90_System/Templates/` に種別ごとの雛形を置きます。初期化コマンドが生成します。
