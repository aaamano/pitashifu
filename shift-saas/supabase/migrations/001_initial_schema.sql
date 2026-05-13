-- ============================================================
-- ピタシフ initial schema
-- 対象: Supabase (PostgreSQL)
-- 参照: CLAUDE.md「DB設計」
-- ============================================================

-- pgcrypto: gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. organizations — 会社・店舗の階層管理
-- ============================================================
CREATE TABLE organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('company', 'store')),
  parent_id     TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
  logo_url      TEXT,
  primary_color TEXT DEFAULT '#4F46E5',
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_parent_id ON organizations(parent_id);
CREATE INDEX idx_organizations_type      ON organizations(type);

-- ============================================================
-- 2. employees — 従業員（会社単位で所属）
-- ============================================================
CREATE TABLE employees (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'staff'
                       CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  employment_type    TEXT NOT NULL DEFAULT 'part_time'
                       CHECK (employment_type IN ('full_time', 'part_time')),
  wage               INTEGER NOT NULL DEFAULT 1050,
  transit_per_day    INTEGER NOT NULL DEFAULT 0,
  skills             TEXT[] NOT NULL DEFAULT '{}',
  hourly_orders      INTEGER NOT NULL DEFAULT 8,
  retention_priority INTEGER NOT NULL DEFAULT 5,
  target_earnings    INTEGER NOT NULL DEFAULT 0,
  phone              TEXT,
  emergency_contact  JSONB,
  bank_info          JSONB,
  employment_start   DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_org_id       ON employees(org_id);
CREATE INDEX idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX idx_employees_role         ON employees(role);

-- ============================================================
-- 3. employee_store_access — 従業員が働ける店舗（中間テーブル）
-- ============================================================
CREATE TABLE employee_store_access (
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, store_id)
);

CREATE INDEX idx_esa_store_id ON employee_store_access(store_id);

-- ============================================================
-- 4. staff_incompatibilities — 相性NG設定
-- ============================================================
CREATE TABLE staff_incompatibilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  incompatible_with UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  severity          INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, incompatible_with)
);

CREATE INDEX idx_incompat_employee_id ON staff_incompatibilities(employee_id);

-- ============================================================
-- 5. shift_periods — シフト提出期間管理
-- ============================================================
CREATE TABLE shift_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  submission_deadline TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed', 'decided')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_periods_store_id ON shift_periods(store_id);
CREATE INDEX idx_shift_periods_status   ON shift_periods(status);

-- ============================================================
-- 6. shift_requests — 従業員からのシフト希望提出
-- ============================================================
CREATE TABLE shift_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES shift_periods(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  preferred_start TIME,
  preferred_end   TIME,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'confirmed')),
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, employee_id, date)
);

CREATE INDEX idx_shift_requests_period_id   ON shift_requests(period_id);
CREATE INDEX idx_shift_requests_employee_id ON shift_requests(employee_id);
CREATE INDEX idx_shift_requests_date        ON shift_requests(date);

-- ============================================================
-- 7. shift_versions — マネージャーが作るシフト案のバージョン
-- ============================================================
CREATE TABLE shift_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id  UUID REFERENCES shift_periods(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'confirmed')),
  author_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_versions_store_id  ON shift_versions(store_id);
CREATE INDEX idx_shift_versions_period_id ON shift_versions(period_id);

-- ============================================================
-- 8. shifts — 確定・仮シフト（バージョンに紐づく）
-- ============================================================
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID REFERENCES shift_versions(id) ON DELETE CASCADE,
  store_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
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

CREATE INDEX idx_shifts_version_id  ON shifts(version_id);
CREATE INDEX idx_shifts_store_id    ON shifts(store_id);
CREATE INDEX idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX idx_shifts_date        ON shifts(date);
CREATE INDEX idx_shifts_is_open     ON shifts(is_open) WHERE is_open = TRUE;

-- ============================================================
-- 9. shift_applications — スキマシフトへの応募
-- ============================================================
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

