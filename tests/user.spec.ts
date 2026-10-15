import { test, expect } from './testSetup';

for (const role of ['diner', 'admin', 'franchisee']) {
  test(`a ${role} can update their name`, async ({ page }) => {
    let user = {
      id: 3,
      name: 'Pizza Diner',
      email: 'diner@test.com',
      roles: [
        role === 'franchisee'
          ? { role, objectId: 2 }
          : { role },
      ],
    };

    // Start with a simulated authenticated session.
    await page.addInitScript(() => {
      if (!localStorage.getItem('token')) {
        localStorage.setItem('token', 'test-token');
      }
    });

    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({ json: user });
    });

    await page.route('**/api/order', async (route) => {
      await route.fulfill({
        json: {
          dinerId: user.id,
          orders: [],
        },
      });
    });

    await page.route('**/api/user/3', async (route) => {
      expect(route.request().method()).toBe('PUT');

      const changes = route.request().postDataJSON();

      expect(changes.name).toBe('Updated Diner');
      expect(changes.roles).toEqual(user.roles);

      // A blank password field should omit the password.
      expect(changes).not.toHaveProperty('password');

      user = {
        ...user,
        name: changes.name,
        email: changes.email,
      };

      await route.fulfill({
        json: {
          user,
          token: 'updated-test-token',
        },
      });
    });

    await page.goto('/diner-dashboard');

    await expect(page.getByRole('main')).toContainText('Pizza Diner');

    await page.getByRole('button', {
      name: 'Edit',
      exact: true,
    }).click();

    const dialog = page.getByRole('dialog', {
      name: 'Edit user',
    });

    await expect(dialog).toBeVisible();

    await dialog
      .getByLabel('Name', { exact: true })
      .fill('Updated Diner');

    await dialog.getByRole('button', {
      name: 'Update',
      exact: true,
    }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('main')).toContainText('Updated Diner');

    // Verify that the frontend saved the replacement token.
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem('token'))
      )
      .toBe('updated-test-token');
  });
}

test('a diner can update their email and password', async ({ page }) => {
  let user = {
    id: 3,
    name: 'Pizza Diner',
    email: 'diner@test.com',
    roles: [{ role: 'diner' }],
  };

  let savedPassword = 'old-password';
  let updateReceived = false;

  await page.addInitScript(() => {
    // Preserve the replacement token when the page reloads.
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'test-token');
    }
  });

  await page.route('**/api/user/me', async (route) => {
    await route.fulfill({ json: user });
  });

  await page.route('**/api/order', async (route) => {
    await route.fulfill({
      json: {
        dinerId: user.id,
        orders: [],
      },
    });
  });

  await page.route('**/api/user/3', async (route) => {
    expect(route.request().method()).toBe('PUT');

    const changes = route.request().postDataJSON();

    expect(changes.email).toBe('updated@test.com');
    expect(changes.password).toBe('new-password');
    expect(changes.roles).toEqual(user.roles);

    user = {
      ...user,
      name: changes.name,
      email: changes.email,
    };

    savedPassword = changes.password;
    updateReceived = true;

    await route.fulfill({
      json: {
        user,
        token: 'updated-test-token',
      },
    });
  });

  await page.goto('/diner-dashboard');

  await expect(page.getByRole('main')).toContainText('diner@test.com');

  await page.getByRole('button', {
    name: 'Edit',
    exact: true,
  }).click();

  const dialog = page.getByRole('dialog', {
    name: 'Edit user',
  });

  await expect(dialog).toBeVisible();

  await dialog
    .getByLabel('Email', { exact: true })
    .fill('updated@test.com');

  await dialog
    .getByLabel('Password', { exact: true })
    .fill('new-password');

  await dialog.getByRole('button', {
    name: 'Update',
    exact: true,
  }).click();

  await expect(dialog).toBeHidden();

  expect(updateReceived).toBe(true);
  expect(savedPassword).toBe('new-password');

  await expect(page.getByRole('main')).toContainText('updated@test.com');

  // Verify that reloading retrieves the updated mock user.
  await page.reload();

  await expect(page.getByRole('main')).toContainText('updated@test.com');

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('token'))
    )
    .toBe('updated-test-token');
});