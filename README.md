# tonight!（イベント運営アプリ）

受付・バーカウンター・メンバー名簿・出演／シフト・タイムテーブルを管理するクラウド同期アプリです。

## v40 更新方針

v32を画面遷移の基準として再構成し、v33以降で追加された必要な機能だけを選んで移植しました。

- ニックネーム（DJネーム）を名簿に登録・編集・インポート可能。ニックネームがある場合は優先表示し、ない場合は本名を表示。
- 出演・シフトのメンバー選択、NOW/NEXT、タイムライン、受付メンバー表示でニックネームを利用。
- `memberDisplayName` と `recordMemberDisplay` をトップレベル関数として定義し、タイムテーブル描画処理から確実に参照できるように整理。
- 学年・ニックネームを含むCSV／Excelインポート。Excelは先頭30行から見出し行を検出し、既存メンバーは名前で照合。学年の空欄で既存データを消さない。
- メンバー名簿の全員選択・選択者一括削除。参加予定リストからも除外し、過去の履歴は保持。
- 不完全な旧タイムテーブルデータの `acts`・`shifts` を補完する `ensureTt` を維持。
- 戻るボタンと `navigate` / `back` の実装はv32のものを維持し、v33以降で変更された画面遷移処理を持ち込まない。
- Cloudflare Worker名は `tonight-system` を維持。Durable Object `STORE` とAssets設定も維持。
- Wranglerは `4.157.0` に固定。

## ディレクトリ構成

```text
├─ package.json
├─ wrangler.jsonc
├─ src/worker.js
└─ public/
   ├─ index.html
   ├─ app.js
   ├─ style.css
   ├─ manifest.json
   ├─ sw.js
   ├─ TMPlogo.png
   ├─ icon-192.png
   └─ icon-512.png
```

## デプロイ

リポジトリのルートに `public/` と `src/` を置き、Cloudflareで次のコマンドを実行します。

```bash
npm install
npm run deploy
```

Worker名・Durable Objectバインディング・Assets設定を変更しないでください。

## 注意

- URLを知っている人は編集できます。共有範囲に注意してください。
- データはCloudflare Durable Objectに保存します。
- 本ZIPではJavaScript構文・Worker構文・設定・ZIP整合性を確認しています。実ブラウザでの画面遷移や実データの同期テストは未実施です。
