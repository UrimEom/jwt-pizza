import type { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';

type User = {
  id: number;
  name: string;
  email: string;
  roles: { role: string; objectId?: number }[];
};

type Store = {
  id: number;
  name: string;
  totalRevenue: number;
};

type Franchise = {
  id: number;
  name: string;
  admins: { id: number; name: string; email: string }[];
  stores: Store[];
};

const accounts: Record<string, User> = {
  diner: {
    id: 3,
    name: 'Kai Chen',
    email: 'd@jwt.com',
    roles: [{ role: 'diner' }],
  },
  admin: {
    id: 1,
    name: 'Ada Admin',
    email: 'admin@jwt.com',
    roles: [{ role: 'admin' }],
  },
  owner: {
    id: 2,
    name: 'Fran Owner',
    email: 'owner@jwt.com',
    roles: [
      { role: 'diner' },
      { role: 'franchisee', objectId: 2 },
    ],
  },
};

async function setup(
  page: Page,
  options: {
    emptyOrders?: boolean;
    registrationError?: boolean;
  } = {}
) {
  let user: User | null = null;

  let franchises: Franchise[] = [
    {
      id: 2,
      name: 'LotaPizza',
      admins: [
        { id: 2, name: 'Fran Owner', email: 'owner@jwt.com' },
      ],
      stores: [
        { id: 4, name: 'Lehi', totalRevenue: 0.008 },
        { id: 5, name: 'Springville', totalRevenue: 0 },
      ],
    },
    {
      id: 3,
      name: 'PizzaCorp',
      admins: [],
      stores: [],
    },
    {
      id: 4,
      name: 'TopSpot',
      admins: [],
      stores: [],
    },
    {
      id: 5,
      name: 'MountainPizza',
      admins: [],
      stores: [],
    },
  ];

  const calls = {
    registrations: 0,
    logouts: 0,
    createdFranchises: 0,
    deletedFranchises: 0,
    createdStores: 0,
    deletedStores: 0,
  };

  const unexpectedRequests: string[] = [];

  // One dispatcher handles every API request for these tests.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/user' && method === 'GET') {
       await route.fulfill({
          json: {
          users: [],
          more: false,
          },
       });
       return;
    }

    if (path === '/api/auth') {
      if (method === 'DELETE') {
        user = null;
        calls.logouts++;

        await route.fulfill({
          json: { message: 'logout successful' },
        });
        return;
      }

      if (method === 'POST') {
        const body = request.postDataJSON();
        calls.registrations++;

        expect(body).toEqual({
          name: 'New Diner',
          email: 'new@jwt.com',
          password: 'test-password',
        });

        if (options.registrationError) {
          await route.fulfill({
            status: 409,
            json: { message: 'Email already registered' },
          });
          return;
        }

        user = {
          id: 10,
          name: body.name,
          email: body.email,
          roles: [{ role: 'diner' }],
        };

        await route.fulfill({
          json: { user, token: 'fake-registration-token' },
        });
        return;
      }

      if (method === 'PUT') {
        const body = request.postDataJSON();

        const match = Object.values(accounts).find(
          (account) => account.email === body.email
        );

        if (!match || body.password !== 'a') {
          await route.fulfill({
            status: 401,
            json: { message: 'Unauthorized' },
          });
          return;
        }

        user = match;

        await route.fulfill({
          json: { user, token: 'fake-login-token' },
        });
        return;
      }
    }

    if (path === '/api/user/me' && method === 'GET') {
      await route.fulfill({
        status: user ? 200 : 401,
        json: user ?? { message: 'Unauthorized' },
      });
      return;
    }

    if (path === '/api/order/menu' && method === 'GET') {
      await route.fulfill({
        json: [
          {
            id: 1,
            title: 'Veggie',
            image: 'pizza1.png',
            price: 0.0038,
            description: 'A garden of delight',
          },
        ],
      });
      return;
    }

    if (path === '/api/order' && method === 'GET') {
      await route.fulfill({
        json: {
          dinerId: user?.id,
          orders: options.emptyOrders
            ? []
            : [
                {
                  id: 23,
                  franchiseId: 2,
                  storeId: '4',
                  date: '2026-10-01',
                  items: [
                    {
                      menuId: 1,
                      description: 'Veggie',
                      price: 0.0038,
                    },
                  ],
                },
              ],
        },
      });
      return;
    }

    if (path === '/api/franchise' && method === 'GET') {
      const filter = (url.searchParams.get('name') ?? '*')
        .replace(/\*/g, '')
        .toLowerCase();

      const pageNumber = Number(url.searchParams.get('page') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 10);

      const matches = franchises.filter((franchise) =>
        franchise.name.toLowerCase().includes(filter)
      );

      const start = pageNumber * limit;

      await route.fulfill({
        json: {
          franchises: matches.slice(start, start + limit),
          more: start + limit < matches.length,
        },
      });
      return;
    }

    if (path === '/api/franchise' && method === 'POST') {
      const body = request.postDataJSON();

      expect(body.name).toBe('TestPizza');
      expect(body.admins).toEqual([{ email: 'owner@jwt.com' }]);

      const franchise: Franchise = {
        id: 100,
        name: body.name,
        admins: [
          { id: 2, name: 'Fran Owner', email: 'owner@jwt.com' },
        ],
        stores: [],
      };

      franchises.unshift(franchise);
      calls.createdFranchises++;

      await route.fulfill({ json: franchise });
      return;
    }

    const franchiseMatch = path.match(/^\/api\/franchise\/(\d+)$/);

    if (franchiseMatch && method === 'GET') {
      // This GET endpoint takes the user's ID.
      const userId = Number(franchiseMatch[1]);

      await route.fulfill({
        json:
          userId === accounts.owner.id
            ? franchises.filter((franchise) => franchise.id === 2)
            : [],
      });
      return;
    }

    if (franchiseMatch && method === 'DELETE') {
      const franchiseId = Number(franchiseMatch[1]);

      expect(franchiseId).toBe(100);

      franchises = franchises.filter(
        (franchise) => franchise.id !== franchiseId
      );
      calls.deletedFranchises++;

      await route.fulfill({
        json: { message: 'franchise closed' },
      });
      return;
    }

    const createStoreMatch = path.match(
      /^\/api\/franchise\/(\d+)\/store$/
    );

    if (createStoreMatch && method === 'POST') {
      const franchiseId = Number(createStoreMatch[1]);
      const body = request.postDataJSON();

      expect(franchiseId).toBe(2);
      expect(body.name).toBe('Logan');

      const franchise = franchises.find(
        (item) => item.id === franchiseId
      );

      expect(franchise).toBeDefined();

      const store = {
        id: 100,
        name: body.name,
        totalRevenue: 0,
      };

      franchise!.stores.push(store);
      calls.createdStores++;

      await route.fulfill({ json: store });
      return;
    }

    const deleteStoreMatch = path.match(
      /^\/api\/franchise\/(\d+)\/store\/(\d+)$/
    );

    if (deleteStoreMatch && method === 'DELETE') {
      const franchiseId = Number(deleteStoreMatch[1]);
      const storeId = Number(deleteStoreMatch[2]);

      const franchise = franchises.find(
        (item) => item.id === franchiseId
      );

      expect(franchise).toBeDefined();

      franchise!.stores = franchise!.stores.filter(
        (store) => store.id !== storeId
      );

      calls.deletedStores++;

      await route.fulfill({
        json: { message: 'store closed' },
      });
      return;
    }

    if (path === '/api/docs' && method === 'GET') {
      await route.fulfill({
        json: {
          endpoints: [
            {
              requiresAuth: false,
              method: 'GET',
              path: '/api/order/menu',
              description: 'Read the pizza menu',
              example: 'GET /api/order/menu',
              response: [],
            },
            {
              requiresAuth: true,
              method: 'POST',
              path: '/api/order',
              description: 'Submit a pizza order',
              example: 'POST /api/order',
              response: { order: { id: 23 } },
            },
          ],
        },
      });
      return;
    }

    unexpectedRequests.push(`${method} ${path}`);

    await route.fulfill({
      status: 501,
      json: { message: `Missing mock: ${method} ${path}` },
    });
  });

  await page.goto('/');

  return {
    calls,
    assertMocks: () => {
      expect(
        unexpectedRequests,
        'Unexpected API requests'
      ).toEqual([]);
    },
  };
}

