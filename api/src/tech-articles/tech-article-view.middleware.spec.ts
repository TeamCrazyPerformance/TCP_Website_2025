import { NextFunction, Request, Response } from 'express';
import { TechArticlePipelineClient } from './tech-article-pipeline.client';
import { TechArticleViewMiddleware } from './tech-article-view.middleware';

describe('TechArticleViewMiddleware', () => {
  function setup() {
    const post = jest.fn().mockResolvedValue(undefined);
    const pipeline = { post } as unknown as TechArticlePipelineClient;
    return { post, middleware: new TechArticleViewMiddleware(pipeline) };
  }

  function run(
    middleware: TechArticleViewMiddleware,
    articleId: string | undefined,
    statusCode: number,
    viewer?: 'MEMBER' | 'GUEST',
    recordView = true,
  ) {
    const listeners: Array<() => void> = [];
    const request = {
      params: articleId ? { articleId } : {},
      query: recordView ? { recordView: 'true' } : {},
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

  it('프런트가 집계를 요청하지 않은 상세 조회는 세지 않는다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 200, 'GUEST', false);
    expect(post).not.toHaveBeenCalled();
  });

  it('MEMBER 304 는 회원 열람으로 센다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 304, 'MEMBER');
    expect(post).toHaveBeenCalledWith(
      '/internal/v1/public/articles/article-1/view?member=true',
      {},
    );
  });

  it('locals 가 비어 있는 401 은 세지 않는다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 401);
    expect(post).not.toHaveBeenCalled();
  });

  it('404 는 세지 않는다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 404, 'GUEST');
    expect(post).not.toHaveBeenCalled();
  });

  it('5xx 는 세지 않는다', () => {
    const { post, middleware } = setup();
    run(middleware, 'article-1', 503, 'MEMBER');
    expect(post).not.toHaveBeenCalled();
  });

  it('tags 와 sources 는 아티클 자리에 와도 세지 않는다', () => {
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
