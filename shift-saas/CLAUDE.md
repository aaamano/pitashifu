# ピタシフ — CLAUDE.md

このファイルはAIアシスタント（Claude Code）向けのプロジェクト引き継ぎドキュメント。
プロトタイプの設計意図・実装済み内容・DB設計・ディレクトリ設計を記載する。

---

## プロダクト概要

**ピタシフ** — 飲食・小売などの店舗向けシフト管理SaaS。
キャッチコピー: 「シフト管理を ピタッと」

### ユーザー種別

| ロール | 説明 |
|--------|------|
| owner / admin | 会社オーナー・管理者。複数店舗を横断管理 |
| manager | 店舗マネージャー。シフト計画・確定・スタッフ管理 |
| staff | 従業員（パート・アルバイト）。シフト希望提出・確認・給与確認 |

### 主要機能

- **マネージャー側**: ダッシュボード・売上目標設定・シフト計画（複数バージョン管理）・AI自動配置・スタッフ管理・給与計算・通知
- **従業員側**: 月間カレンダー表示・シフト希望提出・給与見込み確認・スキマバイト応募・プロフィール設定

---

## 技術スタック

| カテゴリ | 採用技術 |
|----------|---------|
| フロントエンド | React 19 + Vite |
| ルーティング | React Router v6 |
| スタイリング | Tailwind CSS v3 + インラインスタイル |
| バックエンド | Supabase (PostgreSQL + Auth + RLS) |
| デプロイ | Vercel |

### 移行前プロトタイプのスタック（参考）

プロトタイプは Express + better-sqlite3 + React Router で構築済み。
Supabase移行に際してサーバーレイヤーは削除し、Supabase SDK に置き換える。

---

## ブランドデザイン

### カラーパレット

```
INDIGO       #4F46E5   メインブランド・アクティブ
INDIGO_DEEP  #3730A3   ヘッダー背景・強調
INDIGO_SOFT  #EEF0FE   ホバー・背景薄め
CORAL        #FF6B6B   日曜日・警告・アクセント
BG           #F8FAFC   ページ背景
BORDER       #E2E8F0   カード・区切り線
TEXT         #0F172A   メインテキスト
FAINT        #94A3B8   非アクティブ・補助テキスト
```

### ロゴ (`<LogoIcon />` / `<LogoMark />`)

SVG viewBox: 56 × 64。構成要素:
- カレンダーリング 2本 (`#818CF8`)
- カレンダー本体 (`#4F46E5`)
- パズルタブ（右側突き出し円, `#4F46E5`)
- ダークヘッダーバンド (`#3730A3`)
- グリッド線 水平2本 + 垂直2本
- 今日セルハイライト
- スパークル大（opacity 0.72）+ 小（opacity 0.50）

---

## ディレクトリ構成（目標）

```
/
├── public/
│   └── favicon.svg
└── src/
    ├── App.jsx                    # ルーティング: /:orgId/manager, /:orgId/employee
    ├── main.jsx
    ├── index.css                  # デザイントークン + レイアウトクラス
    │
    ├── lib/
    │   ├── supabase.js            # Supabase client 初期化
    │   └── payroll.js             # 給与計算ロジック（純粋関数）
    │
    ├── context/
    │   ├── AuthContext.jsx        # ログインユーザー・セッション管理
    │   └── OrgContext.jsx         # URLの :orgId から会社・店舗情報を解決
    │
    ├── hooks/
    │   ├── useShifts.js
    │   ├── useStaff.js
    │   ├── useTargets.js
    │   └── useNotifications.js
    │
    ├── api/                       # Supabase SDKを使ったデータアクセス層
    │   ├── shifts.js
    │   ├── staff.js
    │   ├── targets.js
    │   ├── notifications.js
    │   └── sukima.js
    │
    ├── components/
    │   ├── Logo.jsx               # LogoIcon / LogoMark
    │   ├── Icons.jsx
    │   ├── ManagerLayout.jsx
    │   ├── EmployeeLayout.jsx
    │   └── EmployeeTabBar.jsx
    │
    ├── pages/
    │   ├── auth/
    │   │   ├── Login.jsx
    │   │   └── Signup.jsx
    │   ├── TopPage.jsx
    │   ├── NotFound.jsx
    │   ├── manager/
    │   │   ├── Dashboard.jsx
    │   │   ├── ShiftList.jsx      # シフトバージョン一覧
    │   │   ├── ShiftDecision.jsx  # シフト確定（AI配置・編集）
    │   │   ├── Members.jsx
    │   │   ├── MemberDetail.jsx
    │   │   ├── Targets.jsx        # 売上・目標設定
    │   │   ├── StoreSettings.jsx
    │   │   ├── Payroll.jsx
    │   │   └── Notifications.jsx
    │   └── employee/
    │       ├── Schedule.jsx       # 月間カレンダー
    │       ├── ShiftSubmit.jsx    # シフト希望提出
    │       ├── EmployeePayroll.jsx
    │       ├── Notifications.jsx
    │       ├── Profile.jsx
    │       ├── SukimaTop.jsx      # スキマバイト一覧
    │       └── SukimaDetail.jsx
    │
    └── utils/
        └── excelImport.js         # Excelシフトデータの読み込み
```

