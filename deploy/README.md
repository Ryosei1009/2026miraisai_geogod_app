# 本番サーバー (Ubuntu 24.04) セットアップ手順

150同時WebSocket接続を安全に捌くためのOS・インフラ設定です。
すべて本番VM上で root 権限で実施します。

## 1. systemd サービス（自動再起動 + ファイルディスクリプタ上限）

サーバーコードは `uncaughtException` 発生時に `process.exit(1)` する設計のため、
**自動再起動の設定は必須**です（ないと例外1回でイベントが止まります）。

アプリは `/root/shino/index.js` に配置する前提です（geogod.service もこのパスで設定済み）。

> **注意:** `index.js` 単体では動きません。`server/package.json` も同じディレクトリに
> 置いて `npm install` し、`/root/shino/node_modules` を作る必要があります。

```bash
# アプリを配置（リポジトリの server/ の中身を /root/shino へ）
mkdir -p /root/shino
cp server/index.js server/package.json server/package-lock.json /root/shino/
cd /root/shino && npm install --omit=dev

# .env を作成（重要: ADMIN_KEY は20文字以上のランダム文字列にする）
tee /root/shino/.env <<'EOF'
PORT=3001
ADMIN_KEY=ここに長いランダム文字列
CLIENT_ORIGIN=https://参加者がアクセスするURL（末尾スラッシュなし）
EOF
chmod 600 /root/shino/.env

# サービス登録
cp deploy/geogod.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now geogod
systemctl status geogod
```

> `/root` 配下は root 以外読めないため、サービスは root ユーザーで実行します
> （geogod.service で設定済み）。本来は /opt 等に置いて専用ユーザーで動かす方が
> 安全なので、余裕があれば移行を検討してください。
> ログは `/root/shino/logs/` に出力されます。

> **CLIENT_ORIGIN の注意:** WebSocket の Origin 検証（CSWSH対策）はこの変数を
> 設定した場合のみ有効です。値は参加者がブラウザでアクセスするURLと
> スキーム・ホスト・ポートまで完全一致させてください。
> 1文字でも違うと全員が接続できなくなります。本番前に必ず実機で確認すること。

## 2. sysctl（カーネルパラメータ）

```bash
sudo cp deploy/99-geogod-sysctl.conf /etc/sysctl.d/
sudo sysctl --system
```

## 3. HTTPS化（どちらか一方でよい）

### 3-A. Node 直HTTPS（certbot で証明書取得済みならこちら・現在の構成）

`.env` に以下を追加するだけです:

```bash
USE_HTTPS=true
HTTPS_KEY_PATH=/etc/letsencrypt/live/your-domain.example.com/privkey.pem
HTTPS_CERT_PATH=/etc/letsencrypt/live/your-domain.example.com/fullchain.pem
```

> **重要: 証明書の自動更新後に Node の再起動が必要です。**
> アプリは起動時に1回だけ証明書を読み込むため、certbot が更新しても
> 再起動しないと古い証明書を使い続け、いずれ期限切れで全員接続不能になります。
> 以下の更新フックを入れておくこと:
>
> ```bash
> echo '#!/bin/bash
> systemctl restart geogod' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-geogod.sh
> sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-geogod.sh
> ```

### 3-B. nginx でTLS終端（任意・代替手段）

IPあたりの接続数制限や証明書更新の自動反映が欲しい場合の構成。
アプリ側のレート制限等で実用上は十分なため、3-A で動いているなら不要。

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx-geogod.conf /etc/nginx/sites-available/geogod
# ドメイン名と証明書パスを編集してから:
sudo ln -s /etc/nginx/sites-available/geogod /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.example.com
```

nginx でTLS終端する場合、アプリ側は `USE_HTTPS` を設定しない（HTTPのまま）。

## 4. 本番前の負荷テスト（強く推奨）

最悪ケース = ジオモードで150人が出題中にピンを動かし続ける状況を再現します。

```bash
npm install -g artillery
```

```yaml
# loadtest.yml
config:
  target: "wss://your-domain.example.com"
  phases:
    - duration: 120
      arrivalRate: 10
      maxVusers: 150
engines:
  ws: {}
scenarios:
  - engine: ws
    flow:
      - send: '{"type":"join","role":"participant","name":"負荷テスト","clientId":"lt_{{ $uuid }}"}'
      - loop:
          - send: '{"type":"answer:update","lat":35.6,"lng":139.7}'
          - think: 0.5
        count: 200
```

```bash
artillery run loadtest.yml
```

監視ポイント（テスト中に本番VMで実行）:

```bash
# CPU: node プロセスが1コアの70%未満であること
top -p $(pgrep -f 'node index.js')

# 接続数の確認
ss -s | grep estab

# 帯域: 50Mbps 未満に収まっていること
sudo apt install ifstat && ifstat 1
```

さらに、テスト中にクライアント30台分を同時切断（artillery を Ctrl+C）して、
残りの接続が巻き込まれないこと（再接続の嵐が起きないこと）を確認してください。

## 5. 当日のチェックリスト

- [ ] `systemctl status geogod` が active (running)
- [ ] `ADMIN_KEY` が十分長いランダム値になっている
- [ ] `CLIENT_ORIGIN` が本番URLと完全一致している
- [ ] 実機スマホから wss:// で接続・参加できる
- [ ] 証明書更新フック（restart-geogod.sh）が設置済み（Node直HTTPSの場合）
- [ ] 管理画面（?admin=1）に入れる
- [ ] `journalctl -u geogod -f` でログ監視できる状態にしておく
