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
      // 아티클 목록·상세 흐름을 완전히 벗어날 때는 브라우저 기본 정책을 즉시 복구합니다.
      if (!window.location.pathname.startsWith("/tech-articles")) {
        releaseArticleListReturn(returnState);
      }
    };
  }, [articleId]);

  useEffect(() => {
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

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sourceName =
    article?.source?.name || article?.source?.domain || "확인 중";
  const sourceUrl = article?.source?.articleUrl;
  // 출처 이름은 글 하나가 아니라 그 매체로 가는 링크입니다.
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
  // 로그인 상태가 아니라 서버 응답을 신뢰합니다. 토큰 경계에서 화면과
  // 실제 공개 데이터가 어긋나지 않게 하는 기준입니다.
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
              {/* 목록 카드에서 들어왔다면 그때 보던 목록(검색어·태그·페이지)
                  주소로 돌아가고, 읽던 카드가 화면의 같은 자리에 오도록
                  스크롤까지 복구합니다. 목록 첫 화면으로 되돌리면 방금 어디를
                  보고 있었는지 사용자가 다시 찾아야 합니다. 주소를 직접
                  열었거나 복귀 정보가 만료됐으면 목록 첫 화면으로 갑니다. */}
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
              {/* 출처와 게시 시각은 오른쪽 "원문 및 출처 정보" 카드가 이미
                  전부 싣고 있습니다. 제목 아래에는 분류(태그)와 바로 누를
                  동작(원문 보기·공유)만 남겨 첫 화면을 가볍게 유지합니다. */}
              {article && (sourceUrl || article.tags?.length > 0) && (
                <div
                  className="detail-info-row"
                  aria-label="원문 링크와 분야 태그"
                >
                  <div className="detail-info-items">
                    {/* 분류가 왼쪽, 누를 것이 오른쪽입니다. 읽는 눈은 왼쪽
                        에서 시작하고 누르는 손은 오른쪽 끝을 먼저 만납니다. */}
                    <V9ArticleTags
                      tags={article.tags}
                      id="detailTags"
                      className="detail-tags"
                      limit={Infinity}
                    />
                    {sourceUrl && (
                      /* 두 동작을 한 덩어리로 묶습니다. 줄이 바뀔 때 공유
                         버튼만 홀로 떨어지지 않고 "태그 / 공유+원문" 두
                         층으로만 나뉩니다. 원문이 주 동작이라 오른쪽 끝에
                         둡니다 — 엄지가 가장 먼저 닿는 자리입니다. */
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
                        {/* 개행 자리를 CSS가 알 수 있도록 의미 단위로
                            나눠 둡니다. */}
                        <span>
                          Tech Articles에서는 AI를 활용해 아티클을 분석하고,
                        </span>{" "}
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
                            {/* 주소 자체가 이미 링크로 보이고, 바로 아래
                                출처 이름도 링크입니다. 줄마다 아이콘이
                                붙으면 카드가 아이콘 목록처럼 읽힙니다. */}
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
                        {/* 도메인은 바로 위 "원문 URL" 줄이 이미 싣고
                            있었습니다. 같은 값을 두 줄에 나눠 적는 대신
                            이름 하나만 남기고 매체 사이트로 보냅니다. */}
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
              <i className="fas fa-circle-info" aria-hidden="true"></i>
              <div>
                {/* 안내 문구 제목이라 브랜드 서체(Orbitron)를 쓰지 않습니다.
                    한글 사이에 섞인 "AI"만 다른 글꼴로 튀어 보입니다.
                    목록 화면의 같은 안내와 서체를 맞춥니다. */}
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