### ルーティング構成

```
/                              → TopPage（ポータル）
/login                         → Login
/signup                        → Signup

/:orgId/manager                → Dashboard
/:orgId/manager/targets        → 売上・目標設定
/:orgId/manager/shift          → ShiftList（バージョン一覧）
/:orgId/manager/shift/:verId   → ShiftDecision（AI配置・確定）
/:orgId/manager/members        → Members
/:orgId/manager/members/:id    → MemberDetail
/:orgId/manager/settings       → StoreSettings
/:orgId/manager/payroll        → Payroll
/:orgId/manager/notifications  → Notifications（マネージャー）

/:orgId/employee               → Schedule（月間カレンダー）
/:orgId/employee/submit        → ShiftSubmit
/:orgId/employee/payroll       → EmployeePayroll
/:orgId/employee/sukima        → SukimaTop
/:orgId/employee/sukima/:id    → SukimaDetail
/:orgId/employee/notifications → Notifications（従業員）
/:orgId/employee/settings      → Profile
```

**予約済みorgId（使用禁止）:** `admin`, `app`, `api`, `login`, `signup`, `settings`, `help`, `support`, `dashboard`, `static`, `public`

---

## DB設計（Supabase / PostgreSQL）

### テーブル一覧

#### `organizations` — 会社・店舗の階層管理

```sql
CREATE TABLE organizations (
  id            TEXT PRIMARY KEY,
  -- URLスラッグ。例: 'segafredo-shinjuku'
  -- type='company' のorgがテナントルート
  -- type='store' のorgはparent_id=会社ID
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('company', 'store')),
  parent_id     TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  logo_url      TEXT,
  primary_color TEXT DEFAULT '#4F46E5',
  settings      JSONB NOT NULL DEFAULT '{}',
  -- settings の構造例:
  -- {
  --   "openHour": 9, "closeHour": 23,
  --   "slotInterval": 15,
  --   "avgProductivity": 8,
  --   "breakRules": [{"minWorkHours":8,"breakMinutes":60}],
  --   "specialTasks": [{"id":1,"name":"搬入","startTime":"9:00","endTime":"9:45","requiredStaff":2}]
  -- }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `employees` — 従業員（会社単位で所属）

```sql
CREATE TABLE employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- org_id は type='company' の organizations.id を指す
  auth_user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'staff'
                       CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  employment_type    TEXT NOT NULL DEFAULT 'part_time'
                       CHECK (employment_type IN ('full_time', 'part_time')),
  wage               INTEGER NOT NULL DEFAULT 1050,    -- 時給（円）
  transit_per_day    INTEGER NOT NULL DEFAULT 0,       -- 1日交通費（円）
  skills             TEXT[] NOT NULL DEFAULT '{}',
  -- 'barista' | 'cashier' | 'floor' | 'opening' | 'closing'
  hourly_orders      INTEGER NOT NULL DEFAULT 8,       -- 生産性（時間オーダー処理数）
  retention_priority INTEGER NOT NULL DEFAULT 5,       -- シフト優先度 1(高)〜10(低)
  target_earnings    INTEGER NOT NULL DEFAULT 0,       -- 目標月収（円）
  phone              TEXT,
  emergency_contact  JSONB,  -- {name, phone, relation}
  bank_info          JSONB,  -- 暗号化推奨
  employment_start   DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `employee_store_access` — 従業員が働ける店舗（中間テーブル）

```sql
CREATE TABLE employee_store_access (
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, store_id)
);
-- employees.available_stores: TEXT[] の代わりにこのテーブルを使う
-- RLSポリシーの記述が容易になり、クエリも効率的
```

#### `staff_incompatibilities` — 相性NG設定

```sql
CREATE TABLE staff_incompatibilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  incompatible_with UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  severity          INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 3),
  -- 1=軽微（スコア減点小）, 2=中程度, 3=重大（同一シフト回避）
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, incompatible_with)
);
```

#### `shift_periods` — シフト提出期間管理

