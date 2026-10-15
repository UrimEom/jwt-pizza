import { test, expect } from './testSetup';

test('an admin can see user names, emails, and roles', async ({ page }) => {
  const admin = {
    id: 1,
    name: 'Ada Admin',
    email: 'admin@test.com',
    roles: [{ role: 'admin' }],
  };

  const users = [
    admin,
    {
      id: 2,
      name: 'Pizza Diner',
      email: 'diner@test.com',
      roles: [{ role: 'diner' }],
    },
    {
      id: 3,
      name: 'Franchise Owner',
      email: 'owner@test.com',
      roles: [{ role: 'franchisee', objectId: 2 }],
    },
  ];

  await page.addInitScript(() => {
    localStorage.setItem('token', 'admin-test-token');
  });

  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: admin });
  });

  // The existing admin dashboard also requests franchises.
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        franchises: [],
        more: false,
      },
    });
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers()['authorization'])
      .toBe('Bearer admin-test-token');

    await route.fulfill({
      json: {
        users,
        more: false,
      },
    });
  });

  await page.goto('/admin-dashboard');

  await expect(
    page.getByRole('heading', {
      name: 'Users',
      exact: true,
    })
  ).toBeVisible();

  // Give the new table aria-label="Users" when implementing it.
  const table = page.getByRole('table', {
    name: 'Users',
    exact: true,
  });

  await expect(table).toBeVisible();

  for (const user of users) {
    const row = table.getByRole('row').filter({
      has: page.getByRole('cell', {
        name: user.email,
        exact: true,
      }),
    });

    await expect(
      row.getByRole('cell', {
        name: user.name,
        exact: true,
      })
    ).toBeVisible();

    await expect(
      row.getByRole('cell', {
        name: user.email,
        exact: true,
      })
    ).toBeVisible();

    await expect(
      row.getByRole('cell', {
        name: user.roles[0].role,
        exact: true,
      })
    ).toBeVisible();
  }
});