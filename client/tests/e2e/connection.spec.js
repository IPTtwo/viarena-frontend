import { test, expect } from '@playwright/test';

const password = 'BrowserPassword123';
const fillLogin = async (page, email) => {
  await page.goto('/login');
  await page.getByLabel('School email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
};

test('signup, cookie session refresh, profile editing and logout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Browser Participant');
  await page.getByLabel('School email').fill('browser@adnu.edu.ph');
  await page.getByLabel('Student ID', { exact: true }).fill('BROWSER-001');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  await page.reload();
  await page.goto('/profile/edit');
  await expect(page.getByLabel('Full name')).toHaveValue('Browser Participant');
  await page.getByLabel('Full name').fill('Updated Browser Participant');
  await page.getByLabel('About me').fill('Profile saved through the API');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Updated Browser Participant', exact: true }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'viarena_browser_test')?.httpOnly).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('viarena_p2_')),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test('organizer publishes an event; participant registers and cancels after reload', async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await fillLogin(page, 'organizer@adnu.edu.ph');
  await page.goto('/organizer/events/new');
  await page.getByLabel('Event title').fill('Browser Connected Tournament');
  await page
    .getByLabel('Description', { exact: true })
    .fill('A campus tournament connected to the backend.');
  await page.getByLabel('Venue', { exact: true }).fill('Campus Arena');
  await page.getByLabel('Starts', { exact: true }).fill('2035-06-15T09:00');
  await page.getByLabel('Ends', { exact: true }).fill('2035-06-15T17:00');
  await page.getByLabel('Registration deadline', { exact: true }).fill('2035-06-14T17:00');
  await page.getByRole('button', { name: 'Publish event', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Publish event', exact: true })
    .click();
  await expect(page).toHaveURL(/\/organizer\/events\/[a-f\d]{24}\/edit$/);
  const eventId = page.url().split('/').at(-2);
  await page.reload();
  await expect(page.getByLabel('Event title')).toHaveValue('Browser Connected Tournament');
  await expect(page.getByLabel('Starts', { exact: true })).toHaveValue('2035-06-15T09:00');
  const context = await browser.newContext();
  const participant = await context.newPage();
  participant.on('pageerror', (error) => errors.push(error.message));
  try {
    await context.request.post('http://127.0.0.1:5174/api/auth/signup', {
      data: {
        name: 'Event Participant',
        email: 'browser-event@adnu.edu.ph',
        studentId: 'BROWSER-EVENT',
        password,
      },
    });
    await fillLogin(participant, 'browser-event@adnu.edu.ph');
    await participant.goto(`/events/${eventId}/register`);
    await participant
      .getByRole('button', { name: 'Confirm Registration', exact: true })
      .click();
    await expect(participant).toHaveURL(/\/my-events$/);
    await participant.reload();
    await expect(
      participant.getByRole('heading', { name: 'Browser Connected Tournament', exact: true }),
    ).toBeVisible();
    await participant
      .getByRole('button', { name: /cancel/i })
      .first()
      .click();
    await participant
      .getByRole('dialog')
      .getByRole('button', { name: /cancel registration/i })
      .click();
    await expect(
      participant.getByRole('heading', { name: 'Browser Connected Tournament', exact: true }),
    ).toHaveCount(0);
    await participant.reload();
    await expect(
      participant.getByRole('heading', { name: 'Browser Connected Tournament', exact: true }),
    ).toHaveCount(0);
    await page.goto(`/organizer/events/${eventId}/registrations`);
    await expect(page.getByText('Event Participant', { exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
});

test('API outage displays a retryable connection error', async ({ page }) => {
  await page.route('**/api/workspace', (route) =>
    route.fulfill({ status: 503, json: { error: 'Backend unavailable' } }),
  );
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Unable to connect' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Backend unavailable');
  await page.unroute('**/api/workspace');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unable to connect' })).toHaveCount(0);
});

test('administrator supplies an audit reason when granting Organizer access', async ({
  page,
}) => {
  const response = await page.request.post('/api/auth/signup', {
    data: {
      name: 'Role Test Participant',
      email: 'role-test@adnu.edu.ph',
      studentId: 'ROLE-TEST-001',
      password,
    },
  });
  expect(response.status()).toBe(201);
  await fillLogin(page, 'organizer@adnu.edu.ph');
  await page.goto('/admin/users');
  const row = page.getByRole('row').filter({ hasText: 'role-test@adnu.edu.ph' });
  await row.getByRole('button', { name: 'Assign Organizer', exact: true }).click();
  await page
    .getByLabel('Reason for role change')
    .fill('Assigned tournament coordination duties');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Assign Organizer', exact: true })
    .click();
  await expect(
    row.getByRole('button', { name: 'Revoke Organizer', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    row.getByRole('button', { name: 'Revoke Organizer', exact: true }),
  ).toBeVisible();
});

test('production frontend has working route refreshes and API cookies', async ({ page }) => {
  const productionUrl = process.env.PRODUCTION_BASE_URL || 'http://127.0.0.1:5001';
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${productionUrl}/login`);
  await page.getByLabel('School email').fill('organizer@adnu.edu.ph');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(`${productionUrl}/events`);
  await page.goto(`${productionUrl}/profile`);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Browser Organizer', exact: true }),
  ).toBeVisible();
  const missing = await page.request.get(`${productionUrl}/api/not-an-endpoint`);
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: 'Route not found' });
  expect(errors).toEqual([]);
});
