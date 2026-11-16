import React, { createContext, useContext, useEffect, useState } from 'react';
import { seedEvents, seedRegistrations, seedUsers } from '../data/fixtures';
import { readStored, storageKey } from './storage';
import { useAdminState } from './adminState';
import { useAuthState } from './authState';
import { useEventState } from './eventState';
import { useTeamState } from './teamState';
import { createStoreActions } from './storeActions';

const Context = createContext(null);

export function StoreProvider({ children }) {
  const { users, setUsers, sessionId, setSessionId, passwords, setPasswords, user } = useAuthState();
  const { events, setEvents, registrations, setRegistrations } = useEventState();
  const {
    teams,
    setTeams,
    tasks,
    setTasks,
    schedules,
    setSchedules,
    attendance,
    setAttendance,
    joinCodes,
    setJoinCodes,
  } = useTeamState();
  const { auditLogs, setAuditLogs, roleAudit, setRoleAudit } = useAdminState();
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const sync = (event) => {
      if (!event.key?.startsWith('viarena_p2_')) return;
      if (event.key === storageKey('teams')) setTeams(readStored('teams', []));
      if (event.key === storageKey('tasks')) setTasks(readStored('tasks', []));
      if (event.key === storageKey('schedules')) setSchedules(readStored('schedules', []));
      if (event.key === storageKey('attendance')) setAttendance(readStored('attendance', []));
      if (event.key === storageKey('audit_logs')) setAuditLogs(readStored('audit_logs', []));
      if (event.key === storageKey('join_codes')) setJoinCodes(readStored('join_codes', []));
      if (event.key === storageKey('users')) setUsers(readStored('users', seedUsers));
      if (event.key === storageKey('role_audit')) setRoleAudit(readStored('role_audit', []));
      if (event.key === storageKey('events')) setEvents(readStored('events', seedEvents));
      if (event.key === storageKey('registrations'))
        setRegistrations(readStored('registrations', seedRegistrations));
      if (event.key === storageKey('passwords')) setPasswords(readStored('passwords', {}));
      if (event.key === storageKey('session')) setSessionId(readStored('session', null));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const actions = createStoreActions({
    user,
    users,
    setUsers,
    sessionId,
    setSessionId,
    passwords,
    setPasswords,
    events,
    setEvents,
    registrations,
    setRegistrations,
    teams,
    setTeams,
    tasks,
    setTasks,
    schedules,
    setSchedules,
    attendance,
    setAttendance,
    setAuditLogs,
    setJoinCodes,
    setRoleAudit,
    setFlash,
  });

  const state = {
    user,
    users,
    events,
    registrations,
    roleAudit,
    flash,
    setFlash,
    teams,
    tasks,
    schedules,
    attendance,
    auditLogs,
    joinCodes,
    ...actions,
  };

  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export const useStore = () => useContext(Context);