async function login(
  page: Page,
  role: 'diner' | 'admin' | 'owner'
) {
  await page.getByRole('link', {
    name: 'Login',
    exact: true,
  }).click();

  await page.getByPlaceholder('Email address')
    .fill(accounts[role].email);

  await page.getByPlaceholder('Password').fill('a');

  await page.getByRole('button', {
    name: 'Login',
    exact: true,
  }).click();

  await expect(
    page.getByRole('link', { name: 'Logout', exact: true })
  ).toBeVisible();
}

async function fillRegistration(page: Page) {
  await page.getByRole('link', {
    name: 'Register',
    exact: true,
  }).click();

  await page.getByPlaceholder('Full name').fill('New Diner');
  await page.getByPlaceholder('Email address').fill('new@jwt.com');
  await page.getByPlaceholder('Password').fill('test-password');

  await page.getByRole('button', {
    name: 'Register',
    exact: true,
  }).click();
}

test('extended: register a new diner', async ({ page }) => {
  const mock = await setup(page);

  await fillRegistration(page);

  await expect(
    page.getByRole('link', { name: 'ND', exact: true })
  ).toBeVisible();

  expect(mock.calls.registrations).toBe(1);
  mock.assertMocks();
});

test('extended: registration error', async ({ page }) => {
  const mock = await setup(page, { registrationError: true });

  await fillRegistration(page);

  await expect(page.getByRole('main'))
    .toContainText('Email already registered');

  expect(mock.calls.registrations).toBe(1);
  mock.assertMocks();
});

