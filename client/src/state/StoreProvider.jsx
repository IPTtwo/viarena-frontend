import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  canManageEvent,
  canManageRegistrations,
  registrationEligibility,
  hasRole,
  scopedPermission,
} from '../functions/domain';
import { api } from '../services/api.js';
import { eventPayload, loadWorkspace, workspaceAction } from '../services/workspace.js';

const Context = createContext(null);
const empty = {
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
  const [data, setData] = useState(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);
  const [pending, setPending] = useState(false);
  const revision = useRef(0);
  const busy = useRef(false);
  const { user, events, registrations } = data;
  const notify = (message, type = 'success') => setFlash({ message, type });
  const refresh = async (options) => {
    const version = ++revision.current;
    const next = await loadWorkspace(options);
    if (version === revision.current) {
      setData(next);
      setReady(true);
      setError('');
    }
    return next;
  };
  useEffect(() => {
    const controller = new AbortController();
    // Remove obsolete prototype credentials; sessions now use HTTP-only cookies.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('viarena_p2_')) localStorage.removeItem(key);
    }
    refresh({ signal: controller.signal }).catch((err) => {
      if (err.name !== 'AbortError') setError(err.message);
    });
    return () => {
      controller.abort();
      revision.current++;
    };
  }, []);

  const mutate = async (operation) => {
    if (busy.current) throw new Error('Please wait for the current request.');
    busy.current = true;
    setPending(true);
    try {
      const result = await operation();
      await refresh();
      return result;
    } catch (err) {
      if (err.status === 401) {
        setData(empty);
        refresh().catch(() => {});
      }
      notify(err.message, 'error');
      throw err;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const action = (name, body) =>
    mutate(async () => {
      const result = await workspaceAction(name, body);
      return result.resource?.code || result.resource?._id;
    });
  const login = (email, password) =>
    mutate(async () => {
      const result = await api('/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      });
      return result.user;
    });
  const signup = ({ name, email, studentId, password }) =>
    mutate(async () => {
      const address = email.trim().toLowerCase();
      await api('/auth/signup', {
        method: 'POST',
        body: { name: name.trim(), email: address, studentId: studentId.trim(), password },
      });
      const result = await api('/auth/login', {
        method: 'POST',
        body: { email: address, password },
      });
      return result.user;
    });
  const logout = () =>
    mutate(async () => {
      await api('/auth/logout', { method: 'POST' });
      setData(empty);
    });
  const editProfile = (fields) =>
    mutate(() =>
      api('/users/me', {
        method: 'PATCH',
        body: {
          name: fields.name.trim(),
          studentId: fields.studentId.trim(),
          bio: fields.bio || '',
          avatar: fields.avatar || '',
        },
      }),
    );
  const setOrganizerRole = (id, grant, reason) =>
    mutate(() =>
      api(`/admin/users/${id}/organizer-role`, {
        method: 'POST',
        body: { grant, reason },
      }),
    );
  const saveEvent = (fields, id = null) =>
    mutate(async () => {
      const { event } = await api(id ? `/events/${id}` : '/events', {
        method: id ? 'PATCH' : 'POST',
        body: eventPayload(fields),
      });
      const eventId = event.id || event._id;
      if (fields.visibility !== event.visibility)
        await api(
          `/events/${eventId}/${fields.visibility === 'Published' ? 'publish' : 'unpublish'}`,
          { method: 'POST' },
        );
      return eventId;
    });
  const count = (eventId) => events.find((event) => event.id === eventId)?.registeredCount || 0;
  const isRegistered = (eventId) =>
    !!user &&
    registrations.some(
      (r) => r.eventId === eventId && r.userId === user.id && r.status === 'Registered',
    );
  const getRegistrationEligibility = (eventId) =>
    registrationEligibility(
      events.find((e) => e.id === eventId),
      count(eventId),
      isRegistered(eventId),
    );
  const register = (eventId) =>
    mutate(() => api(`/events/${eventId}/registrations`, { method: 'POST' }));
  const cancelRegistration = (eventId, participantId = user?.id) =>
    mutate(() => {
      const registration = registrations.find(
        (r) => r.eventId === eventId && r.userId === participantId && r.status === 'Registered',
      );
      if (!registration) throw new Error('Active registration not found.');
      return api(
        `/events/${eventId}/registrations/${participantId === user?.id ? 'me' : registration.id}`,
        { method: 'DELETE' },
      );
    });
  const permitted = (event, permission) =>
    !!event &&
    !!user &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, permission));
  const state = {
    ...data,
    flash,
    setFlash,
    notify,
    pending,
    refresh,
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
    canManageTeams: (event) => permitted(event, 'manage_teams'),
    canManageSchedule: (event) => permitted(event, 'manage_event_schedule'),
    canManageStream: (event) => permitted(event, 'manage_stream'),
    canManageParticipation: (event) => permitted(event, 'manage_participation'),
    canManageStaff: (event) =>
      !!event &&
      !!user &&
      (hasRole(user, 'Admin') || (event.ownerId === user.id && hasRole(user, 'Organizer'))),
    createTeam: (eventId, name) => action('createTeam', { eventId, name }),
    placeMember: (teamId, userId, remove = false) =>
      action('placeMember', { teamId, userId, remove }),
    assignTeamRole: (teamId, userId, role, remove = false) =>
      action('assignTeamRole', { teamId, userId, role, remove }),
    saveTask: (teamId, fields, taskId = null) =>
      action('saveTask', {
        teamId,
        fields: { ...fields, due: new Date(fields.due).toISOString() },
        taskId,
      }),
    updateTaskStatus: (taskId, status) => action('updateTaskStatus', { taskId, status }),
    saveSchedule: (eventId, fields, scheduleId = null) =>
      action('saveSchedule', {
        eventId,
        fields: {
          ...fields,
          startsAt: new Date(fields.startsAt).toISOString(),
          endsAt: new Date(fields.endsAt).toISOString(),
        },
        scheduleId,
      }),
    removeSchedule: (eventId, scheduleId) => action('removeSchedule', { eventId, scheduleId }),
    saveStream: (eventId, fields) =>
      action('saveStream', {
        eventId,
        fields: {
          ...fields,
          scheduledAt: fields.scheduledAt ? new Date(fields.scheduledAt).toISOString() : '',
        },
      }),
    confirmParticipation: (eventId, userId, verified) =>
      action('confirmParticipation', { eventId, userId, verified }),
    setCoOrganizer: (eventId, userId, permissions, remove = false) =>
      action('setCoOrganizer', { eventId, userId, permissions, remove }),
    reassignEventOwner: (eventId, userId) => action('reassignEventOwner', { eventId, userId }),
    generateJoinCode: (eventId) => action('generateJoinCode', { eventId }),
    disableJoinCode: (eventId) => action('disableJoinCode', { eventId }),
  };
  if (!ready)
    return (
      <main className="content" aria-live="polite">
        {error ? (
          <>
            <h1>Unable to connect</h1>
            <p role="alert">{error}</p>
            <button onClick={() => refresh().catch((err) => setError(err.message))}>
              Retry
            </button>
          </>
        ) : (
          <p>Loading ViArena…</p>
        )}
      </main>
    );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useStore = () => useContext(Context);
