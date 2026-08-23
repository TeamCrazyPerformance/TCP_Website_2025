// src/components/tech-articles/TechArticlePublicContent.jsx
//
// Tech Articles 공개 화면의 내용 영역 래퍼입니다.
// 헤더와 푸터는 사이트 공용 Header, Footer 를 그대로 사용하고,
// 이 컴포넌트는 v9 스타일을 .ta-public 스코프로 격리하는 역할만 담당합니다.
import React from "react";
// 순서를 바꾸면 v9 스타일이 지워지므로 reset -> 번들 -> align 순서를 유지해 주세요.
import "../../styles/techArticlesReset.css";
import "../../styles/techArticlesPublic.css";
import "../../styles/techArticlesPublicAlign.css";

function TechArticlePublicContent({ children }) {
  return <div className="ta-public">{children}</div>;
}

export default TechArticlePublicContent;
