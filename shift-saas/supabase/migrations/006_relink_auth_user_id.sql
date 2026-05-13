-- ============================================================
-- 診断 + 自動修復: employees.auth_user_id が auth.users.id と紐付いているか確認
--
-- 症状: ログイン後 /:orgId/manager が「組織が見つかりません」になる
-- 原因の多くは employees.auth_user_id が NULL or auth.users.id と不一致
-- ============================================================

-- 1. 現在のリンク状況を確認
SELECT
  e.id            AS employee_id,
  e.name,
  e.email,
  e.role,
  e.org_id,
  e.auth_user_id  AS emp_auth_user_id,
  u.id            AS actual_auth_id,
  CASE
    WHEN e.auth_user_id IS NULL THEN '✗ NOT LINKED (NULL)'
    WHEN u.id IS NULL           THEN '✗ NO auth.users row'
    WHEN e.auth_user_id = u.id  THEN '✓ OK'
    ELSE '✗ MISMATCH'
  END AS status
FROM employees e
LEFT JOIN auth.users u ON u.email = e.email
WHERE e.email IS NOT NULL AND e.email != ''
ORDER BY e.role DESC, e.name;

-- 2. NULL or 不一致を自動修復
-- email が auth.users と一致する employees の auth_user_id を正しい値に補正
UPDATE employees e
SET auth_user_id = u.id
FROM auth.users u
WHERE e.email = u.email
  AND e.email IS NOT NULL
  AND e.email != ''
  AND (e.auth_user_id IS NULL OR e.auth_user_id != u.id);

-- 3. 再確認
SELECT
  e.id, e.email, e.role, e.org_id,
  e.auth_user_id,
  CASE WHEN e.auth_user_id IS NOT NULL THEN '✓' ELSE '✗ still NULL' END AS link_status
FROM employees e
WHERE e.email = 'b.akira.amano@gmail.com';
