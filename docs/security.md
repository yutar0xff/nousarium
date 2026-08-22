# セキュリティ

## 方針

ホスト全体では狭く、隔離した Vault 内では広くします。使い勝手は復元可能性で担保します。

## 境界

Agent コンテナが触れる書き込み可能な領域:

- `NOUSARIUM_VAULT_PATH`
- `NOUSARIUM_RUNTIME_PATH`
- コンテナ内の `/tmp`

渡さないもの:

- ホストのホーム
- Docker socket
- SSH 鍵
- システムリポジトリの書き込み
- runtime 以外の個人ファイル
- Cursor API キー以外の秘密情報ファイル

コンテナ設定:

- ホスト UID/GID で実行（`HOST_UID` / `HOST_GID`）
- 読み取り専用ルートファイルシステム
- `cap_drop: ALL`
- `no-new-privileges`
- agent-service は Compose 内部のみ公開

## 権限とツール

| AccessPolicy | ツール |
| --- | --- |
| `chat` | なし（テキストのみ） |
| `read` | `read` `grep` `glob` `ls` |
| `vault-work` | 上記に加え `write` `edit` `shell` |

`shell` は Vault を cwd にします。拒否するコマンド例:

- `curl` `wget` `scp` `ssh` `nc`
- `git push` `git clean` `git reset --hard` `git rebase`
- Vault 外への `rm -rf`、`chmod`、`sudo`

## モデル送信

Vault のファイルは自宅に残ります。Cursor Agent が読んだ内容は推論のため外部へ送られます。完全オフラインではありません。

- `ai_access: excluded` は通常検索と文脈構築から外す
- 見せたくない内容は保護ディレクトリへ移す
- 機密ノートを `vault-work` で開かない

## Git 復元

書き込み Run の流れ:

1. Vault ロック
2. 未コミット変更があれば事前チェックポイント
3. Agent 実行
4. 差分を保存
5. `nousarium-run:<runId>` 形式のコミット
6. ロック解除

取り消しは `git reset --hard` ではなく、逆変更を新しいコミットにします。リモートへは非公開 Repo へ任意のタイミングで push します。自動 push は既定オフです。

## 秘密情報

- `CURSOR_API_KEY` は Agent コンテナの環境変数のみ
- `NOUSARIUM_APP_SECRET` は Bearer トークン署名用
- `.env` は Git に含めない
- Vault 内に API キーを書かない

## アプリ認証

Tailscale で到達範囲を限定します。Web クライアントは初回 API 呼び出し時に `/login` から Bearer トークンを自動取得します。Funnel は使いません。
