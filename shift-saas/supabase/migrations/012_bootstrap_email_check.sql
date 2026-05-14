-- ============================================================
-- bootstrap_owner_account を email 既存チェック付きに改修
--
-- 背景:
--   従来の bootstrap_owner_account は employees.auth_user_id だけを見ていた
--   ため、マネージャーが事前に email だけ入力して作っておいた employees 行
--   (auth_user_id = NULL) があっても無視され、新規 owner+会社が作られて
--   しまっていた。
--
-- 新しい挙動:
--   1. auth_user_id が一致する employees がある → そのまま返す（idempotent）
--   2. email が一致する employees があり、かつ auth_user_id が空 / 異なる
--      → その行に auth_user_id を埋めて紐付け、その行の org_id を返す
--   3. 上記いずれもなければ、従来通り 新規会社 org + 新規 owner を作る
--
-- これにより:
--   - 招待 URL 機構を使わなくても、email 一致で正しい組織に合流できる
--   - 既存運用 (Members 画面で email だけ追加 → スタッフが /signup) でも
--     スタッフが新規会社を作ってしまう事故が起きない
-- ============================================================

CREATE OR REPLACE FUNCTION bootstrap_owner_account(
  p_company_name TEXT,
  p_user_name    TEXT DEFAULT NULL
)
RETURNS TEXT  -- 作成（または既存合流）の org_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id  UUID := auth.uid();
  v_email         TEXT;
  v_name          TEXT;
  v_org_id        TEXT;
  v_emp_id        UUID;
  v_existing_emp  RECORD;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION '未認証です';
  END IF;

  -- ① 既に自分の auth.uid で employees にいるなら、その org_id を返して終了
  SELECT org_id INTO v_org_id
  FROM employees WHERE auth_user_id = v_auth_user_id LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- auth.users からメール取得
  SELECT email INTO v_email FROM auth.users WHERE id = v_auth_user_id;
  v_name := COALESCE(NULLIF(trim(p_user_name), ''), split_part(v_email, '@', 1));

  -- ② email が一致する既存 employees があれば、それに auth_user_id を埋めて合流
  SELECT id, org_id, role
  INTO v_existing_emp
  FROM employees
  WHERE lower(email) = lower(v_email)
    AND (auth_user_id IS NULL OR auth_user_id <> v_auth_user_id)
  ORDER BY
    -- 優先順: auth_user_id が NULL → そのまま埋める方が安全
    CASE WHEN auth_user_id IS NULL THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_existing_emp.id IS NOT NULL THEN
    UPDATE employees
    SET auth_user_id = v_auth_user_id
    WHERE id = v_existing_emp.id;
    RETURN v_existing_emp.org_id;
  END IF;

  -- ③ どこにも無ければ、新規会社 org + owner を作成（従来の挙動）
  IF p_company_name IS NULL OR length(trim(p_company_name)) = 0 THEN
    RAISE EXCEPTION '会社名は必須です';
  END IF;

  -- org_id 自動生成: 'org_' + auth.uid()の頭12文字
  v_org_id := 'org_' || substring(replace(v_auth_user_id::text, '-', '') from 1 for 12);

  INSERT INTO organizations (id, name, type, plan)
  VALUES (v_org_id, trim(p_company_name), 'company', 'free')
  ON CONFLICT (id) DO NOTHING;

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
