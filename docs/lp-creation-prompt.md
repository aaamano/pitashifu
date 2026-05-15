# LP 制作プロンプト — `/lp/001`

> **目的**: ピタシフ (https://pitashifu.vercel.app) の **静的ランディングページ** を `/lp/001/` で公開できる形で 1 枚分作る。
> **使い方**: 別の Claude セッション（または開発者）にこのファイルを丸ごと渡す。本リポジトリの `shift-saas/` 配下を作業ディレクトリにして実装する。

---

## 0. このタスクのゴール

ピタシフ本体アプリ (`shift-saas/`) を**触らずに**、`shift-saas/public/lp/001/` 配下に **HTML / CSS / 画像（SVG）** のみで完結する LP を 1 枚作る。Vite の `public/` 機構によりビルド時にそのまま `dist/lp/001/` にコピーされ、Vercel 上で `https://pitashifu.vercel.app/lp/001/` でアクセス可能になる。

**React、ビルドツール、追加 npm パッケージは使わない。** プレーンな HTML/CSS/JS のみ。

---

## 1. 出力ファイル

```
shift-saas/
└── public/
    └── lp/
        └── 001/
            ├── index.html        # ページ本体
            ├── style.css         # CSS（インラインでも可、ただし可読性のため分離推奨）
            ├── script.js         # FAQ アコーディオン等。不要なら省略可
            └── assets/
                ├── logo.svg      # ピタシフロゴ（下記の SVG をそのまま使う）
                ├── hero.svg      # ヒーロー画像（プレースホルダ SVG で可）
                └── og.png        # OGP（1200×630、プレースホルダで可。SVG でも OK）
```

> **重要**: 本体アプリの `shift-saas/src/` や `shift-saas/vite.config.js` は変更しない。`public/lp/001/` 内に閉じる。

---

## 2. プロダクト概要（LP に書く内容のソース）

### サービス名
**ピタシフ**（Pitashifu）

### キャッチコピー
> 「シフト管理を ピタッと」

### サブコピー候補（どれか採用または合成）
- 飲食・小売の店長を、シフト調整の沼から解放する
- 希望提出 → AI 自動配置 → 確定通知まで、ピタッと
- Excel と LINE のやりとりを終わらせる

### 解決する課題
紙やエクセルで毎月 5〜20 時間消費しているシフト調整作業を、**AI 自動配置 + スマホ完結のシフト希望提出フロー**で圧倒的に短縮する。

### ターゲット
- 業態: 飲食店（カフェ / 居酒屋 / レストラン）・小売（コンビニ・ドラッグストア）
- 規模: 1〜10 店舗、スタッフ 5〜50 名
- 意思決定者: 店長 / オーナー / 本部 SV
- 痛点: シフト調整の長時間化 / 希望と実勤の食い違い / 人件比率コントロール

### 主要機能（実装済み）

#### マネージャービュー（PC ブラウザ）
1. **ダッシュボード** — 月の売上 / 客数 / シフト計画状況を一画面で
2. **目標計画** — 日別の売上・客数・客単価・注文数・人件費を編集。棒+折れ線複合チャートで目標 vs 実績を可視化。人件比率ゲージ（信号機: 青 / 緑 / 黄 / 赤）で範囲内 / 警戒 / 超過を即判定
3. **シフト管理** — 複数バージョンの試案を作成。AI 自動配置で最適解を提示。日 / 週 / 半月の表示単位で工数・金額の整合性を俯瞰
4. **スタッフ管理** — 基本情報・時給・スキル・固定シフト・相性NG。CSV / Excel 一括取込。**招待 URL を発行**して LINE / メールでスタッフを招待
5. **店舗設定** — 営業時間・最小刻み・平均生産性・休憩ルール・業務タスク・人件比率の目標帯
6. **支出管理** — 出勤実績から法定割増・深夜手当・社保・所得税まで自動計算
7. **通知** — シフト確定 / 期限リマインダーを一括送信
8. **インポート** — Airレジの売上 / シフトデータを取り込み

#### スタッフビュー（スマホブラウザ最適化）
1. **月間カレンダー** — シフト希望（緑）と確定シフト（紫）を月表示。「出勤日数 / 勤務時間 / 想定収入」を希望 vs 確定の 2 段表示
2. **シフト希望提出** — 期間ごとに「この日は何時から働ける」を直感入力
3. **給与計算** — 今月の見込みをリアルタイム表示
4. **スキマバイト** — 他店舗の急募シフトに応募
5. **通知** — マネージャーからのお知らせを受信
6. **プロフィール** — 連絡先・銀行口座を本人で更新

### 価値訴求の柱（LP 本文で押す）

| # | 訴求 | 一言 |
|---|---|---|
| 1 | **時短** | 月 10 時間のシフト調整作業が 5 分で終わる |
| 2 | **見える化** | 人件比率を信号機で即判断、目標 vs 実績を一枚で |
| 3 | **スマホ完結** | スタッフは LINE と同じ感覚でシフト希望を出せる |
| 4 | **多店舗対応** | 複数店舗を 1 アカウントで横断 |
| 5 | **AI 自動配置** | スタッフの希望・店舗の必要人員・相性 NG を考慮した最適解を 1 クリックで |
| 6 | **招待 URL** | URL を送るだけで新人がすぐ参加。Excel メール添付の往復が無くなる |

---

## 3. ブランドガイドライン

### カラーパレット（CSS 変数で定義してください）

```css
:root {
  --indigo:        #4F46E5;  /* メインブランド・CTA */
  --indigo-deep:   #3730A3;  /* 強調・ヘッダー */
  --indigo-soft:   #EEF0FE;  /* 背景薄め */
  --coral:         #FF6B6B;  /* 注意・日曜日 */
  --emerald:       #10B981;  /* 成功・シフト希望色 */
  --bg:            #F8FAFC;  /* ページ背景 */
  --bg-gradient:   linear-gradient(135deg, #EEF0FE 0%, #E0F2FE 100%);
  --border:        #E2E8F0;  /* カード区切り */
  --text:          #0F172A;  /* メイン文字 */
  --muted:         #475569;  /* サブ文字 */
  --faint:         #94A3B8;  /* 補助 */
}
```

### フォント

```css
font-family: "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
```

Google Fonts から CDN で読み込む `<link>` を `<head>` に入れる:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800;900&display=swap" rel="stylesheet">
```

### ロゴ SVG（`assets/logo.svg` にそのまま保存）

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" width="56" height="64" aria-hidden="true">
  <!-- カレンダーリング 2本 -->
  <rect x="14" y="2"  width="4" height="10" rx="2" fill="#818CF8"/>
  <rect x="38" y="2"  width="4" height="10" rx="2" fill="#818CF8"/>
  <!-- カレンダー本体 -->
  <rect x="4" y="8" width="48" height="48" rx="6" fill="#4F46E5"/>
  <!-- ダークヘッダーバンド -->
  <rect x="4" y="8" width="48" height="12" fill="#3730A3"/>
  <!-- グリッド線 -->
  <line x1="4"  y1="32" x2="52" y2="32" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <line x1="4"  y1="44" x2="52" y2="44" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <line x1="20" y1="20" x2="20" y2="56" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <line x1="36" y1="20" x2="36" y2="56" stroke="white" stroke-width="0.5" opacity="0.3"/>
  <!-- 今日セル -->
  <rect x="22" y="34" width="12" height="8" rx="2" fill="white" opacity="0.85"/>
  <!-- パズルタブ -->
  <circle cx="52" cy="32" r="4" fill="#4F46E5"/>
  <!-- スパークル -->
  <path d="M48 14 L49.5 17 L52.5 18.5 L49.5 20 L48 23 L46.5 20 L43.5 18.5 L46.5 17 Z" fill="white" opacity="0.72"/>
  <path d="M10 50 L10.8 51.5 L12.3 52.3 L10.8 53 L10 54.5 L9.2 53 L7.7 52.3 L9.2 51.5 Z" fill="white" opacity="0.50"/>
</svg>
```

### デザイントーン

- **角丸**: 8〜16px（要素サイズに応じて）
- **シャドウ**: `0 4px 12px rgba(79,70,229,0.12)` 控えめに
- **CTA ボタン**: `--indigo` 背景 + 白文字、ホバーで `--indigo-deep`
- **見出し**: 太め（700-900）、`--text` 色
- **本文**: 1.6〜1.8 line-height、`--muted`

---

## 4. 構成（必須セクション）

### 4.1 ヘッダー（固定）
- 左: ロゴ (`<img src="assets/logo.svg" width="40">`) + 「ピタシフ」
- 右ナビ（PC のみ）: `機能 / 価格 / よくある質問 / ログイン`
- 右端 CTA: 「**無料で始める**」ボタン → `/signup` へリンク

### 4.2 ヒーロー
- 左カラム:
  - キャッチコピー（48〜56px、太字、`--text`）
  - サブコピー（18-22px、`--muted`、1.7 行高）
  - CTA グループ:
    - メイン: 「無料で始める」→ `/signup`
    - サブ: 「ログイン」→ `/login`
- 右カラム:
  - プロダクトのスクリーンショット風 SVG イラスト（プレースホルダ）または工夫した SVG モックアップ

### 4.3 3 大ベネフィット（3 カラムカード）
| 時短 ⏱ | 見える化 📊 | スマホ完結 📱 |
|---|---|---|
| 月 10 時間 → 5 分 | 人件比率を信号機で判断 | LINE と同じ感覚で希望提出 |

### 4.4 機能セクション（マネージャー / スタッフ で 2 ブロック）
- 各機能を 2〜3 行で説明 + アイコン（絵文字 or SVG）
- マネージャー側: 8 機能、スタッフ側: 6 機能 を簡潔に並べる

### 4.5 使い方フロー（4 ステップ）
1. 登録（30 秒）
2. スタッフを招待（URL を送るだけ）
3. スタッフが希望提出
4. AI 自動配置 → 確定

### 4.6 お客様の声 / 数字（プレースホルダで可）
- 「導入店舗 ◯店 / 月 ◯時間の削減 / スタッフ満足度 ◯%」のような数字ブロック

### 4.7 価格
3 段プラン（具体額は決まっていないので、概算とプレースホルダ）:

| プラン | 月額 | 特徴 |
|---|---|---|
| Free | ¥0 | 1 店舗 / スタッフ 5 名まで |
| Starter | ¥3,980 | 1 店舗 / スタッフ 30 名まで |
| Pro | ¥9,800 | 複数店舗 / 無制限 / API |

または「お問い合わせ」CTA 1 つにまとめても可。

### 4.8 FAQ（アコーディオン）
最低 5 つ:
- Q: 既存の Excel から移行できる？ → A: CSV / Excel インポートに対応
- Q: 何店舗まで管理できる？ → A: プラン次第。Pro は無制限
- Q: スマホアプリは必要？ → A: 不要。ブラウザだけで動作
- Q: 何人まで使える？ → A: プラン次第
- Q: データのセキュリティは？ → A: Supabase の RLS でテナント完全分離

### 4.9 フッター CTA
- 大きな「**まずは無料で試す**」ボタン → `/signup`
- 「お問い合わせはこちら」→ `mailto:` リンク

### 4.10 フッター
- 会社情報（プレースホルダ）
- プライバシーポリシー / 利用規約（リンクはプレースホルダ）
- コピーライト: `© 2026 ピタシフ`

---

## 5. 実装上の制約

1. ✅ **HTML / CSS / 素の JS のみ**（React・Vue・Tailwind 等のフレームワークなし）
2. ✅ **追加 npm パッケージなし**
3. ✅ **画像は SVG をインライン or `assets/` に保存**。CDN 画像は OG 用以外避ける
4. ✅ **完全レスポンシブ**。ブレークポイント: `768px` / `375px`
5. ✅ **CSS 変数で前述のカラーを定義**
6. ✅ **OGP / Twitter Card メタタグを `<head>` に含める**
7. ✅ **CTA は `<a href="/signup">` で記述**（フル page reload で OK）
8. ✅ 既存アプリのデザイン文脈（INDIGO 基調・角丸 12px・シャドウ控えめ）と一貫性を保つ
9. ✅ ファイル全体で **1500 行以内**（HTML + CSS 合計）を目安に
10. ✅ JS は FAQ のアコーディオンのみ。それ以外は不要なら省略可

### OGP メタタグ（参考）

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ピタシフ — シフト管理を ピタッと</title>
<meta name="description" content="飲食・小売向けシフト管理 SaaS。AI 自動配置とスマホ希望提出で、月 10 時間のシフト調整作業を 5 分に。">
<meta property="og:title" content="ピタシフ — シフト管理を ピタッと">
<meta property="og:description" content="飲食・小売向けシフト管理 SaaS。AI 自動配置とスマホ希望提出で、月 10 時間のシフト調整作業を 5 分に。">
<meta property="og:image" content="/lp/001/assets/og.png">
<meta property="og:url" content="https://pitashifu.vercel.app/lp/001/">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
```

### 計測タグ（オプション）

GA4 や Meta Pixel を入れるなら `<head>` の末尾に。プレースホルダで OK:

```html
<!-- 計測タグはあとで差し替え -->
<!-- <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX"></script> -->
```

---

## 6. 動作確認

実装完了後:

```bash
cd shift-saas
npm install   # 既に入っていれば不要
npm run dev   # http://localhost:5173/lp/001/ にアクセスして表示確認

npm run build # dist/lp/001/ に成果物が出ることを確認
```

期待される挙動:
- `http://localhost:5173/lp/001/` で LP が表示される
- スマホ表示（375px 幅）で崩れない
- CTA を押すと `/signup` ページ（React アプリ側）に遷移する
- FAQ のアコーディオンが開閉する
- `npm run build` 後、`shift-saas/dist/lp/001/index.html` が生成される

---

## 7. デリバラブル

### 必須
1. `shift-saas/public/lp/001/index.html`
2. `shift-saas/public/lp/001/style.css`
3. `shift-saas/public/lp/001/assets/logo.svg`
4. `shift-saas/public/lp/001/assets/og.png`（または `og.svg`、1200×630）

### 任意
5. `shift-saas/public/lp/001/script.js`（FAQ 動作などが必要なら）
6. `shift-saas/public/lp/001/assets/hero.svg`（ヒーロー用、独自イラスト）

### 完成時に提示するもの
- 各ファイルへのパスと、それぞれの役割を 3〜5 行で要約
- LP の主要セクションを構造図で示す（ASCII or 箇条書き）
- `npm run dev` 後にアクセスする URL を明記

---

## 8. 注意事項

- **既存の `shift-saas/src/`、`shift-saas/vite.config.js`、`shift-saas/package.json` は触らない**。LP は public 配下に閉じる
- **React Router のルートは追加しない**。Vercel の静的ファイル配信が `/lp/...` を優先するので、SPA 側に干渉しない
- 既存の `/login` `/signup` `/:orgId/manager` `/:orgId/employee` 等のルートはそのまま動く前提
- LP 内のリンクは絶対パス（`/signup`、`/login`）で記述。これでサイト内遷移が動く

---

## 9. 補足: 既存リポジトリ情報

- **リポジトリ**: `aaamano/pitashifu` (GitHub)
- **本番 URL**: https://pitashifu.vercel.app
- **デプロイ**: Vercel 自動デプロイ（main マージ後すぐ反映）
- **本体スタック**: React 19 + Vite + Supabase（本タスクでは触らない）

完成 LP は `main` にマージされれば即 `https://pitashifu.vercel.app/lp/001/` で公開されます。