test('extended: logout', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'diner');

  await page.getByRole('link', {
    name: 'Logout',
    exact: true,
  }).click();

  await expect(
    page.getByRole('link', { name: 'Login', exact: true })
  ).toBeVisible();

  await expect.poll(() => mock.calls.logouts).toBe(1);

  expect(
    await page.evaluate(() => localStorage.getItem('token'))
  ).toBeNull();

  mock.assertMocks();
});

test('extended: diner order history', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'diner');

  await page.getByRole('link', { name: 'KC', exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Kai Chen');
  await expect(page.getByRole('main')).toContainText('d@jwt.com');
  await expect(page.locator('tbody')).toContainText('23');
  await expect(page.locator('tbody')).toContainText('0.004 ₿');

  mock.assertMocks();
});

test('extended: empty order history', async ({ page }) => {
  const mock = await setup(page, { emptyOrders: true });
  await login(page, 'diner');

  await page.getByRole('link', { name: 'KC', exact: true }).click();

  await expect(page.getByRole('main'))
    .toContainText('How have you lived this long without having a pizza?');

  await page.getByRole('link', {
    name: 'Buy one',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/menu$/);
  await expect(
    page.getByRole('button', { name: 'Checkout', exact: true })
  ).toBeDisabled();

  mock.assertMocks();
});

for (const [path, title] of [
  ['/about', 'The secret sauce'],
  ['/history', 'Mama Rucci, my my'],
  ['/missing-page', 'Oops'],
  ['/franchise-dashboard', 'So you want a piece of the pie?'],
]) {
  test(`extended: public page ${path}`, async ({ page }) => {
    const mock = await setup(page);
    await page.goto(path);

    await expect(
      page.getByRole('heading', { name: title, exact: true })
    ).toBeVisible();

    mock.assertMocks();
  });
}

for (const type of ['service', 'factory']) {
  test(`extended: ${type} docs`, async ({ page }) => {
    const mock = await setup(page);
    await page.goto(`/docs/${type}`);

    await expect(page.getByRole('main'))
      .toContainText('Read the pizza menu');

    await expect(page.getByRole('main'))
      .toContainText('Submit a pizza order');

    await expect(page.getByRole('main'))
      .toContainText('/api/order/menu');

    mock.assertMocks();
  });
}

test('extended: admin pagination and filtering', async ({ page }) => {
   const mock = await setup(page);
   await login(page, 'admin');
 
   await page.getByRole('link', {
     name: 'Admin',
     exact: true,
   }).click();
 
   await expect(page.getByRole('main'))
     .toContainText("Mama Ricci's kitchen");
 
   const franchiseTable = page.getByRole('table', {
     name: 'Franchises',
     exact: true,
   });
 
   const franchiseBodies = franchiseTable.locator('tbody');
 
   await expect(franchiseBodies).toHaveCount(3);
 
   await franchiseTable.getByRole('button', {
     name: '»',
     exact: true,
   }).click();
 
   await expect(franchiseBodies).toHaveCount(1);
   await expect(franchiseBodies).toContainText('MountainPizza');
 
   await franchiseTable.getByRole('button', {
     name: '«',
     exact: true,
   }).click();
 
   await expect(franchiseBodies).toHaveCount(3);
 
   await franchiseTable
     .getByPlaceholder('Filter franchises')
     .fill('Lota');
 
   await franchiseTable.getByRole('button', {
     name: 'Submit',
     exact: true,
   }).click();
 
   await expect(franchiseBodies).toHaveCount(1);
   await expect(franchiseBodies).toContainText('LotaPizza');
 
   mock.assertMocks();
});

test('extended: create and close franchise', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'admin');

  await page.getByRole('link', {
    name: 'Admin',
    exact: true,
  }).click();

  await page.getByRole('button', { name: 'Add Franchise' }).click();

  await page.getByPlaceholder('franchise name').fill('TestPizza');
  await page.getByPlaceholder('franchisee admin email')
    .fill('owner@jwt.com');

  await page.getByRole('button', {
    name: 'Create',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);

  const row = page.getByRole('row').filter({ hasText: 'TestPizza' });
  await expect(row).toBeVisible();

  expect(mock.calls.createdFranchises).toBe(1);

  await row.getByRole('button', {
    name: 'Close',
    exact: true,
  }).click();

  await expect(page.getByRole('main'))
    .toContainText('Are you sure you want to close');

  await page.getByRole('button', {
    name: 'Close',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);

  await expect(
    page.getByRole('cell', { name: 'TestPizza', exact: true })
  ).toHaveCount(0);

  expect(mock.calls.deletedFranchises).toBe(1);
  mock.assertMocks();
});

test('extended: cancel franchise creation', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'admin');

  await page.getByRole('link', {
    name: 'Admin',
    exact: true,
  }).click();

  await page.getByRole('button', { name: 'Add Franchise' }).click();

  await page.getByRole('button', {
    name: 'Cancel',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);
  expect(mock.calls.createdFranchises).toBe(0);

  mock.assertMocks();
});

