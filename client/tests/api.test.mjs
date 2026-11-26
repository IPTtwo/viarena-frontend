import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/services/api.js';
import { normalizeWorkspace, eventPayload } from '../src/services/workspace.js';

test('base URL, credentials, JSON and request options are consistent', async () => {
  const controller = new AbortController();
  const api = createApiClient('http://localhost:5000/api///', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/events');
    assert.equal(options.credentials, 'include');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.headers.get('X-Request'), 'test');
    assert.equal(options.signal, controller.signal);
    assert.deepEqual(JSON.parse(options.body), { title: 'New event' });
    return Response.json({ event: { _id: 'server-id' } });
  });
  assert.deepEqual(
    await api('/events', {
      method: 'POST',
      credentials: 'omit',
      signal: controller.signal,
      headers: { 'X-Request': 'test' },
      body: { title: 'New event' },
    }),
    { event: { _id: 'server-id' } },
  );
});

test('validation and permission failures retain status and details', async () => {
  const details = { fieldErrors: { name: ['Required'] } };
  const api = createApiClient('/api', async () =>
    Response.json({ error: 'Validation failed', details }, { status: 400 }),
  );
  await assert.rejects(
    api('/users/me'),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.details.fieldErrors.name[0] === 'Required',
  );
});

test('empty, invalid JSON, network and aborted responses are handled', async () => {
  assert.equal(
    await createApiClient(
      '/api',
      async () => new Response(null, { status: 204 }),
    )('/auth/logout'),
    null,
  );
  await assert.rejects(
    createApiClient(
      '/api',
      async () => new Response('<html>Unavailable</html>', { status: 502 }),
    )('/events'),
    (error) => error.status === 502 && !error.message.includes('<html>'),
  );
  await assert.rejects(
    createApiClient('/api', async () => {
      throw new TypeError('Failed to fetch');
    })('/events'),
    (error) => error.status === 0,
  );
  await assert.rejects(
    createApiClient('/api', async () => {
      throw new DOMException('Aborted', 'AbortError');
    })('/events'),
    { name: 'AbortError' },
  );
  await assert.rejects(createApiClient('/api')('https://example.com'), TypeError);
});

test('FormData keeps its browser-generated multipart content type', async () => {
  const body = new FormData();
  body.set('file', 'value');
  await createApiClient('/api', async (_url, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers.has('Content-Type'), false);
    return Response.json({});
  })('/upload', { method: 'POST', body });
});

test('workspace normalizes MongoDB IDs, dates, cancellations and role logs', () => {
  const data = normalizeWorkspace({
    user: { id: 'user', name: 'Member' },
    users: [{ _id: 'user' }],
    events: [
      {
        _id: 'event',
        registeredCount: 7,
        start: '2030-01-01T12:00:00Z',
        end: '2030-01-01T14:00:00Z',
        deadline: '2029-12-31T12:00:00Z',
      },
    ],
    registrations: [{ _id: 'registration', status: 'Cancelled' }],
    teams: [],
    tasks: [],
    schedules: [],
    attendance: [],
    joinCodes: [],
    logs: [
      {
        _id: 'log',
        action: 'role.organizer.grant',
        actorId: { _id: 'admin', name: 'Admin' },
        details: { previousRoles: ['Participant'], nextRoles: ['Participant', 'Organizer'] },
      },
    ],
  });
  assert.equal(data.events[0].id, 'event');
  assert.equal(data.events[0].registeredCount, 7);
  assert.equal(new Date(data.events[0].start).toISOString(), '2030-01-01T12:00:00.000Z');
  assert.equal(data.registrations[0].status, 'Canceled');
  assert.equal(data.users[0].name, 'Member');
  assert.equal(data.roleAudit[0].actorName, 'Admin');
});

test('event writes contain only editable fields and serialize dates with a timezone', () => {
  const payload = eventPayload({
    title: ' Event ',
    venue: ' Hall ',
    category: 'Esports',
    start: '2030-01-01T12:00',
    end: '2030-01-01T14:00',
    deadline: '2029-12-31T12:00',
    capacity: '10',
    ownerId: 'forged',
    registeredCount: 100,
    roles: ['Admin'],
  });
  assert.equal(payload.capacity, 10);
  assert.equal(payload.ownerId, undefined);
  assert.equal(payload.registeredCount, undefined);
  assert.equal(payload.roles, undefined);
  assert.match(payload.start, /Z$/);
});