CREATE INDEX idx_shift_apps_shift_id    ON shift_applications(shift_id);
CREATE INDEX idx_shift_apps_employee_id ON shift_applications(employee_id);

-- ============================================================
-- 10. daily_targets — 日別売上・人員目標
-- ============================================================
CREATE TABLE daily_targets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  sales_target      INTEGER NOT NULL DEFAULT 0,
  customers_target  INTEGER NOT NULL DEFAULT 0,
  avg_spend         INTEGER NOT NULL DEFAULT 0,
  orders_target     INTEGER NOT NULL DEFAULT 0,
  labor_cost_target INTEGER NOT NULL DEFAULT 0,
  sales_pattern     TEXT DEFAULT 'weekday1',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, date)
);

CREATE INDEX idx_daily_targets_store_id ON daily_targets(store_id);
CREATE INDEX idx_daily_targets_date     ON daily_targets(date);

-- ============================================================
-- 11. notifications — 通知
-- ============================================================
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
                 CHECK (type IN ('submit','confirmed','reminder','alert','warning','info')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_org_id       ON notifications(org_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_read         ON notifications(read) WHERE read = FALSE;

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shift_versions_updated_at
  BEFORE UPDATE ON shift_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLSポリシー
-- 方針: auth.uid() → employees.auth_user_id → org_id / employee_store_access
-- ============================================================

-- ヘルパー関数: 現在のユーザーの employees.id
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- ヘルパー関数: 現在のユーザーの org_id (会社ID)
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- ヘルパー関数: 現在のユーザーの role
-- 注: PostgreSQLの予約語 CURRENT_ROLE と衝突するため pita_ プレフィックス
CREATE OR REPLACE FUNCTION pita_current_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- ヘルパー関数: 現在のユーザーが manager以上か
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role IN ('owner','admin','manager')
  FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- ヘルパー関数: 与えられた store_id にアクセス可能か（社員も同社内の店舗も）
CREATE OR REPLACE FUNCTION has_store_access(p_store_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_store_access esa
    JOIN employees e ON e.id = esa.employee_id
    WHERE e.auth_user_id = auth.uid() AND esa.store_id = p_store_id
  )
  OR EXISTS (
    -- 同一会社配下の店舗・会社org自体への管理者アクセス
    SELECT 1 FROM organizations o
    JOIN employees e ON e.auth_user_id = auth.uid()
    WHERE o.id = p_store_id
      AND (o.id = e.org_id OR o.parent_id = e.org_id)
      AND e.role IN ('owner','admin','manager')
  )
$$;

-- ── organizations ──
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_select ON organizations
  FOR SELECT USING (
    id = current_org_id()
    OR parent_id = current_org_id()
    OR EXISTS (
      SELECT 1 FROM employee_store_access esa
      WHERE esa.employee_id = current_employee_id()
        AND esa.store_id = organizations.id
    )
  );

CREATE POLICY org_update ON organizations
  FOR UPDATE USING (
    (id = current_org_id() OR parent_id = current_org_id())
    AND pita_current_role() IN ('owner','admin')
  );

-- ── employees ──
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY emp_select ON employees
  FOR SELECT USING (
    org_id = current_org_id()
  );

CREATE POLICY emp_update_self ON employees
  FOR UPDATE USING (
    auth_user_id = auth.uid()
  );

CREATE POLICY emp_update_manager ON employees
  FOR UPDATE USING (
    org_id = current_org_id() AND is_manager_or_above()
  );

CREATE POLICY emp_insert_manager ON employees
  FOR INSERT WITH CHECK (
    org_id = current_org_id() AND is_manager_or_above()
  );

CREATE POLICY emp_delete_manager ON employees
  FOR DELETE USING (
    org_id = current_org_id() AND pita_current_role() IN ('owner','admin')
  );

-- ── employee_store_access ──
ALTER TABLE employee_store_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY esa_select ON employee_store_access
  FOR SELECT USING (
    employee_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = employee_store_access.employee_id
        AND e.org_id = current_org_id()
    )
  );

CREATE POLICY esa_write_manager ON employee_store_access
  FOR ALL USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = employee_store_access.employee_id
        AND e.org_id = current_org_id()
    )
  );

