
import React, { useEffect, useState } from 'react';

const Privacy = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTocClick = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <main className="container mx-auto px-4 py-10 pt-20">
      {/* Title & Meta */}
      <section className="mb-8">
        <div className="flex items-start justify-between flex-col lg:flex-row gap-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-black gradient-text">개인정보처리방침 (목업)</h2>
            <p className="text-gray-400 mt-2">본 페이지는 디자인/레이아웃 확인을 위한 목업 입니다. 실제 법적 효력은 없습니다.</p>
          </div>
          <div className="doc-card p-4 rounded-xl min-w-[260px] self-stretch lg:self-auto">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">버전</span>
              <span className="text-white font-semibold">v0.1 (draft)</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400 text-sm">최종 업데이트</span>
              <span className="text-white">2025-08-10</span>
            </div>
            <div className="mt-3 text-xs text-gray-400">회원가입·마이페이지의 동의/열람 UI와 연결 예정</div>
          </div>
        </div>
      </section>

      {/* Layout: TOC + Document */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TOC */}
        <aside className="lg:col-span-3">
          <div className="doc-card rounded-xl p-4 sticky-col">
            <h3 className="text-lg font-bold mb-3 text-white">목차</h3>
            <nav className="space-y-1 text-sm">
              <a href="#sec-1" onClick={(e) => handleTocClick(e, 'sec-1')} className="toc-link">제1조 (총칙 및 적용범위)</a>
              <a href="#sec-2" onClick={(e) => handleTocClick(e, 'sec-2')} className="toc-link">제2조 (수집하는 개인정보 항목)</a>
              <a href="#sec-3" onClick={(e) => handleTocClick(e, 'sec-3')} className="toc-link">제3조 (개인정보 수집 방법)</a>
              <a href="#sec-4" onClick={(e) => handleTocClick(e, 'sec-4')} className="toc-link">제4조 (개인정보의 이용 목적)</a>
              <a href="#sec-5" onClick={(e) => handleTocClick(e, 'sec-5')} className="toc-link">제5조 (보유 및 이용기간)</a>
              <a href="#sec-6" onClick={(e) => handleTocClick(e, 'sec-6')} className="toc-link">제6조 (제3자 제공)</a>
              <a href="#sec-7" onClick={(e) => handleTocClick(e, 'sec-7')} className="toc-link">제7조 (처리의 위탁)</a>
              <a href="#sec-8" onClick={(e) => handleTocClick(e, 'sec-8')} className="toc-link">제8조 (쿠키 등 자동수집)</a>
              <a href="#sec-9" onClick={(e) => handleTocClick(e, 'sec-9')} className="toc-link">제9조 (이용자 권리와 행사)</a>
              <a href="#sec-10" onClick={(e) => handleTocClick(e, 'sec-10')} className="toc-link">제10조 (안전성 확보조치)</a>
              <a href="#sec-11" onClick={(e) => handleTocClick(e, 'sec-11')} className="toc-link">제11조 (국외 이전)</a>
              <a href="#sec-12" onClick={(e) => handleTocClick(e, 'sec-12')} className="toc-link">제12조 (개인정보 보호책임자)</a>
              <a href="#sec-13" onClick={(e) => handleTocClick(e, 'sec-13')} className="toc-link">제13조 (고지의무 및 개정)</a>
            </nav>
          </div>
        </aside>

        {/* Document */}
        <article className="lg:col-span-9 space-y-8">
          <section id="sec-1" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제1조 (총칙 및 적용범위)</h3>
            <p className="text-gray-300 leading-7">TCP(Team Crazy Performance)는 이용자의 개인정보를 중요하게 생각하며 『개인정보 보호법』 등 관련 법령을 준수합니다. 본 방침은 웹사이트 및 관련 서비스(이하 “서비스”)에 적용됩니다. (문구 더미)</p>
          </section>

          <section id="sec-2" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제2조 (수집하는 개인정보 항목)</h3>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-2">
              <li>필수: 이름, 학번/소속, 이메일, 로그인 ID, 비밀번호 해시, 서비스 이용기록 등 (더미)</li>
              <li>선택: 프로필 이미지, 관심 분야, 포트폴리오 링크 등 (더미)</li>
              <li>자동수집: IP, 쿠키, 접속 로그, 브라우저/디바이스 정보 등 (더미)</li>
            </ul>
          </section>

          <section id="sec-3" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제3조 (개인정보 수집 방법)</h3>
            <p className="text-gray-300 leading-7">회원가입, 지원서 제출, 마이페이지 수정, 문의 메일, 서비스 이용 과정에서 생성되는 정보 등을 통해 수집합니다. Lorem ipsum dolor sit amet. (더미)</p>
          </section>

          <section id="sec-4" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제4조 (개인정보의 이용 목적)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>회원 식별, 서비스 제공 및 유지보수</li>
              <li>모집/프로젝트 운영 관리, 공지 전달</li>
              <li>보안, 서비스 개선, 통계 분석</li>
              <li>법령 준수 및 분쟁 대응 (모두 더미)</li>
            </ol>
          </section>

          <section id="sec-5" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제5조 (보유 및 이용기간)</h3>
            <p className="text-gray-300 leading-7">수집 목적 달성 시까지 보유하며, 관련 법령에 따라 일정 기간 보관될 수 있습니다. 예: 로그기록 3개월, 계약/청구 관련 5년 등 (모두 예시, 더미)</p>
            <div className="callout p-4 rounded-lg mt-4 text-sm text-gray-300"><i className="fas fa-info-circle mr-2"></i> 회원 탈퇴 시 지체 없이 파기하며, 법령상 보관이 필요한 경우 별도 분리보관합니다. (더미)</div>
          </section>

          <section id="sec-6" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제6조 (제3자 제공)</h3>
            <p className="text-gray-300 leading-7">원칙적으로 이용자 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만 법령에 근거한 요청 등 예외가 있을 수 있습니다. (더미)</p>
          </section>

          <section id="sec-7" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제7조 (처리의 위탁)</h3>
            <p className="text-gray-300 leading-7">서비스 운영상 필요한 경우 일부 업무를 외부에 위탁할 수 있으며, 수탁자와 업무 범위는 고지 후 관리·감독합니다. (더미)</p>
          </section>

          <section id="sec-8" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제8조 (쿠키 등 자동수집)</h3>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-2">
              <li>쿠키 사용 목적: 로그인 유지, 편의 제공, 트래픽 분석 (더미)</li>
              <li>거부 방법: 브라우저 설정(쿠키 차단/삭제) 변경 (더미)</li>
            </ul>
          </section>

          <section id="sec-9" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제9조 (이용자 권리와 행사)</h3>
            <p className="text-gray-300 leading-7">이용자는 언제든지 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 마이페이지 또는 문의 메일을 통해 신청하세요. (더미)</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <button className="cta-button w-full px-4 py-3 rounded-lg text-sm font-semibold"><i className="fas fa-download mr-2"></i>데이터 내보내기 (목업)</button>
              <button className="cta-button w-full px-4 py-3 rounded-lg text-sm font-semibold"><i className="fas fa-trash-alt mr-2"></i>삭제 요청 (목업)</button>
            </div>
          </section>

          <section id="sec-10" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제10조 (안전성 확보조치)</h3>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-2">
              <li>관리적 조치: 내부관리계획 수립, 정기 교육 (더미)</li>
              <li>기술적 조치: 접근권한 관리, 암호화, 로그 모니터링 (더미)</li>
              <li>물리적 조치: 전용 공간 접근 통제 등 (더미)</li>
            </ul>
          </section>

          <section id="sec-11" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제11조 (국외 이전)</h3>
            <p className="text-gray-300 leading-7">해외 클라우드 사용 등 국외 이전이 필요한 경우 이전받는 자, 이전 국가, 이전 일시·방법, 보유·이용기간 등을 사전에 고지하고 동의를 받습니다. (더미)</p>
          </section>

          <section id="sec-12" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제12조 (개인정보 보호책임자)</h3>
            <div className="text-gray-300 leading-7">
              <p>책임자: 홍길동(목업) / 이메일: <a href="mailto:tcp@university.ac.kr" className="underline text-blue-300 hover:text-blue-200">tcp@university.ac.kr</a></p>
              <p className="text-sm text-gray-400 mt-1">※ 문의 시 신속히 답변드릴 수 있도록 이름/연락처/문의내용을 기재해 주세요. (목업)</p>
            </div>
          </section>

          <section id="sec-13" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제13조 (고지의무 및 개정)</h3>
            <p className="text-gray-300 leading-7">본 방침의 내용 추가, 삭제 또는 수정이 있을 경우 최소 7일 전부터 서비스 내 공지합니다. 중대한 변경 시 30일 전 공지할 수 있습니다. (더미)</p>
          </section>

          {/* 연락 채널 (목업) */}
          <section className="doc-card rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">문의</h3>
            <p className="text-gray-300">개인정보 관련 문의: <a href="mailto:tcp@university.ac.kr" className="underline text-blue-300 hover:text-blue-200">tcp@university.ac.kr</a> (목업)</p>
          </section>
        </article>
      </section>

      {showBackToTop && (
        <button onClick={scrollToTop} id="backToTop" className="back-to-top cta-button px-3 py-2 rounded-lg text-white text-sm shadow-lg" style={{ display: 'block' }}>
          <i className="fas fa-arrow-up mr-1"></i>맨 위로
        </button>
      )}
    </main>
  );
};

export default Privacy;
