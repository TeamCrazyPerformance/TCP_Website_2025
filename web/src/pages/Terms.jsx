
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Terms = () => {
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
            <h2 className="text-4xl md:text-5xl font-black gradient-text">이용약관 (목업)</h2>
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
            <div className="mt-3 text-xs text-gray-400">회원가입 페이지에서 약관 동의 UI와 연결 예정</div>
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
              <a href="#sec-1" onClick={(e) => handleTocClick(e, 'sec-1')} className="toc-link">제1조 (목적)</a>
              <a href="#sec-2" onClick={(e) => handleTocClick(e, 'sec-2')} className="toc-link">제2조 (정의)</a>
              <a href="#sec-3" onClick={(e) => handleTocClick(e, 'sec-3')} className="toc-link">제3조 (약관의 효력 및 변경)</a>
              <a href="#sec-4" onClick={(e) => handleTocClick(e, 'sec-4')} className="toc-link">제4조 (회원가입 및 계정)</a>
              <a href="#sec-5" onClick={(e) => handleTocClick(e, 'sec-5')} className="toc-link">제5조 (개인정보 보호)</a>
              <a href="#sec-6" onClick={(e) => handleTocClick(e, 'sec-6')} className="toc-link">제6조 (서비스의 제공 및 변경)</a>
              <a href="#sec-7" onClick={(e) => handleTocClick(e, 'sec-7')} className="toc-link">제7조 (이용자의 의무)</a>
              <a href="#sec-8" onClick={(e) => handleTocClick(e, 'sec-8')} className="toc-link">제8조 (금지행위)</a>
              <a href="#sec-9" onClick={(e) => handleTocClick(e, 'sec-9')} className="toc-link">제9조 (콘텐츠 권리)</a>
              <a href="#sec-10" onClick={(e) => handleTocClick(e, 'sec-10')} className="toc-link">제10조 (면책 및 책임 제한)</a>
              <a href="#sec-11" onClick={(e) => handleTocClick(e, 'sec-11')} className="toc-link">제11조 (계약 해지 및 이용제한)</a>
              <a href="#sec-12" onClick={(e) => handleTocClick(e, 'sec-12')} className="toc-link">제12조 (분쟁 해결 및 준거법)</a>
            </nav>
          </div>
        </aside>

        {/* Document */}
        <article className="lg:col-span-9 space-y-8">
          <section id="sec-1" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제1조 (목적)</h3>
            <p className="text-gray-300 leading-7">이 약관은 TCP(Team Crazy Performance)가 제공하는 웹사이트 및 관련 서비스(이하 “서비스”)의 이용과 관련하여, 서비스 제공자와 이용자 간의 권리, 의무 및 책임 사항, 기타 필요한 사항을 정함을 목적으로 합니다. 본 문서는 레이아웃 확인을 위한 예시 문구로, 실제 내용은 추후 별도 작성됩니다.</p>
          </section>

          <section id="sec-2" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제2조 (정의)</h3>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-2">
              <li><span className="text-gray-200">“사이트”</span>란 TCP의 공식 웹사이트를 말합니다.</li>
              <li><span className="text-gray-200">“회원”</span>이란 약관에 동의하고 서비스 이용을 위해 계정을 생성한 자를 말합니다.</li>
              <li><span className="text-gray-200">“콘텐츠”</span>란 텍스트, 이미지, 코드, 링크 등 사이트에 게시되거나 전송되는 모든 자료를 의미합니다.</li>
              <li>본 조의 문구는 목업 용 더미입니다. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
            </ul>
          </section>

          <section id="sec-3" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제3조 (약관의 효력 및 변경)</h3>
            <div className="space-y-3 text-gray-300 leading-7">
              <p>약관은 사이트에 게시함으로써 효력이 발생합니다. 서비스 운영상 필요 또는 관련 법령 개정 시 약관을 변경할 수 있으며, 변경되는 경우 사전 고지합니다.</p>
              <p>본 문구는 샘플입니다. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.</p>
            </div>
            <div className="callout p-4 rounded-lg mt-4 text-sm text-gray-300">
              <i className="fas fa-info-circle mr-2"></i> 변경 약관에 동의하지 않는 경우 회원은 계정 삭제(탈퇴)를 통해 이용계약을 해지할 수 있습니다. (더미 문구)
            </div>
          </section>

          <section id="sec-4" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제4조 (회원가입 및 계정)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>회원가입은 이용자가 약관 및 개인정보 처리방침에 동의하고 필요한 정보를 입력함으로써 신청됩니다. (더미)</li>
              <li>계정 보안은 회원 본인의 책임입니다. 비밀번호는 주기적으로 변경하시기 바랍니다. (더미)</li>
              <li>허위 정보 제공 시 서비스 이용이 제한될 수 있습니다. Lorem ipsum dolor sit amet.</li>
            </ol>
          </section>

          <section id="sec-5" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제5조 (개인정보 보호)</h3>
            <p className="text-gray-300 leading-7">서비스 제공과 관련하여 수집·이용되는 개인정보는 별도의 <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">개인정보처리방침</Link>에 따릅니다. (문구 더미)</p>
          </section>

          <section id="sec-6" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제6조 (서비스의 제공 및 변경)</h3>
            <p className="text-gray-300 leading-7">TCP는 공지 없이 서비스의 일부 또는 전부를 변경·중단할 수 있습니다. 본 단락은 레이아웃을 위한 플레이스홀더입니다. Curabitur blandit tempus porttitor.</p>
          </section>

          <section id="sec-7" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제7조 (이용자의 의무)</h3>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-2">
              <li>관계 법령, 약관, 안내된 정책을 준수해야 합니다. (더미)</li>
              <li>타인의 권리를 침해하거나 사이트 운영을 방해하는 행위를 해서는 안 됩니다. (더미)</li>
            </ul>
          </section>

          <section id="sec-8" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제8조 (금지행위)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
                <h4 className="font-semibold mb-2 text-white"><i className="fas fa-ban mr-2 text-red-400"></i>기술적 금지</h4>
                <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                  <li>비정상적 트래픽 유발, 크롤링/스크래핑(무단) 등</li>
                  <li>취약점 악용, 리버스 엔지니어링 등</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-gray-900 border border-gray-800">
                <h4 className="font-semibold mb-2 text-white"><i className="fas fa-user-shield mr-2 text-yellow-300"></i>권리침해 금지</h4>
                <ul className="list-disc pl-5 text-gray-300 text-sm space-y-1">
                  <li>저작권, 상표권, 초상권 등 침해</li>
                  <li>타인 사칭, 개인정보 불법 수집</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="sec-9" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제9조 (콘텐츠 권리)</h3>
            <p className="text-gray-300 leading-7">이용자가 사이트에 게시하는 콘텐츠의 권리와 책임은 해당 이용자에게 있으며, TCP는 서비스 운영, 홍보 등을 위해 비독점적 사용권을 가질 수 있습니다. (샘플 문구)</p>
          </section>

          <section id="sec-10" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제10조 (면책 및 책임 제한)</h3>
            <p className="text-gray-300 leading-7">자연재해, 시스템 장애, 제3자의 불법행위 등으로 인한 손해에 대해 TCP는 책임을 지지 않습니다. 이 문단은 더미이며 실제 운영정책에 맞게 조정됩니다.</p>
          </section>

          <section id="sec-11" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제11조 (계약 해지 및 이용제한)</h3>
            <p className="text-gray-300 leading-7">회원은 언제든지 계정 삭제를 통해 이용계약을 해지할 수 있습니다. TCP는 약관 위반 시 서비스 이용을 제한할 수 있습니다. (더미)</p>
          </section>

          <section id="sec-12" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제12조 (분쟁 해결 및 준거법)</h3>
            <p className="text-gray-300 leading-7">본 약관은 대한민국 법령을 준거법으로 합니다. 분쟁 발생 시 상호 협의하되, 협의가 이루어지지 않을 경우 관할 법원에 제기할 수 있습니다. (더미)</p>
          </section>

          {/* 연락 채널 (목업) */}
          <section className="doc-card rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">문의</h3>
            <p className="text-gray-300">약관 관련 문의: <a href="mailto:tcp@university.ac.kr" className="underline text-blue-300 hover:text-blue-200">tcp@university.ac.kr</a> (목업)</p>
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

export default Terms;
