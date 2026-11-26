import { test, expect } from '@playwright/test';

test('separate frontend production server proxies cookie sessions and route refreshes', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5175/login');
  await page.getByLabel('School email').fill('organizer@adnu.edu.ph');
  await page.getByLabel('Password', { exact: true }).fill('BrowserPassword123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5175/events');
  await page.goto('http://127.0.0.1:5175/profile');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Browser Organizer', exact: true }),
  ).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.httpOnly)).toBe(true);
  const missing = await page.request.get('http://127.0.0.1:5175/api/not-an-endpoint');
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: 'Route not found' });
  expect(errors).toEqual([]);
});
