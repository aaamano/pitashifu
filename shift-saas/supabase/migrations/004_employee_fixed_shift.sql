-- ============================================================
-- employees に固定シフト用 JSONB 列を追加
-- 構造例: { mon: { enabled, start, end }, tue: {...}, ... }
-- ============================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS fixed_shift JSONB NOT NULL DEFAULT '{}';
