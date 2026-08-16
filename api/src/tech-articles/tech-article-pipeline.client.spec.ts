import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';

describe('TechArticlePipelineClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function client(values: Record<string, string | undefined>) {
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new TechArticlePipelineClient(config);
  }

  function jsonResponse(ok: boolean, status: number, body: unknown): Response {
    return {
      ok,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it('adds service auth and repeated query values', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(jsonResponse(true, 200, { items: [] }));
    global.fetch = fetchMock;
    const service = client({
      TECH_ARTICLE_PIPELINE_BASE_URL: 'http://pipeline:8080',
      PIPELINE_SERVICE_TOKEN: 'secret-token',
    });

    await service.get('/internal/v1/public/articles', { tags: ['AI', '보안'] });

    const [url, options] = fetchMock.mock.calls[0];
    const requestUrl =
      url instanceof URL ? url.href : typeof url === 'string' ? url : url.url;
    expect(requestUrl).toContain('tags=AI');
    expect(requestUrl).toContain(encodeURIComponent('보안'));
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer secret-token',
    );
  });

  it('maps upstream version conflicts without exposing configuration', async () => {
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    fetchMock.mockResolvedValue(
      jsonResponse(false, 409, {
        code: 'VERSION_CONFLICT',
        message: 'changed',
      }),
    );
    global.fetch = fetchMock;
    const service = client({
      TECH_ARTICLE_PIPELINE_BASE_URL: 'http://pipeline:8080',
      PIPELINE_SERVICE_TOKEN: 'secret-token',
    });

    await expect(
      service.get('/internal/v1/admin/articles'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a stable 503 when configuration is absent', async () => {
    const service = client({});
    await expect(
      service.get('/internal/v1/public/articles'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
