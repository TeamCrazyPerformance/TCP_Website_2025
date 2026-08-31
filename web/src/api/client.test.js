function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(payload == null ? '' : JSON.stringify(payload)),
  };
}

describe('API client session handling', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('로그인 요청에 refresh-token 쿠키를 받을 수 있는 credentials 옵션을 포함한다', async () => {
    global.fetch.mockResolvedValue(
      response(200, { access_token: 'access-token', user: { id: 'member-1' } }),
    );
    const { apiPost } = require('./client');

    await apiPost('/api/v1/auth/login', {
      username: 'member',
      password: 'password',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/login'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  test('동시 401 요청은 refresh를 한 번만 수행하고 모두 JSON 결과로 재시도한다', async () => {
    localStorage.setItem('access_token', 'expired-token');
    global.fetch.mockImplementation((url, config = {}) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        return Promise.resolve(response(200, { access_token: 'fresh-token' }));
      }
      if (config.headers?.Authorization === 'Bearer fresh-token') {
        return Promise.resolve(response(200, { path: new URL(url).pathname }));
      }
      return Promise.resolve(response(401, { message: 'expired' }));
    });
    const { apiGet } = require('./client');

    const [first, second] = await Promise.all([
      apiGet('/api/v1/first'),
      apiGet('/api/v1/second'),
    ]);

    expect(first).toEqual({ path: '/api/v1/first' });
    expect(second).toEqual({ path: '/api/v1/second' });
    expect(
      global.fetch.mock.calls.filter(([url]) =>
        url.endsWith('/api/v1/auth/refresh'),
      ),
    ).toHaveLength(1);
    expect(global.fetch.mock.calls.every(([, config]) => config.credentials === 'include')).toBe(
      true,
    );
  });
});