```sql
CREATE TABLE shift_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,  -- '2026年5月 前半'
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  submission_deadline TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed', 'decided')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `shift_requests` — 従業員からのシフト希望提出

```sql
CREATE TABLE shift_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES shift_periods(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  preferred_start TIME,              -- NULL = 休み希望
  preferred_end   TIME,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'confirmed')),
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, employee_id, date)
);
-- プロトタイプの shift_submissions.shift_row（JSONコード配列）を日単位に正規化したもの
```

#### `shift_versions` — マネージャーが作るシフト案のバージョン

```sql
CREATE TABLE shift_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id  UUID REFERENCES shift_periods(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,  -- 'ver1', 'ver2 (試案A)', 'ver3 (週末強化案)'
  status     TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'confirmed')),
  author_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 確定できるバージョンは1つのみ（アプリ側で制御）
```

#### `shifts` — 確定・仮シフト（バージョンに紐づく）

```sql
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID REFERENCES shift_versions(id) ON DELETE CASCADE,
  store_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
  -- NULL かつ is_open=TRUE → スキマバイト募集枠
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_open         BOOLEAN NOT NULL DEFAULT FALSE,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'open', 'assigned', 'confirmed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `shift_applications` — スキマシフトへの応募

```sql
CREATE TABLE shift_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (shift_id, employee_id)
);
```

#### `daily_targets` — 日別売上・人員目標

```sql
CREATE TABLE daily_targets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  sales_target      INTEGER NOT NULL DEFAULT 0,   -- 売上目標（千円）
  customers_target  INTEGER NOT NULL DEFAULT 0,
  avg_spend         INTEGER NOT NULL DEFAULT 0,   -- 客単価（円）
  orders_target     INTEGER NOT NULL DEFAULT 0,
  labor_cost_target INTEGER NOT NULL DEFAULT 0,   -- 人件費目標（千円）
  sales_pattern     TEXT DEFAULT 'weekday1',
  -- 'weekday1' | 'weekday2' | 'friday' | 'saturday' | 'sunday'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, date)
);
```

