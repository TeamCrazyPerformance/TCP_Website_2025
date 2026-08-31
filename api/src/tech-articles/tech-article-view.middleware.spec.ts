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
    viewer?: 'MEMBER' | 'GUEST',
  ) {
    const listeners: Array<() => void> = [];
    const request = {
      params: articleId ? { articleId } : {},
      headers: {},
    } as unknown as Request;
    const response = {
      statusCode,
      locals: viewer ? { techArticleViewer: viewer } : {},
      on: (event: string, listener: () => void) => {
        if (event === 'finish') listeners.push(listener);
      },
    } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1); // 어떤 경우에도 요청을 막지 않습니다.
    listeners.forEach((listener) => listener());
  }

  it('MEMBER 200 은 회원 열람으로 센다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 200, 'MEMBER');
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=true',
      {},
    );
  });

  it('GUEST 200 은 비회원 실제 열람으로 센다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 200, 'GUEST');
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=false',
      {},
    );
  });

  it('MEMBER 304 는 회원 열람으로 센다', () => {
    // 브라우저 캐시 재검증입니다. 상세 응답에 Cache-Control 이 없어 ETag 로
    // 되물어 오는데, 세지 않으면 같은 글을 다시 본 회원이 통째로 빠집니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 304, 'MEMBER');
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=true',
      {},
    );
  });

  it('locals 가 비어 있는 401 은 세지 않는다', () => {
    // 만료·위조 토큰은 가드가 locals 를 채우기 전에 401 을 던집니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 401);
    expect(post).not.toHaveBeenCalled();
  });

  it('404 는 세지 않는다', () => {
    // 비공개·보관·없는 아티클입니다. 게스트도 실제 본문을 받지 못했습니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 404, 'GUEST');
    expect(post).not.toHaveBeenCalled();
  });

  it('5xx 는 세지 않는다', () => {
    // 우리 쪽 실패라 사용자 행동이 아닙니다.
    const { post, middleware } = setup();
    run(middleware, 'article-1', 503, 'MEMBER');
    expect(post).not.toHaveBeenCalled();
  });

  it('tags 와 sources 는 아티클 자리에 와도 세지 않는다', () => {
    // 모듈에서 exclude 하지만, 경로가 늘어날 때를 대비한 두 번째 방어선입니다.
    const { post, middleware } = setup();
    run(middleware, 'tags', 200, 'GUEST');
    run(middleware, 'sources', 200, 'GUEST');
    expect(post).not.toHaveBeenCalled();
  });

  it('집계 실패가 요청 처리로 새어 나가지 않는다', async () => {
    const post = jest.fn().mockRejectedValue(new Error('pipeline down'));
    const pipeline = { post } as unknown as TechArticlePipelineClient;
    const middleware = new TechArticleViewMiddleware(pipeline);
    expect(() => run(middleware, 'article-1', 200, 'MEMBER')).not.toThrow();
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
