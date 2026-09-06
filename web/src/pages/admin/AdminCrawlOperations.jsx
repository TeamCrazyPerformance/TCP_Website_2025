import React from "react";
import AdminTechArticleContent from "../../components/tech-articles/AdminTechArticleContent";
import TechArticleCrawlPanel from "../../components/tech-articles/TechArticleCrawlPanel";

function AdminCrawlOperations() {
  return (
    <AdminTechArticleContent>
      <section className="admin-intro" aria-labelledby="crawlOperationsTitle">
        <div>
          <h2 id="crawlOperationsTitle" className="orbitron gradient-text">
            크롤링 관리
          </h2>
          <p>
            기술 아티클 수집을 실행하고 자동·수동 크롤링의 실행 상태와 종료
            결과를 확인합니다.
          </p>
        </div>
      </section>

      <section
        className="crawl-panel-v9 crawl-operations-panel-v9"
        aria-label="기술 아티클 크롤링 운영"
      >
        <div className="crawl-panel-heading-v9">
          <h3>실행 이력과 수집 운영</h3>
          <p>
            실행 상태는 자동으로 갱신되며 페이지를 다시 열어도 최근 이력에서
            이어서 확인할 수 있습니다. 최종 수집 통계는 실행이 끝난 뒤 표시되고,
            각 실행의 “상세” 버튼으로 실행 ID와 서버 상태를 확인할 수 있습니다.
            비동기 수집은 아래 실행 패널에서 언제든지 시작할 수 있습니다.
          </p>
        </div>
        <TechArticleCrawlPanel />
      </section>
    </AdminTechArticleContent>
  );
}

export default AdminCrawlOperations;
