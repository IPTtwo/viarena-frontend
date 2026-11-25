import { api } from './api.js';

const normalize = (item) => ({ ...item, id: String(item.id || item._id) });
const localDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function normalizeWorkspace(data) {
  const users = data.users.map(normalize);
  const user = data.user ? normalize(data.user) : null;
  if (user) {
    const index = users.findIndex((member) => member.id === user.id);
    if (index < 0) users.push(user);
    else users[index] = user;
  }
  const logs = data.logs.map((log) => ({
    ...normalize(log),
    actorId: log.actorId?._id || log.actorId,
    actorName: log.actorId?.name || 'System',
    timestamp: log.createdAt,
    resourceId: log.details?.resourceId || log.eventId || log.targetUserId,
    targetId: log.targetUserId,
    details: log.reason || '',
    previousRoles: log.details?.previousRoles || [],
    nextRoles: log.details?.nextRoles || [],
  }));
  return {
    user,
    users,
    events: data.events.map((event) => ({
      ...normalize(event),
      coOrganizers: event.coOrganizers || [],
      start: localDate(event.start),
      end: localDate(event.end),
      deadline: localDate(event.deadline),
      stream: event.stream
        ? { ...event.stream, scheduledAt: localDate(event.stream.scheduledAt) }
        : undefined,
    })),
    registrations: data.registrations.map((entry) => ({
      ...normalize(entry),
      status: entry.status === 'Cancelled' ? 'Canceled' : entry.status,
    })),
    teams: data.teams.map(normalize),
    tasks: data.tasks.map((task) => ({ ...normalize(task), due: localDate(task.due) })),
    schedules: data.schedules.map((item) => ({
      ...normalize(item),
      startsAt: localDate(item.startsAt),
      endsAt: localDate(item.endsAt),
    })),
    attendance: data.attendance.map(normalize),
    joinCodes: data.joinCodes,
    auditLogs: logs.filter((log) => !log.action.startsWith('role.')),
    roleAudit: logs.filter((log) => log.action.startsWith('role.')),
  };
}

export const loadWorkspace = async (options) =>
  normalizeWorkspace(await api('/workspace', options));
export const workspaceAction = (action, body) =>
  api(`/workspace/actions/${action}`, { method: 'POST', body });

export function eventPayload(fields) {
  if (
    [fields.start, fields.end, fields.deadline].some(
      (value) => !value || !Number.isFinite(new Date(value).getTime()),
    )
  )
    throw new Error('Enter the event start, end, and registration deadline before saving.');
  return {
    title: fields.title.trim(),
    description: fields.description || '',
    category: fields.category,
    venue: fields.venue.trim(),
    start: new Date(fields.start).toISOString(),
    end: new Date(fields.end).toISOString(),
    deadline: new Date(fields.deadline).toISOString(),
    capacity: Number(fields.capacity),
    cover: fields.cover || '',
    eligibility: fields.eligibility || '',
  };
}
