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
| `NOUSARIUM_WEB_PORT` | web のホストポート（既定 `13000`） |
| `WEB_ORIGIN` | CORS 用オリジン（Tailscale URL に合わせる） |
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
| `agent-service` | Compose 内部のみ |

ローカル開発:

```bash
pnpm dev
```

web は `http://127.0.0.1:3000`、agent-service は `http://127.0.0.1:8787` です。

## Tailscale Serve

```bash
sudo tailscale serve --bg http://127.0.0.1:13000
```

HTTPS 終端は Tailscale 側です。Funnel は有効にしないでください。ACL で自分の端末だけに限定します。

Tailscale 経由でアクセスする場合、`.env` の `WEB_ORIGIN` を Serve の URL（例: `https://nousarium.example.ts.net`）に合わせます。

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
