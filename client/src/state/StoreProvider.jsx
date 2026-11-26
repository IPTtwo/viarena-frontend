import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '../services/api.js';
import { eventPayload, loadWorkspace, workspaceAction } from '../services/workspace.js';
import {
  canManageEvent,
  canManageRegistrations,
  registrationEligibility,
  hasRole,
  scopedPermission,
} from '../functions/domain';
import { Loading } from '../components/ui/Loading';

const Context = createContext(null);
const emptyWorkspace = {
  user: null,
  users: [],
  events: [],
  registrations: [],
  teams: [],
  tasks: [],
  schedules: [],
  attendance: [],
  auditLogs: [],
  joinCodes: [],
  roleAudit: [],
};

export function StoreProvider({ children }) {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState(null);
  const busy = useRef(false);
  const revision = useRef(0);
  const { user, events, registrations } = workspace;
  const notify = (message, type = 'success') =>
    setFlash({ message, type, id: crypto.randomUUID() });

  const refresh = useCallback(async (options) => {
    const request = ++revision.current;
    const data = await loadWorkspace(options);
    if (request === revision.current) setWorkspace(data);
    return data;
  }, []);

  const connect = useCallback(
    async (signal) => {
      setLoading(true);
      setConnectionError('');
      try {
        await refresh({ signal });
      } catch (error) {
        if (error.name !== 'AbortError') setConnectionError(error.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    const controller = new AbortController();
    void connect(controller.signal);
    return () => {
      controller.abort();
      revision.current += 1;
    };
  }, [connect]);

  // Keep the current snapshot until the server has accepted the change.
  const mutate = async (operation) => {
    if (busy.current) throw new Error('Please wait for the current request to finish.');
    busy.current = true;
    setPending(true);
    try {
      const result = await operation();
      await refresh();
      return result;
    } catch (error) {
      if (error.status === 401) {
        setWorkspace(emptyWorkspace);
        try {
          await refresh();
        } catch {
          /* Keep private data cleared if disconnected. */
        }
      }
      throw error;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const login = (email, password) =>
    mutate(async () => {
      const result = await api('/auth/login', { method: 'POST', body: { email, password } });
      return result.user;
    });
  const signup = (fields) =>
    mutate(async () => {
      const { name, email, studentId, password } = fields;
      await api('/auth/signup', { method: 'POST', body: { name, email, studentId, password } });
      const result = await api('/auth/login', { method: 'POST', body: { email, password } });
      return result.user;
    });
  const logout = () =>
    mutate(async () => {
      await api('/auth/logout', { method: 'POST' });
      setWorkspace(emptyWorkspace);
    });
  const editProfile = (fields) =>
    mutate(() => api('/users/me', { method: 'PATCH', body: fields }));
  const setOrganizerRole = (id, enabled, reason) =>
    mutate(() =>
      api(`/admin/users/${id}/organizer-role`, {
        method: 'POST',
        body: { grant: enabled, reason: reason.trim() },
      }),
    );
  const saveEvent = (fields, id = null) =>
    mutate(async () => {
      const result = await api(id ? `/events/${id}` : '/events', {
        method: id ? 'PATCH' : 'POST',
        body: eventPayload(fields),
      });
      const eventId = String(result.event.id || result.event._id);
      if (result.event.visibility !== fields.visibility) {
        await api(
          `/events/${eventId}/${fields.visibility === 'Published' ? 'publish' : 'unpublish'}`,
          { method: 'POST' },
        );
      }
      return eventId;
    });
  const count = (eventId) => events.find((event) => event.id === eventId)?.registeredCount ?? 0;
  const isRegistered = (eventId) =>
    !!user &&
    registrations.some(
      (entry) =>
        entry.eventId === eventId && entry.userId === user.id && entry.status === 'Registered',
    );
  const getRegistrationEligibility = (eventId) =>
    registrationEligibility(
      events.find((event) => event.id === eventId),
      count(eventId),
      isRegistered(eventId),
    );
  const register = (eventId) =>
    mutate(() => api(`/events/${eventId}/registrations`, { method: 'POST' }));
  const cancelRegistration = (eventId, participantId = user?.id) =>
    mutate(() => {
      const registration = registrations.find(
        (entry) =>
          entry.eventId === eventId &&
          entry.userId === participantId &&
          entry.status === 'Registered',
      );
      if (!registration) throw new Error('Active registration not found.');
      return api(
        `/events/${eventId}/registrations/${participantId === user?.id ? 'me' : registration.id}`,
        { method: 'DELETE' },
      );
    });
  const action = (name, body) =>
    mutate(async () => (await workspaceAction(name, body)).resource);
  const allowed = (event, permission) =>
    !!event &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, permission));
  const state = {
    ...workspace,
    pending,
    flash,
    setFlash,
    notify,
    login,
    signup,
    logout,
    editProfile,
    setOrganizerRole,
    saveEvent,
    count,
    isRegistered,
    getRegistrationEligibility,
    register,
    cancelRegistration,
    canManageEvent: (event, actor = user) => canManageEvent(event, actor),
    canManageRegistrations: (event, actor = user) => canManageRegistrations(event, actor),
    canManageTeams: (event) => allowed(event, 'manage_teams'),
    canManageSchedule: (event) => allowed(event, 'manage_event_schedule'),
    canManageStream: (event) => allowed(event, 'manage_stream'),
    canManageParticipation: (event) => allowed(event, 'manage_participation'),
    canManageStaff: (event) =>
      !!event &&
      (hasRole(user, 'Admin') || (event.ownerId === user?.id && hasRole(user, 'Organizer'))),
    createTeam: async (eventId, name) =>
      String((await action('createTeam', { eventId, name }))._id),
    placeMember: (teamId, userId, remove = false) =>
      action('placeMember', { teamId, userId, remove }),
    assignTeamRole: (teamId, userId, role, remove = false) =>
      action('assignTeamRole', { teamId, userId, role, remove }),
    saveTask: async (teamId, fields, taskId = null) =>
      String((await action('saveTask', { teamId, fields, taskId }))._id),
    updateTaskStatus: (taskId, status) => action('updateTaskStatus', { taskId, status }),
    saveSchedule: async (eventId, fields, scheduleId = null) =>
      String((await action('saveSchedule', { eventId, fields, scheduleId }))._id),
    removeSchedule: (eventId, scheduleId) => action('removeSchedule', { eventId, scheduleId }),
    saveStream: (eventId, fields) => action('saveStream', { eventId, fields }),
    confirmParticipation: (eventId, userId, verified) =>
      action('confirmParticipation', { eventId, userId, verified }),
    setCoOrganizer: (eventId, userId, permissions, remove = false) =>
      action('setCoOrganizer', { eventId, userId, permissions, remove }),
    reassignEventOwner: (eventId, userId) => action('reassignEventOwner', { eventId, userId }),
    generateJoinCode: async (eventId) => (await action('generateJoinCode', { eventId })).code,
    disableJoinCode: (eventId) => action('disableJoinCode', { eventId }),
  };

  return (
    <Context.Provider value={state}>
      {loading ? (
        <Loading label="Connecting to ViArena..." />
      ) : connectionError ? (
        <main className="center-page">
          <h1>Unable to connect</h1>
          <p role="alert">{connectionError}</p>
          <button className="button primary" onClick={() => void connect()}>
            Retry
          </button>
        </main>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