#### `notifications` — 通知

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  -- NULL = org全員向け
  type         TEXT NOT NULL
                 CHECK (type IN ('submit','confirmed','reminder','alert','warning','info')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### ER図

```mermaid
erDiagram
    organizations {
        TEXT id PK
        TEXT name
        TEXT type
        TEXT parent_id FK
        TEXT plan
        JSONB settings
    }
    employees {
        UUID id PK
        TEXT org_id FK
        UUID auth_user_id
        TEXT name
        TEXT role
        INTEGER wage
        TEXT[] skills
        INTEGER retention_priority
        INTEGER target_earnings
    }
    employee_store_access {
        UUID employee_id PK-FK
        TEXT store_id PK-FK
    }
    staff_incompatibilities {
        UUID id PK
        UUID employee_id FK
        UUID incompatible_with FK
        INTEGER severity
    }
    shift_periods {
        UUID id PK
        TEXT store_id FK
        TEXT name
        DATE period_start
        DATE period_end
        TEXT status
    }
    shift_requests {
        UUID id PK
        UUID period_id FK
        UUID employee_id FK
        DATE date
        BOOLEAN is_available
        TEXT status
    }
    shift_versions {
        UUID id PK
        TEXT store_id FK
        UUID period_id FK
        TEXT name
        TEXT status
        UUID author_id FK
    }
    shifts {
        UUID id PK
        UUID version_id FK
        TEXT store_id FK
        UUID employee_id FK
        DATE date
        TIME start_time
        TIME end_time
        BOOLEAN is_open
        TEXT status
    }
    shift_applications {
        UUID id PK
        UUID shift_id FK
        UUID employee_id FK
        TEXT status
    }
    daily_targets {
        UUID id PK
        TEXT store_id FK
        DATE date
        INTEGER sales_target
        TEXT sales_pattern
    }
    notifications {
        UUID id PK
        TEXT org_id FK
        UUID recipient_id FK
        TEXT type
        BOOLEAN read
    }

    organizations ||--o{ organizations : "parent_id"
    organizations ||--o{ employees : "org_id"
    organizations ||--o{ employee_store_access : "store_id"
    organizations ||--o{ shift_periods : "store_id"
    organizations ||--o{ shift_versions : "store_id"
    organizations ||--o{ shifts : "store_id"
    organizations ||--o{ daily_targets : "store_id"
    organizations ||--o{ notifications : "org_id"
    employees ||--o{ employee_store_access : "employee_id"
    employees ||--o{ staff_incompatibilities : "employee_id"
    employees ||--o{ shift_requests : "employee_id"
    employees ||--o{ shifts : "employee_id"
    employees ||--o{ shift_applications : "employee_id"
    employees ||--o{ notifications : "recipient_id"
    shift_periods ||--o{ shift_requests : "period_id"
    shift_periods ||--o{ shift_versions : "period_id"
    shift_versions ||--o{ shifts : "version_id"
    shifts ||--o{ shift_applications : "shift_id"
```

### RLSポリシー方針

```
auth.uid() → employees.auth_user_id → org_id / employee_store_access

organizations  : 所属org以下のレコードのみ参照可
employees      : 同一org_idのレコードのみ参照可 / 自分のレコードは更新可
shifts         : employee_store_access に含まれるstore_idのみ参照可
shift_requests : 自分のレコードは全操作可 / manager以上は同store全件参照可
shift_versions : manager以上のみ作成・更新可
shift_applications : 自分の応募は全操作可 / managerは同store全件参照可
daily_targets  : manager以上のみ書き込み可 / 同storeは参照可
notifications  : recipient_id = 自分 OR recipient_id IS NULL
```

---

## 給与計算ロジック（`src/lib/payroll.js` に移植）

プロトタイプの `src/data/mockData.js` にある以下の定数・関数をそのまま移植する:

```javascript
// 定数
export const PAYROLL = {
  socialInsuranceThresholdHours: 120,
  rateSocialInsurance: 0.03,
  rateEmploymentInsurance: 0.006,
  ratePension: 0.1735,
  rateIncomeTax: 0.10,
  overtimeMultiplier: 0.25,
  lateNightMultiplier: 0.25,
  lateNightOTMultiplier: 0.5,
  overtimeThresholdHours: 8,
  lateNightStartHour: 22,
}

// 関数（純粋関数として維持）
export function decomposeShiftHours(startHour, endHour, breakRules) { ... }
export function calcDailyPay(wage, labor, overtime, lateNight, otLateNight) { ... }
export function calcMonthlyPayroll(staffMember, monthlyTotals) { ... }
```

---

## シフトコード仕様（Excelインポート互換）

プロトタイプではシフトを文字列コードで管理していた。
DB移行後は `shifts` テーブルの `start_time` / `end_time` に変換して保存する。

| コード | 意味 | start | end |
|--------|------|-------|-----|
| `X` / null | 休み | — | — |
| `F` | フルタイム | 09:00 | 23:00 |
| `9-18` | 9〜18時 | 09:00 | 18:00 |
| `13-L` | 13時〜ラスト | 13:00 | 23:00 |
| `O-16` | オープン〜16時 | 09:00 | 16:00 |
| `17.5-L` | 17:30〜ラスト | 17:30 | 23:00 |

変換関数は `src/utils/excelImport.js` の `parseShiftTimes()` を参照。

---

## AI自動配置ロジック（ShiftDecision）

プロトタイプの `runAIForDays()` 関数の設計思想:

1. 日別注文数 × 時間帯別分布 → 必要人数を時間帯ごとに算出
2. 各スタッフをスコアリング:
   - `retentionPriority`（定着優先度）をベーススコアに
   - `staffIncompatibilities`（相性NG）が同スロットにいたら減点
   - `targetEarnings > 0` のスタッフは加点
   - 前日深夜勤務 → 翌早番を回避するペナルティ
3. スコア順で必要人数分を割り当て

DB移行後もこのロジックはフロントエンド側（またはEdge Function）で実行する。

---

## プロトタイプとの主な差分

| 項目 | プロトタイプ | 本リポジトリ |
|------|------------|------------|
| バックエンド | Express + SQLite | Supabase |
| 認証 | なし（URL直打ち） | Supabase Auth |
| テナント | シングル（固定パス `/pitashif/`） | マルチ（`/:orgId/`） |
| データ | モックデータ（JS定数） | Supabase DB |
| シフトデータ形式 | 文字列コード配列 | `shifts` テーブルの行 |
| 月 | 2026年4月固定 | 動的 |

---

## 実装優先順位（推奨）

1. Supabase設定・DBマイグレーション（テーブル作成 + RLS）
2. 認証フロー（Login / Signup / AuthContext）
3. OrgContext（URLから org / store を解決）
4. 従業員側: Schedule → ShiftSubmit → EmployeePayroll の順
5. マネージャー側: Dashboard → ShiftList/ShiftDecision → Members
6. スキマバイト機能（shift_applications）
7. 通知システム

---

## 参考リポジトリ

プロトタイプの実装: `https://github.com/aaamano/test_env`（`shift-saas/` ディレクトリ）

UIコンポーネントのデザイン・インタラクションはプロトタイプを参照すること。
特にレイアウトシステム（`emp-frame` / `pita-phone-body` の flex構成）はそのまま踏襲してよい。
