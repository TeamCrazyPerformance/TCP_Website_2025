import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type QueryValue = string | number | boolean | string[] | undefined;

interface PipelineRequest {
  method?: 'GET' | 'POST' | 'PATCH';
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  write?: boolean;
}

@Injectable()
export class TechArticlePipelineClient {
  constructor(private readonly config: ConfigService) {}

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>(path, { query });
  }

  post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body,
      headers,
      write: true,
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body, write: true });
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      statusCode: 503,
      code: 'TECH_ARTICLE_PIPELINE_UNAVAILABLE',
      message: '기술 아티클 서비스를 일시적으로 사용할 수 없습니다.',
    });
  }

  private timeout(name: string, fallback: number): number {
    const value = Number(this.config.get<string>(name));
    return Number.isFinite(value) && value >= 100 && value <= 60_000
      ? value
      : fallback;
  }

  private async request<T>(path: string, options: PipelineRequest): Promise<T> {
    const baseUrl = this.config.get<string>('TECH_ARTICLE_PIPELINE_BASE_URL');
    const token = this.config.get<string>('PIPELINE_SERVICE_TOKEN');
    if (!baseUrl || !token) throw this.unavailable();

    let url: URL;
    try {
      url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    } catch {
      throw this.unavailable();
    }
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = this.timeout(
      options.write
        ? 'TECH_ARTICLE_PIPELINE_WRITE_TIMEOUT_MS'
        : 'TECH_ARTICLE_PIPELINE_READ_TIMEOUT_MS',
      options.write ? 5000 : 2000,
    );
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      const payload = text ? this.parseJson(text) : undefined;
      if (!response.ok) this.throwUpstream(response.status, payload);
      return payload as T;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw this.unavailable();
    }
  }

  private throwUpstream(status: number, payload: unknown): never {
    const value =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const detail =
      typeof value.detail === 'object' && value.detail !== null
        ? (value.detail as Record<string, unknown>)
        : value;
    const code =
      typeof detail.code === 'string' ? detail.code : 'PIPELINE_REQUEST_FAILED';
    const message =
      typeof detail.message === 'string'
        ? detail.message
        : '기술 아티클 요청을 처리하지 못했습니다.';
    const body = { statusCode: status, code, message };
    if (status === 400) throw new BadRequestException(body);
    if (status === 404) throw new NotFoundException(body);
    if (status === 409) throw new ConflictException(body);
    if (status === 422) throw new UnprocessableEntityException(body);
    throw this.unavailable();
  }
}
