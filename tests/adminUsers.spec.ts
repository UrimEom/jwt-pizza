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

test('an admin can paginate and filter users', async ({ page }) => {
   const admin = {
     id: 1,
     name: 'Ada Admin',
     email: 'admin@test.com',
     roles: [{ role: 'admin' }],
   };
 
   // Eleven matching users produce two pages with a page size of ten.
   const users = Array.from({ length: 11 }, (_, index) => ({
     id: index + 2,
     name: `Pizza Diner ${index + 1}`,
     email: `diner${index + 1}@test.com`,
     roles: [{ role: 'diner' }],
   }));
 
   await page.addInitScript(() => {
     localStorage.setItem('token', 'admin-test-token');
   });
 
   await page.route('**/api/user/me', async (route) => {
     await route.fulfill({ json: admin });
   });
 
   await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
     await route.fulfill({
       json: {
         franchises: [],
         more: false,
       },
     });
   });
 
   await page.route(/\/api\/user(\?.*)?$/, async (route) => {
     const url = new URL(route.request().url());
     const currentPage = Number(url.searchParams.get('page') ?? 1);
     const limit = Number(url.searchParams.get('limit') ?? 10);
     const name = url.searchParams.get('name') ?? '*';
 
     expect(route.request().method()).toBe('GET');
     expect(currentPage).toBeGreaterThanOrEqual(1);
     expect(limit).toBe(10);
 
     const search = name.replace(/\*/g, '').toLowerCase();
     const matchingUsers = users.filter((user) =>
       user.name.toLowerCase().includes(search)
     );
 
     const offset = (currentPage - 1) * limit;
 
     await route.fulfill({
       json: {
         users: matchingUsers.slice(offset, offset + limit),
         more: offset + limit < matchingUsers.length,
       },
     });
   });
 
   await page.goto('/admin-dashboard');
 
   const table = page.getByRole('table', {
     name: 'Users',
     exact: true,
   });
 
   const rows = table.locator('tbody tr');
 
   const previous = page.getByRole('button', {
     name: 'Previous users',
     exact: true,
   });
 
   const next = page.getByRole('button', {
     name: 'Next users',
     exact: true,
   });
 
   const filter = page.getByRole('textbox', {
     name: 'Filter users',
     exact: true,
   });
 
   const applyFilter = page.getByRole('button', {
     name: 'Filter users',
     exact: true,
   });
 
   // First page.
   await expect(rows).toHaveCount(10);
   await expect(previous).toBeDisabled();
   await expect(next).toBeEnabled();
 
   // Second page.
   await next.click();
 
   await expect(rows).toHaveCount(1);
   await expect(table).toContainText('diner11@test.com');
   await expect(previous).toBeEnabled();
   await expect(next).toBeDisabled();
 
   // Return to the first page.
   await previous.click();
 
   await expect(rows).toHaveCount(10);
   await expect(previous).toBeDisabled();
 
   // Changing the filter while on page two must reset to page one.
   await next.click();
   await expect(table).toContainText('diner11@test.com');
 
   await filter.fill('Pizza Diner 2');
   await applyFilter.click();
 
   await expect(rows).toHaveCount(1);
   await expect(table).toContainText('diner2@test.com');
   await expect(previous).toBeDisabled();
   await expect(next).toBeDisabled();
 
   // A filter must stay active when navigating pages.
   await filter.fill('Pizza');
   await applyFilter.click();
 
   await expect(rows).toHaveCount(10);
 
   const filteredPageRequest = page.waitForRequest((request) => {
     const url = new URL(request.url());
 
     return (
       request.method() === 'GET' &&
       url.pathname === '/api/user' &&
       url.searchParams.get('page') === '2' &&
       url.searchParams.get('name') === '*Pizza*'
     );
   });
 
   await next.click();
   await filteredPageRequest;
 
   await expect(rows).toHaveCount(1);
   await expect(table).toContainText('diner11@test.com');
 
   // A filter with no matches displays the empty-state message.
   await filter.fill('NobodyMatches');
   await applyFilter.click();
 
   await expect(table).toContainText('No users found.');
   await expect(previous).toBeDisabled();
   await expect(next).toBeDisabled();
 
   // Clearing the filter restores the first page.
   await filter.fill('');
   await applyFilter.click();
 
   await expect(rows).toHaveCount(10);
   await expect(previous).toBeDisabled();
   await expect(next).toBeEnabled();
});

test('an admin can delete a user', async ({ page }) => {
   const admin = {
     id: 1,
     name: 'Ada Admin',
     email: 'admin@test.com',
     roles: [{ role: 'admin' }],
   };
 
   const diner = {
     id: 3,
     name: 'Disposable Diner',
     email: 'delete@test.com',
     roles: [{ role: 'diner' }],
   };
 
   let users = [admin, diner];
   let deleteReceived = false;
 
   await page.addInitScript(() => {
     localStorage.setItem('token', 'test-token');
   });
 
   await page.route('**/api/user/me', async (route) => {
     await route.fulfill({ json: admin });
   });
 
   await page.route(/\/api\/franchise(?:\?.*)?$/, async (route) => {
     await route.fulfill({
       json: {
         franchises: [],
         more: false,
       },
     });
   });
 
   await page.route(/\/api\/user(?:\?.*)?$/, async (route) => {
     await route.fulfill({
       json: {
         users,
         more: false,
       },
     });
   });
 
   await page.route('**/api/user/3', async (route) => {
     expect(route.request().method()).toBe('DELETE');
     expect(route.request().headers().authorization)
       .toBe('Bearer test-token');
 
     deleteReceived = true;
     users = users.filter((user) => user.id !== diner.id);
 
     await route.fulfill({
       json: { message: 'user deleted' },
     });
   });
 
   await page.goto('/admin-dashboard');
 
   const usersTable = page.getByRole('table', {
     name: 'Users',
     exact: true,
   });
 
   const dinerRow = usersTable.getByRole('row').filter({
     has: page.getByRole('cell', {
       name: diner.email,
       exact: true,
     }),
   });
 
   await expect(dinerRow).toBeVisible();
 
   await dinerRow.getByRole('button', {
     name: 'Delete',
     exact: true,
   }).click();
 
   await expect(dinerRow).toHaveCount(0);
   expect(deleteReceived).toBe(true);
 
   // Deleting the diner must preserve the admin.
   await expect(
     usersTable.getByRole('cell', {
       name: admin.email,
       exact: true,
     })
   ).toBeVisible();
 
   // The updated list should still exclude the deleted diner after reload.
   await page.reload();
 
   await expect(
     usersTable.getByRole('cell', {
       name: admin.email,
       exact: true,
     })
   ).toBeVisible();
 
   await expect(dinerRow).toHaveCount(0);
});