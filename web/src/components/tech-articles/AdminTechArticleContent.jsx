// src/components/tech-articles/AdminTechArticleContent.jsx
//
// Tech Articles 관리 화면의 내용 영역 래퍼입니다.
// 사이드바와 상단바는 기존 AdminLayout, AdminSidebar 를 그대로 사용하고,
// 이 컴포넌트는 v9 스타일을 .ta-admin 스코프로 격리하는 역할만 담당합니다.
import React from "react";
// 순서를 바꾸면 v9 스타일이 지워지므로 reset -> 번들 -> align 순서를 유지해 주세요.
import "../../styles/techArticlesReset.css";
import "../../styles/techArticlesAdmin.css";
import "../../styles/techArticlesAdminAlign.css";

function AdminTechArticleContent({ children }) {
  return (
    <div className="ta-admin">
      {/* 기존 관리자 페이지와 같은 폭 제한. 브레이크포인트 거동까지 일치. */}
      <div className="container mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

export default AdminTechArticleContent;
