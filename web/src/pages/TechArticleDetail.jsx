import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getTechArticle, techArticleErrorMessage } from "../api/techArticles";
import {
  SafeMarkdown,
  formatTechArticleDate,
} from "../components/tech-articles/TechArticleCommon";
import TechArticlePublicContent from "../components/tech-articles/TechArticlePublicContent";
import { V9ArticleTags } from "./TechArticles";
import { useAuth } from "../context/AuthContext";

function scoreLabel(value) {
  return Number.isFinite(value) ? `${value} / 100` : "— / 100";
}

function TechArticleDetail() {
  const { articleId } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      setArticle(null);
      return undefined;
    }

    let active = true;
    setIsLoading(true);
    setError("");
    getTechArticle(articleId)
      .then((data) => {
        if (active) setArticle(data);
      })
      .catch((requestError) => {
        if (!active) return;
        const notFound = requestError?.response?.status === 404;
        setError(
          notFound
            ? "공개되지 않았거나 찾을 수 없는 아티클입니다."
            : techArticleErrorMessage(
                requestError,
                "아티클 상세를 불러오지 못했습니다.",
              ),
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleId, isAuthenticated, reloadKey]);

  useEffect(() => {
    const previousTitle = document.title;
    if (article?.title) document.title = `${article.title} | TCP Tech Articles`;
    return () => {
      document.title = previousTitle;
    };
  }, [article?.title]);

  const sourceName =
    article?.source?.name || article?.source?.domain || "확인 중";
  const sourceUrl = article?.source?.articleUrl;
  const overall = article?.evaluation?.score?.overall;
  const score = Number.isFinite(overall) ? overall : article?.score;

  return (
    <TechArticlePublicContent>
      <main id="top" className="detail-main">
        <section
          id="article-detail"
          className="detail-hero"
          aria-labelledby="articleTitle"
        >
          <div className="container">
            <nav className="detail-breadcrumb" aria-label="현재 위치">
              <Link className="back-to-list-link" to="/tech-articles">
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
                아티클 목록으로 돌아가기
              </Link>
            </nav>

            <div className="detail-hero-content">
              <h1 id="articleTitle" className="detail-title">
                {article?.title ||
                  (isLoading
                    ? "아티클을 불러오는 중입니다."
                    : !isAuthenticated
                      ? "로그인이 필요한 아티클입니다."
                      : "아티클을 표시할 수 없습니다.")}
              </h1>
              {article && (
                <div
                  className="detail-info-row"
                  aria-label="아티클 출처, 게시 시각, 태그와 원문 링크"
                >
                  <div className="detail-info-items">
                    <span className="detail-info-item detail-source-item">
                      <span className="detail-info-label">
                        <i className="fas fa-building" aria-hidden="true"></i>
                        원출처 <strong id="heroSourceName">{sourceName}</strong>
                      </span>
                      {sourceUrl && (
                        <a
                          className="detail-original-link"
                          id="heroOriginalLink"
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          원문 보기
                          <i
                            className="fas fa-arrow-up-right-from-square"
                            aria-hidden="true"
                          ></i>
                        </a>
                      )}
                    </span>
                    <span className="detail-info-item">
                      <i className="fas fa-calendar-day" aria-hidden="true"></i>
                      원문 게시{" "}
                      <time
                        id="heroPublishedAt"
                        dateTime={article.originalPublishedAt}
                      >
                        {formatTechArticleDate(
                          article.originalPublishedAt,
                          true,
                        )}{" "}
                        KST
                      </time>
                    </span>
                    <V9ArticleTags
                      tags={article.tags}
                      id="detailTags"
                      className="detail-tags"
                      limit={Infinity}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          className="detail-content-section"
          aria-label="아티클 상세 정보"
        >
          <div className="container">
            {!isAuthenticated && (
              <p className="detail-data-error" role="status">
                상세 요약은 로그인 회원에게 제공됩니다.{" "}
                <Link to="/login" state={{ from: location.pathname }}>
                  로그인하기
                </Link>
              </p>
            )}
            {error && (
              <p className="detail-data-error" role="alert">
                {error}{" "}
                <button
                  className="button-reset"
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                >
                  다시 시도
                </button>
              </p>
            )}

            <div className="detail-layout">
              <div className="detail-primary">
                <article
                  className="summary-card"
                  aria-labelledby="summaryHeading"
                >
                  <header className="summary-heading">
                    <h2 id="summaryHeading">핵심 요약</h2>
                  </header>

                  {article?.oneLineSummary && (
                    <p id="oneLineSummary" className="detail-one-line-summary">
                      {article.oneLineSummary}
                    </p>
                  )}
                  {isLoading ? (
                    <div className="summary-body summary-body-v9">
                      <p>아티클 상세 요약을 불러오는 중입니다.</p>
                    </div>
                  ) : article ? (
                    <SafeMarkdown
                      id="summaryBody"
                      markdown={article.summaryMarkdown}
                      className="summary-body summary-body-v9 markdown-content"
                    />
                  ) : (
                    <div className="summary-body summary-body-v9">
                      <p>
                        {isAuthenticated
                          ? "표시할 상세 요약이 없습니다."
                          : "로그인 후 AI 상세 요약을 확인할 수 있습니다."}
                      </p>
                    </div>
                  )}
                </article>
              </div>

              <aside className="detail-sidebar" aria-label="아티클 부가 정보">
                <section className="score-card" aria-labelledby="scoreHeading">
                  <p className="orbitron scenario-eyebrow">VALUE SCORE</p>
                  <h2 id="scoreHeading">가치 점수</h2>
                  <div className="score-summary">
                    <strong id="scoreValue">
                      {Number.isFinite(score) ? score : "—"}
                    </strong>
                    <span>/ 100점</span>
                  </div>
                  <meter
                    id="scoreMeter"
                    className="score-meter"
                    min="0"
                    max="100"
                    value={Number.isFinite(score) ? score : 0}
                    aria-label={
                      Number.isFinite(score)
                        ? `가치 점수 100점 만점에 ${score}점`
                        : "가치 점수를 확인할 수 없음"
                    }
                  >
                    {Number.isFinite(score) ? `${score}점` : "0점"}
                  </meter>
                  <dl className="score-breakdown">
                    <div>
                      <dt>관련성</dt>
                      <dd id="scoreRelevance">
                        {scoreLabel(article?.evaluation?.score?.relevance)}
                      </dd>
                    </div>
                    <div>
                      <dt>최신성</dt>
                      <dd id="scoreFreshness">
                        {scoreLabel(article?.evaluation?.score?.timeliness)}
                      </dd>
                    </div>
                    <div>
                      <dt>출처 신뢰도</dt>
                      <dd id="scoreSourceTrust">
                        {scoreLabel(
                          article?.evaluation?.score?.sourceReliability,
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  className="source-card"
                  aria-labelledby="sourceHeading"
                >
                  <p className="orbitron scenario-eyebrow">SOURCE</p>
                  <h2 id="sourceHeading">원문 및 출처 정보</h2>
                  <dl className="source-details">
                    <div>
                      <dt>출처</dt>
                      <dd>
                        <strong id="sourceName">{sourceName}</strong>
                        <span id="sourceDomain">
                          {article?.source?.domain || ""}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>원문 언어</dt>
                      <dd id="sourceLanguage" className="source-language-value">
                        <strong>
                          {article?.originalLanguage?.label || "확인 중"}
                        </strong>
                        {article?.originalLanguage?.code && (
                          <span>({article.originalLanguage.code})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>원문 URL</dt>
                      <dd>
                        {sourceUrl ? (
                          <a
                            id="sourceOriginalLink"
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span id="sourceOriginalUrlText">
                              {article.source?.domain}
                              {article.source?.path}
                            </span>
                            <i
                              className="fas fa-arrow-up-right-from-square"
                              aria-hidden="true"
                            ></i>
                          </a>
                        ) : (
                          "원문 주소 확인 중"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>원문 게시</dt>
                      <dd>
                        <time
                          id="sourcePublishedAt"
                          dateTime={article?.originalPublishedAt}
                        >
                          {article
                            ? `${formatTechArticleDate(article.originalPublishedAt, true)} KST`
                            : "확인 중"}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>TCP 수집</dt>
                      <dd>
                        <time
                          id="sourceCollectedAt"
                          dateTime={article?.collectedAt}
                        >
                          {article
                            ? `${formatTechArticleDate(article.collectedAt, true)} KST`
                            : "확인 중"}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </section>
              </aside>
            </div>

            <aside
              className="source-notice detail-source-notice"
              aria-labelledby="sourceNoticeHeading"
            >
              <i className="fas fa-circle-info" aria-hidden="true"></i>
              <div>
                <h2 id="sourceNoticeHeading" className="orbitron">
                  데이터 출처 및 AI 요약 안내
                </h2>
                <p>
                  TCP는 공식 기술 블로그와 개발자 커뮤니티 등에서 수집한 원문의
                  제목, 출처, 게시 시각을 정규화해 제공합니다. 콘텐츠의 권리와
                  최종 내용은 원문 발행처에 있습니다.
                </p>
                <p>
                  AI 요약과 가치 점수는 탐색을 돕기 위한 참고 정보이며 원문의
                  전체 맥락이나 작성자의 의도를 대체하지 않습니다. 상세 요약과
                  가치 점수는 서버의 최신 응답을 기준으로 표시됩니다.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </TechArticlePublicContent>
  );
}

export default TechArticleDetail;
