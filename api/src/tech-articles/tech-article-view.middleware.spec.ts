import { NextFunction, Request, Response } from 'express';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';
import { TechArticleViewMiddleware } from './tech-article-view.middleware';

describe('TechArticleViewMiddleware', () => {
  function setup() {
    const post = jest.fn().mockResolvedValue(undefined);
    const pipeline = { post } as unknown as TechArticlePipelineClient;
    return { post, middleware: new TechArticleViewMiddleware(pipeline) };
  }

  /** 응답이 끝났을 때만 집계하므로, 상태 코드를 정하고 finish 를 흘려 보냅니다. */
  function run(
    middleware: TechArticleViewMiddleware,
    articleId: string | undefined,
    statusCode: number,
    authorization?: string,
  ) {
    const listeners: Array<() => void> = [];
    const request = {
      params: articleId ? { articleId } : {},
      headers: authorization ? { authorization } : {},
    } as unknown as Request;
    const response = {
      statusCode,
      on: (event: string, listener: () => void) => {
        if (event === 'finish') listeners.push(listener);
      },
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1); // 어떤 경우에도 요청을 막지 않습니다.
    listeners.forEach((listener) => listener());
  }

  it('200 은 회원 열람으로 센다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 200);
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=true',
      {},
    );
  });

  it('401 은 비회원 열람 시도로 센다', () => {
    // 가드가 막은 요청입니다. 토큰 없음·만료·위조·로그아웃이 모두 여기로 옵니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 401);
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=false',
      {},
    );
  });

  it('304 는 회원 열람으로 센다', () => {
    // 브라우저 캐시 재검증입니다. 상세 응답에 Cache-Control 이 없어 ETag 로
    // 되물어 오는데, 세지 않으면 같은 글을 다시 본 회원이 통째로 빠집니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 304, 'Bearer token');
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=true',
      {},
    );
  });

  it('토큰을 들고 온 401 은 세지 않는다', () => {
    // 만료된 회원입니다. 프런트(api/client.js)가 refresh 후 같은 요청을 다시
    // 보내 200 이 되므로, 여기서 세면 한 번의 방문이 비회원 +1, 회원 +1 로
    // 두 번 잡힙니다. access token 만료가 15분이라 흔한 경로입니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 401, 'Bearer expired-token');
    expect(post).not.toHaveBeenCalled();
  });

  it('404 는 세지 않는다', () => {
    // 비공개·보관·없는 아티클입니다. 열람이 아니므로 회원 조회수를 올리면 안 됩니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 404);
    expect(post).not.toHaveBeenCalled();
  });

  it('5xx 는 세지 않는다', () => {
    // 우리 쪽 실패라 사용자 행동이 아닙니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 503);
    expect(post).not.toHaveBeenCalled();
  });

  it('tags 와 sources 는 아티클 자리에 와도 세지 않는다', () => {
    // 모듈에서 exclude 하지만, 경로가 늘어날 때를 대비한 두 번째 방어선입니다.
    const { post, middleware } = setup();
    run(middleware, 'tags', 200);
    run(middleware, 'sources', 200);
    expect(post).not.toHaveBeenCalled();
  });

  it('집계 실패가 요청 처리로 새어 나가지 않는다', async () => {
    const post = jest.fn().mockRejectedValue(new Error('pipeline down'));
    const pipeline = { post } as unknown as TechArticlePipelineClient;
    const middleware = new TechArticleViewMiddleware(pipeline);
    expect(() => run(middleware, 'article-1', 200)).not.toThrow();
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
