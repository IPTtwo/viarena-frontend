import { seedUsers, passwordForSeedAccount } from '../data/fixtures';
import {
  canManageEvent, canManageRegistrations, canCreateEvent, registrationEligibility,
  validateEvent, normalizedEmail, validSchoolEmail, canAssignOrganizer, hasRole, scopedPermission,
} from '../functions/domain';
import { makeId } from './storage';

export function createStoreActions({
  user, users, setUsers, sessionId, setSessionId, passwords, setPasswords,
  events, setEvents, registrations, setRegistrations, teams, setTeams,
  tasks, setTasks, schedules, setSchedules, attendance, setAttendance,
  setAuditLogs, setJoinCodes, setRoleAudit, setFlash,
}) {
  const notify = (message, type = 'success') => setFlash({ message, type, id: makeId() });
  // Local prototype credentials only. Production authentication must use a server session.
  const digest = async (password, salt) => {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const data = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(data), (b) => b.toString(16).padStart(2, '0')).join('');
  };
  const login = async (email, password) => {
    const member = users.find((u) => normalizedEmail(u.email) === normalizedEmail(email));
    if (!member) throw Error('Incorrect email or password.');
    const credential = passwords[member.id];
    const match = credential
      ? (await digest(password, credential.salt)) === credential.hash
      : seedUsers.some((u) => u.id === member.id) && password === passwordForSeedAccount;
    if (!match) throw Error('Incorrect email or password.');
    setSessionId(member.id);
    return member;
  };
  const signup = async ({ name, email, studentId, password }) => {
    const trimmed = name.trim(),
      address = normalizedEmail(email),
      student = studentId.trim();
    if (trimmed.length < 2 || !student) throw Error('Enter your full name and student ID.');
    if (!validSchoolEmail(address)) throw Error('Use a valid @adnu.edu.ph school email.');
    if (users.some((x) => normalizedEmail(x.email) === address))
      throw Error('An account with this email already exists.');
    if (users.some((x) => x.studentId?.toLowerCase() === student.toLowerCase()))
      throw Error('This student ID is already registered.');
    if (password.length < 8) throw Error('Password must have at least 8 characters.');
    const member = {
      id: makeId(),
      name: trimmed,
      email: address,
      studentId: student,
      roles: ['Participant'],
      bio: '',
      avatar: '',
    };
    const salt = makeId();
    const hash = await digest(password, salt);
    setPasswords((a) => ({ ...a, [member.id]: { salt, hash } }));
    setUsers((a) => [...a, member]);
    setSessionId(member.id);
    return member;
  };
  const logout = () => setSessionId(null);
  const editProfile = (fields) => {
    if (!fields.name?.trim() || !fields.studentId?.trim())
      throw Error('Name and student ID are required.');
    if (
      users.some(
        (x) =>
          x.id !== sessionId &&
          x.studentId?.toLowerCase() === fields.studentId.trim().toLowerCase(),
      )
    )
      throw Error('This student ID is already in use.');
    setUsers((a) =>
      a.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              name: fields.name.trim(),
              bio: (fields.bio || '').trim(),
              avatar: fields.avatar || '',
              studentId: fields.studentId.trim(),
            }
          : x,
      ),
    );
  };
  const setOrganizerRole = (id, enabled) => {
    const member = users.find((x) => x.id === id);
    const authorization = canAssignOrganizer(user, member, events, enabled);
    if (!authorization.allowed) throw Error(authorization.reason);
    setRoleAudit((a) => [
      {
        id: makeId(),
        actorId: user.id,
        actorName: user.name,
        targetId: id,
        previousRoles: [...member.roles],
        nextRoles: enabled
          ? [...new Set([...member.roles, 'Organizer'])]
          : member.roles.filter((r) => r !== 'Organizer'),
        action: enabled ? 'Assigned Organizer' : 'Revoked Organizer',
        timestamp: new Date().toISOString(),
      },
      ...a,
    ]);
    setUsers((a) =>
      a.map((x) =>
        x.id === id
          ? {
              ...x,
              roles: enabled
                ? [...new Set([...x.roles, 'Organizer'])]
                : x.roles.filter((r) => r !== 'Organizer'),
            }
          : x,
      ),
    );
  };
  const canManageEventFor = (e, actor = user) => canManageEvent(e, actor);
  const canManageRegistrationsFor = (e, actor = user) => canManageRegistrations(e, actor);
  const saveEvent = (fields, id = null) => {
    if (!user) throw Error('Sign in first.');
    const original = id ? events.find((e) => e.id === id) : null;
    if (id && (!original || !canManageEventFor(original)))
      throw Error('You cannot edit this event.');
    if (!id && !canCreateEvent(user)) throw Error('Organizer permission required.');
    const visibility = fields.visibility === 'Published' ? 'Published' : 'Draft';
    const validation = validateEvent(fields, visibility === 'Published', id ? count(id) : 0);
    if (validation) throw Error(validation);
    const safe = {
      title: fields.title.trim(),
      description: (fields.description || '').trim(),
      category: fields.category,
      venue: fields.venue.trim(),
      start: fields.start,
      end: fields.end,
      deadline: fields.deadline,
      capacity: Number(fields.capacity),
      cover: fields.cover || '',
      eligibility: (fields.eligibility || '').trim(),
      visibility,
      updatedAt: new Date().toISOString(),
    };
    if (id) {
      setEvents((a) => a.map((e) => (e.id === id ? { ...e, ...safe } : e)));
      return id;
    }
    const nextId = makeId();
    setEvents((a) => [
      {
        ...safe,
        id: nextId,
        ownerId: user.id,
        coOrganizers: [],
        createdAt: new Date().toISOString(),
      },
      ...a,
    ]);
    return nextId;
  };
  const count = (eventId) =>
    registrations.filter((r) => r.eventId === eventId && r.status === 'Registered').length;
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
  const register = (eventId) => {
    if (!user) throw Error('Sign in before registering.');
    const eligibility = getRegistrationEligibility(eventId);
    if (!eligibility.allowed) throw Error(eligibility.reason);
    setRegistrations((a) => [
      ...a,
      {
        id: makeId(),
        eventId,
        userId: user.id,
        createdAt: new Date().toISOString(),
        status: 'Registered',
      },
    ]);
  };
  const cancelRegistration = (eventId, participantId = user?.id) => {
    const event = events.find((e) => e.id === eventId);
    if (!user || !event || (participantId !== user.id && !canManageRegistrationsFor(event)))
      throw Error('You cannot cancel this registration.');
    if (participantId === user.id && new Date(event.end) <= new Date())
      throw Error('Completed event registrations cannot be canceled.');
    setRegistrations((a) =>
      a.map((r) =>
        r.eventId === eventId && r.userId === participantId && r.status === 'Registered'
          ? { ...r, status: 'Canceled' }
          : r,
      ),
    );
  };
  const logAction = (action, resourceId, details = '') =>
    setAuditLogs((a) => [
      {
        id: makeId(),
        actorId: user?.id,
        actorName: user?.name || '',
        action,
        resourceId,
        details,
        timestamp: new Date().toISOString(),
      },
      ...a,
    ]);
  const getEvent = (id) => events.find((e) => e.id === id);
  const requireEventPermission = (id, permission) => {
    const event = getEvent(id);
    if (!event) throw Error('Event not found.');
    const allowed =
      hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, permission);
    if (!allowed) throw Error('You do not have permission to manage this event.');
    return event;
  };
  const canManageTeams = (event) =>
    !!event &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, 'manage_teams'));
  const canManageSchedule = (event) =>
    !!event &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, 'manage_event_schedule'));
  const canManageStream = (event) =>
    !!event &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, 'manage_stream'));
  const canManageParticipation = (event) =>
    !!event &&
    (hasRole(user, 'Admin') ||
      (event.ownerId === user?.id && hasRole(user, 'Organizer')) ||
      scopedPermission(event, user, 'manage_participation'));
  const canManageStaff = (event) =>
    !!event &&
    (hasRole(user, 'Admin') || (event.ownerId === user?.id && hasRole(user, 'Organizer')));
  const createTeam = (eventId, name) => {
    requireEventPermission(eventId, 'manage_teams');
    if (!name?.trim()) throw Error('Enter a team name.');
    if (
      teams.some((t) => t.eventId === eventId && t.name.toLowerCase() === name.trim().toLowerCase())
    )
      throw Error('Team name already exists for this event.');
    const team = {
      id: makeId(),
      eventId,
      name: name.trim(),
      managerId: null,
      handlerIds: [],
      memberIds: [],
    };
    setTeams((v) => [...v, team]);
    logAction('Team created', team.id, name.trim());
    return team.id;
  };
  const placeMember = (teamId, userId, remove = false) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw Error('Team not found.');
    if (team.managerId !== user?.id) requireEventPermission(team.eventId, 'manage_teams');
    const registered = registrations.some(
      (r) => r.eventId === team.eventId && r.userId === userId && r.status === 'Registered',
    );
    if (!remove && !registered) throw Error('Only registered participants can join an event team.');
    setTeams((v) =>
      v.map((t) =>
        t.id === teamId
          ? {
              ...t,
              memberIds: remove
                ? t.memberIds.filter((id) => id !== userId)
                : [...new Set([...t.memberIds, userId])],
              managerId: remove && t.managerId === userId ? null : t.managerId,
              handlerIds: remove ? t.handlerIds.filter((id) => id !== userId) : t.handlerIds,
            }
          : t,
      ),
    );
    logAction(remove ? 'Team member removed' : 'Team member assigned', teamId, userId);
  };
  const assignTeamRole = (teamId, userId, role, remove = false) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw Error('Team not found.');
    requireEventPermission(team.eventId, 'manage_teams');
    if (!team.memberIds.includes(userId)) throw Error('Assign the participant to the team first.');
    if (!['Manager', 'Handler'].includes(role)) throw Error('Invalid role.');
    setTeams((v) =>
      v.map((t) =>
        t.id !== teamId
          ? t
          : role === 'Manager'
            ? { ...t, managerId: remove ? (t.managerId === userId ? null : t.managerId) : userId }
            : {
                ...t,
                handlerIds: remove
                  ? t.handlerIds.filter((id) => id !== userId)
                  : [...new Set([...t.handlerIds, userId])],
              },
      ),
    );
    logAction(remove ? 'Team role removed' : 'Team role assigned', teamId, `${role}: ${userId}`);
  };
  const saveTask = (teamId, fields, taskId = null) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw Error('Team not found.');
    const event = getEvent(team.eventId);
    if (!(team.managerId === user?.id || canManageTeams(event)))
      throw Error('Task management is restricted to the Team Manager and authorized organizers.');
    if (!fields.title?.trim() || !fields.assigneeId || !fields.due)
      throw Error('Title, assignee, and due date are required.');
    if (!team.memberIds.includes(fields.assigneeId)) throw Error('Choose a member of this team.');
    if (taskId) {
      setTasks((v) =>
        v.map((t) =>
          t.id === taskId && t.teamId === teamId
            ? { ...t, ...fields, title: fields.title.trim() }
            : t,
        ),
      );
      return taskId;
    }
    const id = makeId();
    setTasks((v) => [
      ...v,
      {
        id,
        teamId,
        title: fields.title.trim(),
        description: fields.description || '',
        assigneeId: fields.assigneeId,
        due: fields.due,
        status: 'To Do',
      },
    ]);
    return id;
  };
  const updateTaskStatus = (taskId, status) => {
    const task = tasks.find((t) => t.id === taskId);
    const team = teams.find((t) => t.id === task?.teamId);
    if (!task || !team) throw Error('Task not found.');
    if (!['To Do', 'In Progress', 'Done'].includes(status)) throw Error('Invalid task status.');
    if (
      task.assigneeId !== user?.id &&
      team.managerId !== user?.id &&
      !canManageTeams(getEvent(team.eventId))
    )
      throw Error('You cannot update this task.');
    setTasks((v) => v.map((t) => (t.id === taskId ? { ...t, status } : t)));
  };
  const saveSchedule = (eventId, fields, id = null) => {
    requireEventPermission(eventId, 'manage_event_schedule');
    if (!fields.title?.trim() || !fields.startsAt || !fields.endsAt || !fields.venue?.trim())
      throw Error('Complete the schedule title, dates, and location.');
    if (new Date(fields.endsAt) <= new Date(fields.startsAt))
      throw Error('End time must be after start time.');
    const value = {
      eventId,
      title: fields.title.trim(),
      startsAt: fields.startsAt,
      endsAt: fields.endsAt,
      venue: fields.venue.trim(),
      description: fields.description || '',
    };
    if (id) {
      if (!schedules.some((s) => s.id === id && s.eventId === eventId))
        throw Error('Schedule item not found.');
      setSchedules((v) => v.map((s) => (s.id === id ? { ...s, ...value } : s)));
      logAction('Schedule changed', id);
      return id;
    }
    const next = makeId();
    setSchedules((v) => [...v, { ...value, id: next }]);
    logAction('Schedule created', next);
    return next;
  };
  const removeSchedule = (eventId, id) => {
    requireEventPermission(eventId, 'manage_event_schedule');
    if (!schedules.some((s) => s.id === id && s.eventId === eventId))
      throw Error('Schedule item not found.');
    setSchedules((v) => v.filter((s) => s.id !== id));
    logAction('Schedule removed', id);
  };
  const saveStream = (eventId, fields) => {
    requireEventPermission(eventId, 'manage_stream');
    if (fields.url && !/^https:\/\//i.test(fields.url))
      throw Error('Use a secure https stream URL.');
    setEvents((v) =>
      v.map((e) =>
        e.id === eventId
          ? {
              ...e,
              stream: {
                url: fields.url || '',
                provider: fields.provider || 'Other',
                status: fields.status || 'Scheduled',
                replayUrl: fields.replayUrl || '',
                scheduledAt: fields.scheduledAt || '',
              },
            }
          : e,
      ),
    );
    logAction('Stream settings changed', eventId);
  };
  const confirmParticipation = (eventId, userId, verified) => {
    requireEventPermission(eventId, 'manage_participation');
    if (
      !registrations.some(
        (r) => r.eventId === eventId && r.userId === userId && r.status === 'Registered',
      )
    )
      throw Error('Only registered participants can be verified.');
    setAttendance((v) => [
      ...v.filter((a) => !(a.eventId === eventId && a.userId === userId)),
      {
        id: makeId(),
        eventId,
        userId,
        verified,
        verifiedBy: user.id,
        verifiedAt: new Date().toISOString(),
      },
    ]);
    logAction(verified ? 'Participation confirmed' : 'Participation unconfirmed', eventId, userId);
  };
  const setCoOrganizer = (eventId, userId, permissions, remove = false) => {
    const event = getEvent(eventId);
    if (!canManageStaff(event))
      throw Error('Only the event owner or Admin can manage event staff.');
    if (userId === event.ownerId) throw Error('The event owner already manages this event.');
    if (!users.some((u) => u.id === userId)) throw Error('User not found.');
    setEvents((v) =>
      v.map((e) =>
        e.id === eventId
          ? {
              ...e,
              coOrganizers: remove
                ? (e.coOrganizers || []).filter((c) => c.userId !== userId)
                : [
                    ...(e.coOrganizers || []).filter((c) => c.userId !== userId),
                    { userId, permissions: [...new Set(permissions)] },
                  ],
            }
          : e,
      ),
    );
    logAction(remove ? 'Co-organizer removed' : 'Co-organizer updated', eventId, userId);
  };
  const reassignEventOwner = (eventId, userId) => {
    if (!hasRole(user, 'Admin')) throw Error('Admin permission required.');
    if (!users.some((u) => u.id === userId && hasRole(u, 'Organizer')))
      throw Error('New owner must be an active Organizer.');
    setEvents((v) => v.map((e) => (e.id === eventId ? { ...e, ownerId: userId } : e)));
    logAction('Event ownership reassigned', eventId, userId);
  };
  const generateJoinCode = (eventId) => {
    requireEventPermission(eventId, 'manage_teams');
    const code = makeId().replaceAll('-', '').slice(0, 8).toUpperCase();
    setJoinCodes((v) => [
      ...v.filter((c) => c.eventId !== eventId),
      { eventId, code, enabled: true },
    ]);
    logAction('Join code updated', eventId);
    return code;
  };
  const disableJoinCode = (eventId) => {
    requireEventPermission(eventId, 'manage_teams');
    setJoinCodes((v) => v.map((c) => (c.eventId === eventId ? { ...c, enabled: false } : c)));
    logAction('Join code disabled', eventId);
  };
  return {
    notify, login, signup, logout, editProfile, setOrganizerRole,
    canManageEvent: canManageEventFor,
    canManageRegistrations: canManageRegistrationsFor,
    saveEvent, count, isRegistered, getRegistrationEligibility, register, cancelRegistration,
    logAction, getEvent, requireEventPermission,
    canManageTeams, canManageSchedule, canManageStream, canManageParticipation, canManageStaff,
    createTeam, placeMember, assignTeamRole, saveTask, updateTaskStatus,
    saveSchedule, removeSchedule, saveStream, confirmParticipation,
    setCoOrganizer, reassignEventOwner, generateJoinCode, disableJoinCode,
  };
}

