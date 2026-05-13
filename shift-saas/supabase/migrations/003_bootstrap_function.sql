-- ============================================================
-- ピタシフ ブートストラップ機能
-- 新規signup時に自動で organizations + employees を作成
-- ============================================================

-- 1. 既存ユーザー向けヘルパー（idempotent）
--    現在の auth.uid() が employees に未登録の場合のみ作成
CREATE OR REPLACE FUNCTION bootstrap_owner_account(
  p_company_name TEXT,
  p_user_name    TEXT DEFAULT NULL
)
RETURNS TEXT  -- 作成（または既存）の org_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_org_id       TEXT;
  v_email        TEXT;
  v_name         TEXT;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION '未認証です';
  END IF;
  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN
    RAISE EXCEPTION '会社名は必須です';
  END IF;

  -- 既にemployeesに登録済みなら、そのorg_idを返して終了（idempotent）
  SELECT org_id INTO v_org_id
  FROM employees WHERE auth_user_id = v_auth_user_id LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- auth.users からメール取得
  SELECT email INTO v_email FROM auth.users WHERE id = v_auth_user_id;
  v_name := COALESCE(NULLIF(trim(p_user_name), ''), split_part(v_email, '@', 1));

  -- org_id 自動生成: 'org_' + auth.uid()の頭12文字
  v_org_id := 'org_' || substring(replace(v_auth_user_id::text, '-', '') from 1 for 12);

  -- 会社org作成（既存なら衝突）
  INSERT INTO organizations (id, name, type, plan)
  VALUES (v_org_id, trim(p_company_name), 'company', 'free')
  ON CONFLICT (id) DO NOTHING;

  -- 自分を owner として登録
  INSERT INTO employees (
    org_id, auth_user_id, name, email, role,
    employment_type, wage, retention_priority
  )
  VALUES (
    v_org_id, v_auth_user_id, v_name, v_email, 'owner',
    'full_time', 1500, 1
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN v_org_id;
END $$;

GRANT EXECUTE ON FUNCTION bootstrap_owner_account(TEXT, TEXT) TO authenticated;

-- 2. 既にbootstrap済みかチェック
CREATE OR REPLACE FUNCTION has_employee_row()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION has_employee_row() TO authenticated;
