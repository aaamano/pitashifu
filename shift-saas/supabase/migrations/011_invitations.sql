-- ============================================================
-- ピタシフ 招待 URL 機構
--
-- 目的: マネージャーが「招待 URL」を発行し、URL を踏んでサインアップ
--       したユーザーを指定した org / role / 店舗に自動で紐付ける
-- 実行: Supabase Studio → SQL Editor で全文を貼って Run
-- ============================================================

-- 1. invitations テーブル
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 付与する店舗アクセス権（複数指定可、空配列=会社全店舗ではなく付与なし）
  store_ids   TEXT[] NOT NULL DEFAULT '{}',
  -- メール指定があれば、そのメールでサインアップした人だけ受諾可
  email       TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  name_hint   TEXT,  -- 「田中 太郎さん」のように招待発行時の希望表示名
  invited_by  UUID REFERENCES employees(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token  ON invitations(token);

-- 2. RLS — マネージャー以上のみ自分の org の招待を CRUD 可
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_select_own_org ON invitations;
CREATE POLICY invitations_select_own_org ON invitations
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS invitations_insert_own_org ON invitations;
CREATE POLICY invitations_insert_own_org ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS invitations_update_own_org ON invitations;
CREATE POLICY invitations_update_own_org ON invitations
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- 3. 招待を消費する RPC
--    SECURITY DEFINER で RLS をバイパスし、employees + employee_store_access を更新
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS JSON  -- { org_id, role }
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_inv     invitations%ROWTYPE;
  v_email   TEXT;
  v_emp_id  UUID;
  v_name    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未認証です';
  END IF;

  SELECT * INTO v_inv
  FROM invitations
  WHERE token = p_token
    AND used_at   IS NULL
    AND revoked_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION '招待が無効です（期限切れ、取消済み、または存在しないトークン）';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- email 指定の招待ならメール一致を要求（大文字小文字無視）
  IF v_inv.email IS NOT NULL AND lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION '招待されたメールアドレスと一致しません';
  END IF;

  v_name := COALESCE(NULLIF(trim(v_inv.name_hint), ''), split_part(v_email, '@', 1));

  -- employees にアップサート
  INSERT INTO employees (
    org_id, auth_user_id, name, email, role,
    employment_type, wage, retention_priority
  )
  VALUES (
    v_inv.org_id, v_uid, v_name, v_email, v_inv.role,
    CASE WHEN v_inv.role IN ('owner','admin','manager') THEN 'full_time' ELSE 'part_time' END,
    1050, 5
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        role   = EXCLUDED.role,
        name   = COALESCE(employees.name, EXCLUDED.name)
  RETURNING id INTO v_emp_id;

  -- 店舗アクセス権
  IF array_length(v_inv.store_ids, 1) > 0 THEN
    INSERT INTO employee_store_access (employee_id, store_id)
    SELECT v_emp_id, sid FROM unnest(v_inv.store_ids) AS sid
    ON CONFLICT DO NOTHING;
  END IF;

  -- 招待を消費
  UPDATE invitations
  SET used_at = NOW(), used_by = v_uid
  WHERE id = v_inv.id;

  RETURN json_build_object('org_id', v_inv.org_id, 'role', v_inv.role);
END $$;

GRANT EXECUTE ON FUNCTION accept_invitation(TEXT) TO authenticated;

-- 4. トークンから招待情報をプレビューする RPC（未認証OK）
--    /invite/:token ページで「◯◯会社にどのロールで招待」を表示するのに使う
CREATE OR REPLACE FUNCTION preview_invitation(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv      invitations%ROWTYPE;
  v_org_name TEXT;
BEGIN
  SELECT * INTO v_inv FROM invitations WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = v_inv.org_id;

  RETURN json_build_object(
    'found',      true,
    'org_id',     v_inv.org_id,
    'org_name',   v_org_name,
    'role',       v_inv.role,
    'email',      v_inv.email,
    'name_hint',  v_inv.name_hint,
    'expires_at', v_inv.expires_at,
    'used',       v_inv.used_at   IS NOT NULL,
    'revoked',    v_inv.revoked_at IS NOT NULL,
    'expired',    v_inv.expires_at <= NOW()
  );
END $$;

GRANT EXECUTE ON FUNCTION preview_invitation(TEXT) TO anon, authenticated;
