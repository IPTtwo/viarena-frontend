import { useStoredState } from './storage';

export function useAdminState() {
  const [auditLogs, setAuditLogs] = useStoredState('audit_logs', []);
  const [roleAudit, setRoleAudit] = useStoredState('role_audit', []);

  return { auditLogs, setAuditLogs, roleAudit, setRoleAudit };
}
