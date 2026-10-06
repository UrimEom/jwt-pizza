import type { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';

async function basicInit(page: Page) {
  const diner = {
    id: 3,
    name: 'Kai Chen',
    email: 'd@jwt.com',
    roles: [{ role: 'diner' }],
  };

  let loggedIn = false;

  await page.route('**/api/auth', async (route) => {
    expect(route.request().method()).toBe('PUT');

    const body = route.request().postDataJSON();

    if (body.email !== diner.email || body.password !== 'a') {
      await route.fulfill({
        status: 401,
        json: { message: 'Unauthorized' },
      });
      return;
    }

    loggedIn = true;

    await route.fulfill({
      json: {
        user: diner,
        token: 'fake-test-token',
      },
    });
  });

  await page.route('**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');

    await route.fulfill({
      status: loggedIn ? 200 : 401,
      json: loggedIn ? diner : { message: 'Unauthorized' },
    });
  });

  await page.route('**/api/order/menu', async (route) => {
    expect(route.request().method()).toBe('GET');

    await route.fulfill({
      json: [
        {
          id: 1,
          title: 'Veggie',
          image: 'pizza1.png',
          price: 0.0038,
          description: 'A garden of delight',
        },
        {
          id: 2,
          title: 'Pepperoni',
          image: 'pizza2.png',
          price: 0.0042,
          description: 'Spicy treat',
        },
      ],
    });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');

    await route.fulfill({
      json: {
        franchises: [
          {
            id: 2,
            name: 'LotaPizza',
            stores: [
              { id: 4, name: 'Lehi' },
              { id: 5, name: 'Springville' },
              { id: 6, name: 'American Fork' },
            ],
          },
          {
            id: 3,
            name: 'PizzaCorp',
            stores: [{ id: 7, name: 'Spanish Fork' }],
          },
          {
            id: 4,
            name: 'topSpot',
            stores: [],
          },
        ],
        more: false,
      },
    });
  });

  await page.route('**/api/order', async (route) => {
    expect(route.request().method()).toBe('POST');

    const order = route.request().postDataJSON();

    expect(order.storeId).toBe('4');
    expect(Number(order.franchiseId)).toBe(2);
    expect(order.items).toHaveLength(2);

    expect(order.items).toEqual([
      expect.objectContaining({
        description: 'Veggie',
        price: 0.0038,
      }),
      expect.objectContaining({
        description: 'Pepperoni',
        price: 0.0042,
      }),
    ]);

    await route.fulfill({
      json: {
        order: { ...order, id: 23 },
        jwt: 'fake-order-jwt',
      },
    });
  });

  await page.goto('/');
}

test('home page', async ({ page }) => {
  await basicInit(page);

  await expect(page).toHaveTitle('JWT Pizza');
  await expect(
    page.getByRole('button', { name: 'Order now' })
  ).toBeVisible();
});

test('login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('d@jwt.com');
  await page.getByLabel('Password', { exact: true }).fill('a');
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(
    page.getByRole('link', { name: 'KC', exact: true })
  ).toBeVisible();
});

test('invalid login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('d@jwt.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(page.getByRole('main')).toContainText('Unauthorized');
  await expect(
    page.getByRole('link', { name: 'KC', exact: true })
  ).not.toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page.locator('h2'))
    .toContainText('Awesome is a click away');

  await page.getByRole('combobox').selectOption('4');

  await page.getByRole('link', {
    name: 'Image Description Veggie A',
  }).click();

  await page.getByRole('link', {
    name: 'Image Description Pepperoni',
  }).click();

  await expect(page.locator('form'))
    .toContainText('Selected pizzas: 2');

  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(page.getByRole('main'))
    .toContainText('Send me those 2 pizzas right now!');

  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByRole('main'))
    .toContainText('Here is your JWT Pizza!');

  await expect(page.getByRole('main')).toContainText('0.008 ₿');
});