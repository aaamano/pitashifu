-- ============================================================
-- notification_reads: ユーザーごとの通知既読状態を管理
--
-- 既存の notifications.read は1つの真偽値のため、
-- 組織全体宛 (recipient_id IS NULL) の通知を誰かが既読にすると
-- 全員に伝播してしまう不具合があった。
-- このテーブルで (notification_id, employee_id) ペアを記録して
-- ユーザーごとの既読を実現する。
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_employee_id
  ON notification_reads(employee_id);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- 自分の既読履歴のみ参照可能
CREATE POLICY nrd_select_own ON notification_reads
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- 自分の既読のみ追加可能
CREATE POLICY nrd_insert_own ON notification_reads
  FOR INSERT WITH CHECK (
    employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- 自分の既読のみ削除可能（任意機能）
CREATE POLICY nrd_delete_own ON notification_reads
  FOR DELETE USING (
    employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );
