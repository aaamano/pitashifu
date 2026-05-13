-- ============================================================
-- ピタシフ デモシード
-- 対象ユーザー: b.akira.amano@gmail.com
-- 実行: Supabase Studio → SQL Editor で全文を貼って Run
-- 何度実行しても安全（冪等）
-- ============================================================

DO $$
DECLARE
  v_email TEXT := 'b.akira.amano@gmail.com';
  v_auth_user_id UUID;
  v_employee_id UUID;
BEGIN
  -- 1. デモ会社（テナントルート）
  INSERT INTO organizations (id, name, type, plan, settings)
  VALUES (
    'demo',
    'デモ会社',
    'company',
    'free',
    jsonb_build_object(
      'openHour',        9,
      'closeHour',       23,
      'slotInterval',    15,
      'avgProductivity', 8
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. デモ会社配下の店舗
  INSERT INTO organizations (id, name, type, parent_id, plan, settings)
  VALUES (
    'demo-shinjuku',
    'デモ新宿店',
    'store',
    'demo',
    'free',
    jsonb_build_object(
      'openHour',        9,
      'closeHour',       23,
      'slotInterval',    15,
      'avgProductivity', 8
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. b.akira.amano@gmail.com の auth_user_id を取得
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE 'auth.users にメール % のユーザーが見つかりません。先にアプリで /signup を完了してください。', v_email;
    RETURN;
  END IF;

  -- 4. employees に owner として登録
  INSERT INTO employees (
    org_id, auth_user_id, name, email, role,
    employment_type, wage, retention_priority
  )
  VALUES (
    'demo', v_auth_user_id, '管理者', v_email, 'owner',
    'full_time', 1500, 1
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET org_id = EXCLUDED.org_id,
        role   = EXCLUDED.role
  RETURNING id INTO v_employee_id;

  -- 5. 全店舗（このorg配下）へのアクセス権を付与
  INSERT INTO employee_store_access (employee_id, store_id)
  SELECT v_employee_id, o.id
  FROM organizations o
  WHERE o.id = 'demo' OR o.parent_id = 'demo'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ シード完了: % を demo会社のownerとして登録', v_email;
END $$;