-- ── staff_incompatibilities ──
ALTER TABLE staff_incompatibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY incompat_select ON staff_incompatibilities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = staff_incompatibilities.employee_id
        AND e.org_id = current_org_id()
    )
  );

CREATE POLICY incompat_write_manager ON staff_incompatibilities
  FOR ALL USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = staff_incompatibilities.employee_id
        AND e.org_id = current_org_id()
    )
  );

-- ── shift_periods ──
ALTER TABLE shift_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY periods_select ON shift_periods
  FOR SELECT USING (
    has_store_access(store_id)
  );

CREATE POLICY periods_write_manager ON shift_periods
  FOR ALL USING (
    is_manager_or_above() AND has_store_access(store_id)
  );

-- ── shift_requests ──
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY requests_select_self ON shift_requests
  FOR SELECT USING (
    employee_id = current_employee_id()
  );

CREATE POLICY requests_select_manager ON shift_requests
  FOR SELECT USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM shift_periods p
      WHERE p.id = shift_requests.period_id
        AND has_store_access(p.store_id)
    )
  );

CREATE POLICY requests_write_self ON shift_requests
  FOR ALL USING (
    employee_id = current_employee_id()
  );

CREATE POLICY requests_write_manager ON shift_requests
  FOR ALL USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM shift_periods p
      WHERE p.id = shift_requests.period_id
        AND has_store_access(p.store_id)
    )
  );

-- ── shift_versions ──
ALTER TABLE shift_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY versions_select ON shift_versions
  FOR SELECT USING (
    has_store_access(store_id)
  );

CREATE POLICY versions_write_manager ON shift_versions
  FOR ALL USING (
    is_manager_or_above() AND has_store_access(store_id)
  );

-- ── shifts ──
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_select ON shifts
  FOR SELECT USING (
    has_store_access(store_id)
  );

CREATE POLICY shifts_write_manager ON shifts
  FOR ALL USING (
    is_manager_or_above() AND has_store_access(store_id)
  );

-- ── shift_applications ──
ALTER TABLE shift_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY apps_select_self ON shift_applications
  FOR SELECT USING (
    employee_id = current_employee_id()
  );

CREATE POLICY apps_select_manager ON shift_applications
  FOR SELECT USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = shift_applications.shift_id
        AND has_store_access(s.store_id)
    )
  );

CREATE POLICY apps_write_self ON shift_applications
  FOR ALL USING (
    employee_id = current_employee_id()
  );

CREATE POLICY apps_write_manager ON shift_applications
  FOR ALL USING (
    is_manager_or_above() AND EXISTS (
      SELECT 1 FROM shifts s
      WHERE s.id = shift_applications.shift_id
        AND has_store_access(s.store_id)
    )
  );

-- ── daily_targets ──
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY targets_select ON daily_targets
  FOR SELECT USING (
    has_store_access(store_id)
  );

CREATE POLICY targets_write_manager ON daily_targets
  FOR ALL USING (
    is_manager_or_above() AND has_store_access(store_id)
  );

-- ── notifications ──
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_select ON notifications
  FOR SELECT USING (
    recipient_id = current_employee_id()
    OR (recipient_id IS NULL AND org_id = current_org_id())
  );

CREATE POLICY notif_update_self ON notifications
  FOR UPDATE USING (
    recipient_id = current_employee_id()
  );

CREATE POLICY notif_insert_manager ON notifications
  FOR INSERT WITH CHECK (
    is_manager_or_above() AND org_id = current_org_id()
  );

CREATE POLICY notif_delete_manager ON notifications
  FOR DELETE USING (
    is_manager_or_above() AND org_id = current_org_id()
  );
