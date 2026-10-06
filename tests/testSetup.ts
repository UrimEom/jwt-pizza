import { test as base, expect } from 'playwright-test-coverage';

const test = base.extend({
  page: async ({ page }, use) => {
    const unexpectedRequests: string[] = [];

    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname.startsWith('/api/')) {
        unexpectedRequests.push(
          `${request.method()} ${request.url()}`
        );

        await route.abort();
        return;
      }

      if (
        request.resourceType() === 'image' &&
        !['localhost', '127.0.0.1'].includes(url.hostname)
      ) {
        await route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        });
        return;
      }

      await route.continue();
    });

    await use(page);

    expect(
      unexpectedRequests,
      'Every API request must have a mock'
    ).toEqual([]);
  },
});

export { test, expect };