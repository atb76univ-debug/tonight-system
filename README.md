# tonight!（イベント運営アプリ）

## 今回の修正
- ニックネーム機能を一旦取り外し、ニックネーム対応前の動作していた `app(7).js` を `public/app.js` として復元。
- タイムテーブル・シフトの画面遷移とヘッダー戻る操作は、動作していた版の実装に戻しています。
- Cloudflare Workerはメンバー同期・ドリンクラインナップ同期・削除履歴保持を含む既存の `worker(2).js` を維持。
- Worker名、Durable Object、Assets、Wranglerのバージョン設定は既存ファイルを維持。

## ディレクトリ構成
```text
tonight/
├── README.md
├── package.json
├── wrangler.jsonc
├── src/
│   └── worker.js
└── public/
    ├── index.html
    ├── app.js
    ├── style.css
    ├── manifest.json
    ├── sw.js
    ├── TMPlogo.png
    ├── icon-192.png
    └── icon-512.png
```

## デプロイ
```bash
npm install
npm run deploy
```

※ 構文検査は実施済み。Cloudflare本番環境でのクリック操作・複数端末同期テストは未実施です。
