-- ============================================================
-- shift_requests に「最終編集者・最終編集日時」を追加
-- 各シフトセルが誰によって最後に変更されたかを保持する
-- ============================================================

ALTER TABLE shift_requests
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 既存レコードは作成日時を編集日時として補填
UPDATE shift_requests
SET last_edited_at = COALESCE(submitted_at, created_at)
WHERE last_edited_at IS NULL;
