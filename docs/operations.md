# 運用

## ホスト配置

```text
/srv/nousarium/
├─ system/     # 本リポジトリの clone
├─ vault/      # 非公開 Git: nousarium-my-vault
└─ runtime/    # Git 管理外
```

## 前提

- Ubuntu
- Docker Compose
- Git
- Tailscale（Serve 用）
- Cursor User API Key

## 環境変数

| 変数 | 説明 |
| --- | --- |
| `NOUSARIUM_VAULT_PATH` | Vault のパス |
| `NOUSARIUM_RUNTIME_PATH` | runtime のパス |
| `NOUSARIUM_APP_SECRET` | Bearer トークン署名 |
| `CURSOR_API_KEY` | Cursor API Key |
| `CURSOR_MODEL` | モデル ID（任意） |
| `AZURE_SPEECH_KEY` | Azure Speech のキー（音声入力・Azure 利用時） |
| `AZURE_SPEECH_REGION` | Azure Speech のリージョン（例: `japaneast`） |
| `AZURE_SPEECH_LANGUAGE` | 認識言語（任意、既定 `ja-JP`） |
| `NOUSARIUM_WEB_PORT` | web のホストポート（既定 `13000`） |
| `WEB_ORIGIN` | CORS 用オリジン（カンマ区切り可）。アクセス元の URL を列挙する（例: 開発 `http://127.0.0.1:3000`、Compose web `http://127.0.0.1:13000`、Tailscale Serve の HTTPS URL） |
| `HOST_UID` / `HOST_GID` | Vault 所有者の UID/GID（`id -u` / `id -g`） |

## 初期化

```bash
cd /srv/nousarium/system
cp .env.example .env
# .env を編集

pnpm install
pnpm vault:init --path /srv/nousarium/vault
cd /srv/nousarium/vault
git init
git add .
git commit -m "Initialize vault"
```

非公開リモートは Git サービス側で作成し、`git remote add origin ...` で接続します。

## 起動

```bash
docker compose up -d --build
```

| サービス | 公開 |
| --- | --- |
| `web` | `127.0.0.1:13000`（`NOUSARIUM_WEB_PORT` で変更可） |
| `agent-service` | `127.0.0.1:8787`（Cursor SDK、Azure Speech トークン発行） |

## ローカル開発

ローカル開発では `agent-service` を Docker で起動し、web だけを `pnpm` で動かします。

```bash
pnpm agent:up          # docker compose up -d agent-service
pnpm install
pnpm vault:init --path ./data/vault   # 初回のみ
pnpm dev               # web → http://127.0.0.1:3000
```

- web: `http://127.0.0.1:3000`（`AGENT_SERVICE_URL=http://127.0.0.1:8787`）
- agent: Docker の `127.0.0.1:8787`
- ログ: `pnpm agent:logs`
- 停止: `pnpm agent:down`

`pnpm agent:up` はイメージを再ビルドしてから起動します。agent-service のコードを変更したあとも同じコマンドで反映できます。ホスト上で agent-service を直接動かす場合は `pnpm dev:agent`（ポート `8787` を使用）。

## Tailscale Serve

```bash
sudo tailscale serve --bg http://127.0.0.1:13000
```

HTTPS 終端は Tailscale 側です。Funnel は有効にしないでください。ACL で自分の端末だけに限定します。

Tailscale 経由でアクセスする場合、`.env` の `WEB_ORIGIN` に Serve の URL（例: `https://nousarium.example.ts.net`）をカンマ区切りで追加します。

## バックアップ

- Vault: 非公開リモートへの `git push`
- runtime: 停止中にディレクトリを暗号化コピー（任意）
- 対話ログは Vault 内 Markdown のため、Vault のバックアップに含まれます

## 更新

```bash
cd /srv/nousarium/system
git pull
docker compose up -d --build
```

Agent 実行中は更新しないでください。UI に実行中 Run が無いことを確認してから行います。

## 障害

| 症状 | 確認 |
| --- | --- |
| スマホから開けない | Tailscale 接続、Serve 状態、ACL |
| AI が応答しない | `docker compose logs agent-service`、`CURSOR_API_KEY` |
| Agent が起動しない | Vault の UID（`HOST_UID`）、ログ |
| 書き込みが失敗する | Vault の権限、ロック、Git 状態 |
| 誤編集 | 変更履歴から当該 Run を取り消す |

## ログ

```bash
docker compose logs -f agent-service
docker compose logs -f web
```
