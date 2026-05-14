-- ============================================================
-- employees DELETE ポリシーを manager 以上に拡張
-- 旧: owner/admin のみ削除可
-- 新: is_manager_or_above() = owner/admin/manager すべて削除可
-- ============================================================

DROP POLICY IF EXISTS emp_delete_manager ON employees;

CREATE POLICY emp_delete_manager ON employees
  FOR DELETE USING (
    org_id = current_org_id() AND is_manager_or_above()
  );
