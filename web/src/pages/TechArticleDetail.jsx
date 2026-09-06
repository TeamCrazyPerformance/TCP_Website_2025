import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getTechArticle, techArticleErrorMessage } from "../api/techArticles";
import {
  SafeMarkdown,
  formatTechArticleDate,
} from "../components/tech-articles/TechArticleCommon";
import TechArticlePublicContent from "../components/tech-articles/TechArticlePublicContent";
import PublicValueScoreBreakdown from "../components/tech-articles/PublicValueScoreBreakdown";
import {
  holdArticleListReturn,
  releaseArticleListReturn,
} from "../components/tech-articles/articleListReturn";
import { shareArticle } from "../components/tech-articles/articleShare";
import { V9ArticleTags } from "./TechArticles";
import { useAuth } from "../context/AuthContext";

const ARTICLE_VIEW_SESSION_PREFIX = "tcp.tech-articles.viewed.v1:";

function claimArticleView(articleId) {
  if (typeof window === "undefined") return false;

  try {
    const key = `${ARTICLE_VIEW_SESSION_PREFIX}${articleId}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

function releaseArticleViewClaim(articleId) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(
      `${ARTICLE_VIEW_SESSION_PREFIX}${articleId}`,
    );
  } catch {}
}

function TechArticleDetail() {
  const { articleId } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState("");
  const [listReturn, setListReturn] = useState(null);

  useEffect(() => {
    const returnState = holdArticleListReturn(articleId);
    setListReturn(returnState);
    return () => {
      if (!window.location.pathname.startsWith("/tech-articles")) {
        releaseArticleListReturn(returnState);
      }
    };
  }, [articleId]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");
    const shouldRecordView = claimArticleView(articleId);
    getTechArticle(articleId, { recordView: shouldRecordView })
      .then((data) => {
        if (active) setArticle(data);
      })
      .catch((requestError) => {
        if (shouldRecordView && requestError?.response?.status) {
          releaseArticleViewClaim(articleId);
        }
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

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sourceName =
    article?.source?.name || article?.source?.domain || "확인 중";
  const sourceUrl = article?.source?.articleUrl;
  const sourceSiteUrl = article?.source?.domain
    ? `https://${article.source.domain}`
    : "";
  const scoreData = article?.valueScore;
  const score = scoreData?.overall;
  const scoreMinimum = Number.isFinite(scoreData?.scale?.min)
    ? scoreData.scale.min
    : 0;
  const scoreMaximum = Number.isFinite(scoreData?.scale?.max)
    ? scoreData.scale.max
    : 100;
  const isScoreLocked = Boolean(
    article && !Object.prototype.hasOwnProperty.call(article, "valueScore"),
  );

  const handleShare = async () => {
    if (!article) return;
    const url = `${window.location.origin}/tech-articles/${encodeURIComponent(article.id)}`;
    const result = await shareArticle({
      title: article.title,
      text: article.oneLineSummary,
      url,
    });

    if (result === "shared") {
      setToast("세부 페이지를 공유했습니다.");
    } else if (result === "copied") {
      setToast("세부 페이지 주소를 복사했습니다.");
    } else if (result === "failed") {
      setToast("세부 페이지 주소를 복사하지 못했습니다.");
    }
  };

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
              <Link
                className="back-to-list-link"
                to={listReturn?.listPath || "/tech-articles"}
                state={listReturn ? { restoreListPosition: true } : undefined}
              >
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
                아티클 목록으로 돌아가기
              </Link>
            </nav>

            <div className="detail-hero-content">
              <h1 id="articleTitle" className="detail-title">
                {article?.title ||
                  (isLoading
                    ? "아티클을 불러오는 중입니다."
                    : "아티클을 표시할 수 없습니다.")}
              </h1>

              {article && (sourceUrl || article.tags?.length > 0) && (
                <div
                  className="detail-info-row"
                  aria-label="원문 링크와 분야 태그"
                >
                  <div className="detail-info-items">
                    <V9ArticleTags
                      tags={article.tags}
                      id="detailTags"
                      className="detail-tags"
                      limit={Infinity}
                    />
                    {sourceUrl && (
                      <div className="detail-info-actions">
                        <button
                          className="detail-share-button"
                          type="button"
                          onClick={handleShare}
                          aria-label={`${article.title} 세부 페이지 공유`}
                        >
                          <i
                            className="fas fa-share-nodes"
                            aria-hidden="true"
                          ></i>
                        </button>
                        <a
                          className="detail-original-link"
                          id="heroOriginalLink"
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          원문
                          <i
                            className="fas fa-arrow-up-right-from-square"
                            aria-hidden="true"
                          ></i>
                        </a>
                      </div>
                    )}
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
                  aria-label="한 줄 요약과 주요 내용"
                >
                  {article?.oneLineSummary && (
                    <p
                      id="oneLineSummary"
                      className="detail-one-line-summary"
                      title={article.oneLineSummary}
                    >
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
                      <p>표시할 상세 요약이 없습니다.</p>
                    </div>
                  )}
                </article>
              </div>

              <aside className="detail-sidebar" aria-label="아티클 부가 정보">
                <section className="score-card" aria-labelledby="scoreHeading">
                  <h2 id="scoreHeading">가치 점수</h2>
                  {isScoreLocked ? (
                    <div className="score-gate-card" role="note">
                      <p className="score-gate-description">
                        <span>Tech Articles에서는</span>{" "}
                        <span>AI를 활용해 아티클을 분석하고,</span>{" "}
                        <span>가치 점수를 산정하여 제공하고 있어요.</span>
                      </p>
                      <div className="member-gate-actions">
                        <Link
                          className="member-gate-primary"
                          to="/login"
                          state={{ from: location.pathname }}
                        >
                          <i
                            className="fas fa-right-to-bracket"
                            aria-hidden="true"
                          ></i>
                          로그인하고 점수 보기
                        </Link>
                      </div>
                      <p className="member-gate-footnote">
                        아직 회원이 아니라면,{" "}
                        <Link to="/register">회원가입</Link>
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="score-summary">
                        <strong id="scoreValue">
                          {Number.isFinite(score) ? score : "—"}
                        </strong>
                        <span>/ {scoreMaximum}점</span>
                      </div>
                      <meter
                        id="scoreMeter"
                        className="score-meter"
                        min={scoreMinimum}
                        max={scoreMaximum}
                        value={Number.isFinite(score) ? score : scoreMinimum}
                        aria-label={
                          Number.isFinite(score)
                            ? `가치 점수 ${scoreMaximum}점 만점에 ${score}점`
                            : "가치 점수를 확인할 수 없음"
                        }
                      >
                        {Number.isFinite(score)
                          ? `${score}점`
                          : `${scoreMinimum}점`}
                      </meter>
                      <PublicValueScoreBreakdown
                        breakdown={scoreData?.breakdown}
                      />
                    </>
                  )}
                </section>

                <section
                  className="source-card"
                  aria-labelledby="sourceHeading"
                >
                  <h2 id="sourceHeading">원문 및 출처 정보</h2>
                  <dl className="source-details">
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
                          </a>
                        ) : (
                          "원문 주소 확인 중"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>출처</dt>
                      <dd>
                        {sourceSiteUrl ? (
                          <a
                            id="sourceSiteLink"
                            href={sourceSiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <strong id="sourceName">{sourceName}</strong>
                          </a>
                        ) : (
                          <strong id="sourceName">{sourceName}</strong>
                        )}
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
              <div>
                <h2 id="sourceNoticeHeading">
                  데이터 출처 및 AI 생성 정보 안내
                </h2>
                <p>
                  TCP는 기술 블로그, 개발자 뉴스·커뮤니티 및 공개 저장소 등 외부
                  출처의 콘텐츠를 수집, 제공합니다. 원문 주소와 출처 정보는 각
                  아티클에서 확인할 수 있습니다. 원문 콘텐츠의 모든 권리는 원문
                  발행처 또는 작성자에게 있습니다.
                </p>
                <p>
                  번역 제목, 한 줄 요약, 상세 요약과 분야 태그는 원문을 바탕으로
                  AI가 생성합니다. AI는 실수를 할 수 있으므로, 중요한 내용은
                  반드시 원문을 확인해 주세요.
                </p>
                <p>
                  가치 점수는 TCP 내부 기준을 통해 산정한 참고 지표입니다. 이
                  점수는 글의 정확성을 의미하지 않으며, 개별 아티클에 대한
                  절대적인 품질 또한 보증하지 않습니다.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <i className="fas fa-circle-info" aria-hidden="true"></i>
          <p>{toast}</p>
        </div>
      )}
    </TechArticlePublicContent>
  );
}

export default TechArticleDetail;