test('extended: admin closes a store', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'admin');

  await page.getByRole('link', {
    name: 'Admin',
    exact: true,
  }).click();

  await page.getByRole('row')
    .filter({ hasText: 'Lehi' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();

  await expect(page.getByRole('main')).toContainText('Lehi');

  await page.getByRole('button', {
    name: 'Close',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/admin-dashboard$/);

  await expect(
    page.getByRole('cell', { name: 'Lehi', exact: true })
  ).toHaveCount(0);

  expect(mock.calls.deletedStores).toBe(1);
  mock.assertMocks();
});

test('extended: owner creates and closes store', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'owner');

  await page.goto('/franchise-dashboard');

  await expect(
    page.getByRole('heading', { name: 'LotaPizza', exact: true })
  ).toBeVisible();

  await expect(page.locator('tbody')).toContainText('Lehi');

  await page.getByRole('button', {
    name: 'Create store',
    exact: true,
  }).click();

  await page.getByPlaceholder('store name').fill('Logan');

  await page.getByRole('button', {
    name: 'Create',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);

  const row = page.getByRole('row').filter({ hasText: 'Logan' });
  await expect(row).toBeVisible();

  expect(mock.calls.createdStores).toBe(1);

  await row.getByRole('button', {
    name: 'Close',
    exact: true,
  }).click();

  await page.getByRole('button', {
    name: 'Close',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);

  await expect(
    page.getByRole('cell', { name: 'Logan', exact: true })
  ).toHaveCount(0);

  expect(mock.calls.deletedStores).toBe(1);
  mock.assertMocks();
});

test('extended: cancel closing a store', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'owner');

  await page.goto('/franchise-dashboard');

  await page.getByRole('row')
    .filter({ hasText: 'Lehi' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();

  await page.getByRole('button', {
    name: 'Cancel',
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/franchise-dashboard$/);

  await expect(
    page.getByRole('cell', { name: 'Lehi', exact: true })
  ).toBeVisible();

  expect(mock.calls.deletedStores).toBe(0);
  mock.assertMocks();
});

test('extended: franchise owner profile', async ({ page }) => {
  const mock = await setup(page);
  await login(page, 'owner');

  await page.getByRole('link', { name: 'FO', exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Fran Owner');
  await expect(page.getByRole('main')).toContainText('diner');
  await expect(page.getByRole('main')).toContainText('Franchisee on 2');

  mock.assertMocks();
});