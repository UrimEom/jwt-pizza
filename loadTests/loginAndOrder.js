import { sleep, group, check, fail } from 'k6';
import http from 'k6/http'
import jsonpath from 'https://jslib.k6.io/jsonpath/1.0.2/index.js'
import secrets from 'k6/secrets';

export const options = {
  cloud: {
    distribution: { 'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 } },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Imported_HAR: {
      executor: 'ramping-vus',
      gracefulStop: '30s',
      stages: [
        { target: 2, duration: '30s' },
        { target: 2, duration: '1m' },
        { target: 0, duration: '30s' },
      ],
      gracefulRampDown: '30s',
      exec: 'imported_HAR',
    },
  },
}

export async function imported_HAR() {
  const pizzaEmail = await secrets.get('pizza-email');
  const pizzaPassword = await secrets.get('pizza-password');
  let response

  const vars = {}

  group('page_1 - https://pizza.urim329.click/', function () {
    sleep(11.9)
    response = http.put(
      'https://pizza-service.urim329.click/api/auth',
      JSON.stringify({
        email: pizzaEmail,
        password: pizzaPassword,
      }),
      {
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          origin: 'https://pizza.urim329.click',
          priority: 'u=1, i',
          'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      }
    )
    if (!check(response, { 'first login status is 200': (r) => r.status === 200 })) {
      fail('First login failed');
    }
    vars['token1'] = jsonpath.query(response.json(), '$.token')[0]

    sleep(2)

    response = http.put(
      'https://pizza-service.urim329.click/api/auth',
      JSON.stringify({
        email: pizzaEmail,
        password: pizzaPassword,
      }),
      {
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          origin: 'https://pizza.urim329.click',
          priority: 'u=1, i',
          'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      }
    )

    if (!check(response, { 'login status is 200': (r) => r.status === 200 })) {
      fail('Login failed');
    }

    vars['token2'] = jsonpath.query(response.json(), '$.token')[0]

    sleep(9.2)

    response = http.get('https://pizza-service.urim329.click/api/order/menu', {
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
        authorization: `Bearer ${vars['token1']}`,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        origin: 'https://pizza.urim329.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
    })

    response = http.get(
      'https://pizza-service.urim329.click/api/franchise?page=0&limit=20&name=*',
      {
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
          authorization: `Bearer ${vars['token2']}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          origin: 'https://pizza.urim329.click',
          priority: 'u=1, i',
          'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      }
    )
    sleep(4.2)

    response = http.get('https://pizza-service.urim329.click/api/user/me', {
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
        authorization: `Bearer ${vars['token2']}`,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        origin: 'https://pizza.urim329.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
    })
    sleep(4)

    response = http.post(
      'https://pizza-service.urim329.click/api/order',
      '{"items":[{"menuId":3,"description":"Margarita","price":0.0042}],"storeId":"1","franchiseId":1}',
      {
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
          authorization: `Bearer ${vars['token2']}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          origin: 'https://pizza.urim329.click',
          priority: 'u=1, i',
          'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      }
    )

    if (!check(response, { 'purchase status is 200': (r) => r.status === 200 })) {
      fail('Pizza purchase failed');
    }
    const pizzaJwt = response.json('jwt');

    sleep(3.3)

    response = http.post(
      'https://pizza-factory.cs329.click/api/order/verify',
      JSON.stringify({ jwt: pizzaJwt }),
      {
        headers: {
          accept: '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
          authorization: `Bearer ${vars['token2']}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          origin: 'https://pizza.urim329.click',
          priority: 'u=1, i',
          'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'sec-fetch-storage-access': 'active',
        },
      }
    )
    if (!check(response, { 'pizza verification status is 200': (r) => r.status === 200 })) {
      fail('Pizza JWT verification failed');
    }
  })
}
