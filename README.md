# LGTM Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

HuggingFace の画像生成 AI で「LGTM」文字入り画像を生成し、Cloudinary にアップロードして PR レビュー用の Markdown URL として利用するツール。

- **フロントエンド**: React + TypeScript (Vite)
- **バックエンド**: Node.js + Express（API プロキシ）
- **画像生成**: HuggingFace `router.huggingface.co/hf-inference`（無料枠）
- **画像ホスティング**: Cloudinary（Unsigned Upload）

## 機能

- テキストプロンプトから画像生成（FLUX / SDXL / SD v1.5）
- LGTM テキスト合成（文字色・サイズ・シャドウ・位置を調整可能）
- LGTM 直下にサブテキスト表示（例: "Sunagawa"）
- **⭐ お気に入り**: Cloudinary にアップロード → IndexedDB に永続保存
- **ギャラリー**: 保存済み画像の一覧表示・拡大・Markdown コピー・削除
- PNG ダウンロード

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:

```env
# Hugging Face Token（任意: 未設定時はブラウザで入力）
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cloudinary（お気に入り保存に必要）
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_preset_name
```

### 3. Cloudinary の事前設定

1. [cloudinary.com](https://cloudinary.com) で無料アカウントを作成
2. **Settings → Upload → Upload presets** を開く
3. **Add upload preset** → `Signing Mode` を **Unsigned** に設定
4. プリセット名と Cloud name を `.env` に記入

| 無料枠 | |
|---|---|
| ストレージ | 25 GB |
| 帯域幅 | 25 GB / 月 |

### 4. HuggingFace Token の取得

[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) で **Read** 権限のトークンを作成。

## 起動

### 開発

```bash
npm run dev
```

- Vite dev server: http://localhost:5173
- Express API: http://localhost:3000

### 本番

```bash
npm run build
npm start
```

Express（:3000）が `dist/` を静的配信する。

## 使い方

1. HF Token を入力（`HF_TOKEN` 設定済みの場合は不要）
2. Image Prompt に英語でプロンプトを入力
3. モデル・サイズ・テキストスタイルを選択して **Generate**
4. **⭐ お気に入り** → Cloudinary にアップロードしてギャラリーに保存
5. ヘッダーの **⭐ お気に入り** でギャラリーへ移動 → **Copy** で `![LGTM](URL)` をコピー
6. PR コメントにペースト

## ディレクトリ構成

```
lgtm-gen/
├── server.js              # Express サーバー（HuggingFace / Cloudinary プロキシ）
├── src/
│   ├── App.tsx            # メイン画面（画像生成・お気に入り登録）
│   ├── Gallery.tsx        # ギャラリー画面
│   ├── imageStore.ts      # IndexedDB ヘルパー
│   └── App.css
├── .env.example
├── package.json
└── vite.config.ts
```

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `HF_TOKEN` | 任意 | HuggingFace トークン。未設定時はブラウザで入力 |
| `CLOUDINARY_CLOUD_NAME` | お気に入り機能に必要 | Cloudinary のクラウド名 |
| `CLOUDINARY_UPLOAD_PRESET` | お気に入り機能に必要 | Unsigned アップロードプリセット名 |

## スクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | Vite + Express を同時起動（開発用） |
| `npm run build` | TypeScript + Vite ビルド |
| `npm start` | Express で dist と API を配信 |

## ライセンス

[MIT License](LICENSE) © 2026 k-sunagawa
