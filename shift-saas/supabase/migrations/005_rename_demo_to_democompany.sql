-- ============================================================
-- 組織ID リネーム: demo → democompany
-- 実行: Supabase Studio → SQL Editor で全文を貼って Run
--
-- organizations.id は他のテーブルからFK参照されているため、
-- 単純な UPDATE では制約違反になる。下記の手順で安全にリネームする：
-- 1. 新IDで会社を複製INSERT
-- 2. 全FK参照を新IDに更新
-- 3. 旧IDをDELETE
-- ============================================================

BEGIN;

-- 1. 新IDで会社をコピー作成
INSERT INTO organizations (id, name, type, parent_id, plan, logo_url, primary_color, settings, created_at, updated_at)
SELECT 'democompany', name, type, parent_id, plan, logo_url, primary_color, settings, created_at, updated_at
FROM organizations WHERE id = 'demo';

-- 2. 関連テーブルのFKを新IDに更新
UPDATE organizations          SET parent_id = 'democompany' WHERE parent_id = 'demo';
UPDATE employees              SET org_id    = 'democompany' WHERE org_id    = 'demo';
UPDATE employee_store_access  SET store_id  = 'democompany' WHERE store_id  = 'demo';
UPDATE shift_periods          SET store_id  = 'democompany' WHERE store_id  = 'demo';
UPDATE shift_versions         SET store_id  = 'democompany' WHERE store_id  = 'demo';
UPDATE shifts                 SET store_id  = 'democompany' WHERE store_id  = 'demo';
UPDATE daily_targets          SET store_id  = 'democompany' WHERE store_id  = 'demo';
UPDATE notifications          SET org_id    = 'democompany' WHERE org_id    = 'demo';

-- 3. 古い demo を削除（参照が無くなったので安全）
DELETE FROM organizations WHERE id = 'demo';

COMMIT;
