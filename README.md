# tonight!（ニックネーム対応・修正版）

## デプロイ

Cloudflare Workers プロジェクトのルートにこのフォルダの内容を配置してください。

```bash
npm install
npm run deploy
```

Worker名、Durable Object `STORE`、Assets設定は変更していません。

今回の修正：`recordMemberDisplay` と `memberDisplayName` をスクリプト先頭のトップレベルに配置し、タイムテーブル描画より前に利用できるよう整理しました。Service Worker のキャッシュキーを `tonight-v4` に更新し、HTML の CSS / JS 読み込みにもバージョンを付けて古いファイルが残りにくいようにしています。
