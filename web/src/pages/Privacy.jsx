
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
    <main className="container mx-auto px-4 py-10 pt-20 text-left">
      {/* Title & Meta */}
      <section className="mb-8">
        <div className="flex items-start justify-between flex-col lg:flex-row gap-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-black gradient-text">개인정보처리방침</h2>
            <p className="text-gray-400 mt-2">Team Crazy Performance 개인정보처리방침입니다.</p>
          </div>
          <div className="doc-card p-4 rounded-xl w-full lg:w-auto lg:min-w-[260px] self-stretch lg:self-auto">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">버전</span>
              <span className="text-white font-semibold">v1.0</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400 text-sm">시행일</span>
              <span className="text-white">2026-02-19</span>
            </div>
          </div>
        </div>
      </section>

      {/* Layout: TOC + Document */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TOC */}
        <aside className="lg:col-span-3">
          <div className="doc-card rounded-xl p-4 sticky-col max-h-[calc(100vh-100px)] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3 text-white">목차</h3>
            <nav className="space-y-1 text-sm">
              <a href="#sec-1" onClick={(e) => handleTocClick(e, 'sec-1')} className="toc-link">1. 총칙</a>
              <a href="#sec-2" onClick={(e) => handleTocClick(e, 'sec-2')} className="toc-link">2. 개인정보의 수집 항목 및 수집 방법</a>
              <a href="#sec-3" onClick={(e) => handleTocClick(e, 'sec-3')} className="toc-link">3. 개인정보의 수집 및 이용 목적</a>
              <a href="#sec-4" onClick={(e) => handleTocClick(e, 'sec-4')} className="toc-link">4. 개인정보의 보유 및 이용 기간</a>
              <a href="#sec-5" onClick={(e) => handleTocClick(e, 'sec-5')} className="toc-link">5. 개인정보의 파기절차 및 방법</a>
              <a href="#sec-6" onClick={(e) => handleTocClick(e, 'sec-6')} className="toc-link">6. 개인정보 제공</a>
              <a href="#sec-7" onClick={(e) => handleTocClick(e, 'sec-7')} className="toc-link">7. 개인정보 처리의 위탁 및 국외 이전</a>
              <a href="#sec-8" onClick={(e) => handleTocClick(e, 'sec-8')} className="toc-link">8. 이용자의 권리와 행사방법</a>
              <a href="#sec-9" onClick={(e) => handleTocClick(e, 'sec-9')} className="toc-link">9. 개인정보 자동수집 장치의 설치, 운영 및 그 거부에 관한 사항</a>
              <a href="#sec-10" onClick={(e) => handleTocClick(e, 'sec-10')} className="toc-link">10. 개인정보의 기술적/관리적 보호 대책</a>
              <a href="#sec-11" onClick={(e) => handleTocClick(e, 'sec-11')} className="toc-link">11. 개인정보보호책임자 및 문의처</a>
              <a href="#sec-12" onClick={(e) => handleTocClick(e, 'sec-12')} className="toc-link">12. 권익침해 구제방법</a>
              <a href="#sec-13" onClick={(e) => handleTocClick(e, 'sec-13')} className="toc-link">13. 고지의 의무</a>
            </nav>
          </div>
        </aside>

        {/* Document */}
        <article className="lg:col-span-9 space-y-8">
          <section id="sec-1" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">1. 총칙</h3>
            <p className="text-gray-300 leading-7">Team Crazy Performance(이하 "TCP")는 회원의 개인정보를 중요시하며,「개인정보 보호법」등 관련 법령을 준수합니다.</p>
            <p className="text-gray-300 leading-7 mt-2">본 개인정보처리방침은 TCP가 제공하는 웹사이트 및 관련 서비스(이하 “서비스”) 이용과 관련하여 개인정보가 어떤 항목으로, 어떤 목적과 방식으로 처리되는지 안내합니다.</p>
          </section>

          <section id="sec-2" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">2. 개인정보의 수집 항목 및 수집 방법</h3>
            <p className="text-gray-300 leading-7">TCP는 회원가입, 상담, 서비스 신청 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>

            <h4 className="text-xl font-bold text-white mt-4 mb-2">(1) 수집하는 개인정보 항목</h4>

            <h5 className="text-lg font-semibold text-gray-200 mt-3 mb-1">1. 회원가입 시</h5>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1">
              <li><strong>필수항목</strong>: 아이디(ID), 비밀번호, 이메일, 이름, 전화번호</li>
              <li><strong>선택항목</strong>: 학번, 전공, 입학년도, 생년월일, 성별, 학적 상태(재학/휴학/졸업 등), 기술 스택(Tech Stack)</li>
            </ul>
            <p className="text-gray-400 text-sm mt-1">※ 생년월일, 성별은 회원가입 시 선택항목이며, TCP 입부 과정에서는 운영상 필요에 따라 별도로 요청될 수 있습니다(성별은 ‘선택 안함’ 선택 가능).</p>
            <p className="text-gray-400 text-sm mt-1">※ 선택항목은 회원이 ‘마이페이지 &gt; 개인정보 수정’에서 언제든지 입력·수정·삭제할 수 있습니다.</p>

            <h5 className="text-lg font-semibold text-gray-200 mt-3 mb-1">2. 부원 모집(Recruitment) 지원 시</h5>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1">
              <li><strong>수집항목</strong>: 이름, 학번, 전공, 전화번호, 기술 스택, 관심 분야, 자기소개, TCP에 대한 기대사항</li>
              <li><strong>경력/활동정보</strong>: 프로젝트 경험(프로젝트명, 기여도, 기간, 내용, 사용 기술), 수상 기록(수상명, 기관, 일자, 내용)</li>
            </ul>

            <h5 className="text-lg font-semibold text-gray-200 mt-3 mb-1">3. 서비스 이용 과정에서 자동 생성되어 수집되는 항목</h5>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1">
              <li>IP 주소, 접속 일시, 서비스 이용 기록, 부정이용 기록, 브라우저/OS 정보, 쿠키 또는 유사 식별자(세션 유지 및 보안 목적)</li>
              <li>TCP는 광고/마케팅 목적의 추적을 위한 개인정보를 수집하지 않습니다.</li>
            </ul>

            <h4 className="text-xl font-bold text-white mt-4 mb-2">(2) 개인정보 수집 방법</h4>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1">
              <li>홈페이지(회원가입, 게시판 작성, 모집 지원서 작성 등)에서 이용자가 직접 입력</li>
              <li>서비스 이용 과정에서 자동 생성되는 정보의 수집(보안/운영 목적)</li>
            </ul>
          </section>

          <section id="sec-3" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">3. 개인정보의 수집 및 이용 목적</h3>
            <p className="text-gray-300 leading-7">TCP는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>

            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2 mt-2">
              <li><strong>서비스 제공 및 계정 관리</strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>회원 식별, 본인 확인, 로그인 및 서비스 제공</li>
                  <li>권한에 따른 기능 제공(예: 일반 회원 기능, 부원 기능 등)</li>
                </ul>
              </li>
              <li><strong>커뮤니티/모집/스터디 기능 운영</strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>팀 프로젝트/스터디 그룹 운영 및 관리</li>
                  <li>모집(Recruitment) 지원 접수 및 선발 절차 운영</li>
                  <li>부원 간 원활한 소통 및 상호 식별(예: 호칭/지칭, 구성원 구분)을 위한 프로필 정보 제공</li>
                </ul>
              </li>
              <li><strong>고지/문의 대응</strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>공지사항 전달, 문의/민원 처리, 분쟁 대응</li>
                </ul>
              </li>
              <li><strong>보안 및 부정이용 방지</strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>비정상 이용 탐지, 계정 도용 방지, 서비스 안정성 확보</li>
                </ul>
              </li>
            </ol>
          </section>

          <section id="sec-4" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">4. 개인정보의 보유 및 이용 기간</h3>
            <p className="text-gray-300 leading-7">TCP는 원칙적으로 개인정보의 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만, 다음과 같은 기준으로 보관할 수 있습니다.</p>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-1 mt-2">
              <li><strong>회원가입 정보</strong>: 회원 탈퇴(이용계약 해지) 시까지 보관</li>
              <li><strong>모집(Recruitment) 지원 정보</strong>: 지원 절차 종료 후 합리적인 기간 보관(분쟁 대응 및 운영 기록 목적) 후 파기</li>
              <li><strong>서비스 이용 기록/부정이용 기록/접속 로그</strong>: 보안 및 부정이용 방지 목적 달성에 필요한 기간 보관 후 파기</li>
            </ol>
            <p className="text-gray-400 text-sm mt-2">※ 법령에 따라 별도로 보관해야 하는 항목이 있는 경우, 해당 법령에서 정한 기간 동안 보관 후 파기합니다.</p>
          </section>

          <section id="sec-5" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">5. 개인정보의 파기절차 및 방법</h3>
            <p className="text-gray-300 leading-7">내부 방침에 따라 파기합니다</p>
          </section>

          <section id="sec-6" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">6. 개인정보 제공</h3>
            <p className="text-gray-300 leading-7">TCP는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1 mt-2">
              <li>이용자의 별도 동의가 있는 경우(해당 시)</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section id="sec-7" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">7. 개인정보 처리의 위탁 및 국외 이전</h3>

            <h4 className="text-xl font-bold text-white mt-4 mb-2">(1) 처리 위탁</h4>
            <p className="text-gray-300 leading-7">TCP는 원활한 서비스 제공을 위해 필요한 경우 개인정보 처리 업무를 위탁할 수 있으며, 위탁 시 관련 법령에 따라 계약·관리·감독을 수행합니다.</p>
            <p className="text-gray-300 leading-7 mt-2">현재 기준: TCP는 서비스 운영을 자체 서버(자체 호스팅)로 수행하며, 외부 분석/로그 전송은 하지 않고 내부 ELK로만 처리합니다.</p>

            <h4 className="text-xl font-bold text-white mt-4 mb-2">(2) Cloudflare 이용에 따른 처리</h4>
            <p className="text-gray-300 leading-7">TCP는 서비스의 안정성 및 보안(예: DDoS 완화, 트래픽 보호)을 위해 Cloudflare의 프록시(Orange Cloud) 서비스를 이용합니다. 이 과정에서 이용자의 접속 관련 정보(IP 주소 등 트래픽 데이터)가 Cloudflare를 경유하며 처리될 수 있습니다.<br />자세한 내용은 아래 [국외 이전 안내]를 따릅니다.</p>

            <div className="bg-gray-800 p-4 rounded-lg mt-4">
              <h5 className="text-lg font-bold text-white mb-2">[국외 이전(국외 처리) 안내 - Cloudflare]</h5>
              <ul className="list-disc pl-6 text-gray-300 space-y-1 text-sm leading-6">
                <li><strong>국외이전의 법적 근거</strong>: 「개인정보 보호법」 제28조의8 제1항 제3호(정보주체와의 계약의 체결 및 이행을 위한 개인정보 처리)</li>
                <li><strong>이전(처리) 받는 자</strong>: Cloudflare, Inc. (문의: PrivacyQuestions@cloudflare.com)</li>
                <li><strong>이전(처리)되는 개인정보 항목</strong>: 접속 관련 정보(IP 주소 등 트래픽 데이터), 접속 일시, 요청 정보(보안/캐시 처리에 필요한 범위)</li>
                <li><strong>이전 국가/지역</strong>: Cloudflare 글로벌 인프라가 위치한 국가(해외 포함)</li>
                <li><strong>이전 시기 및 방법</strong>: 서비스 이용 시 네트워크 요청이 Cloudflare 프록시를 경유하는 과정에서 전송·처리</li>
                <li><strong>이전 목적</strong>: 서비스 보안 및 안정성 확보(예: DDoS 완화, 트래픽 보호), 성능 개선(캐시 등)</li>
                <li><strong>보유·이용 기간</strong>: 목적 달성에 필요한 기간 동안 처리되며, 세부 사항은 Cloudflare의 정책에 따릅니다.</li>
                <li><strong>이전 거부 방법</strong>: 이용자는 브라우저/네트워크 설정을 통해 서비스 접속을 중단함으로써 국외 처리를 사실상 거부할 수 있습니다.</li>
                <li><strong>이전 거부 시 불이익(거부 효과)</strong>: Cloudflare 프록시를 경유하지 않고는 서비스 접속/이용이 어려울 수 있으며, 보안 기능이 제한될 수 있습니다.</li>
              </ul>
            </div>
          </section>

          <section id="sec-8" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">8. 이용자의 권리와 행사방법</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 가입해지를 요청할 수 있습니다.</li>
              <li>이용자의 개인정보 조회/수정을 위해서는 '마이페이지' &gt; '개인정보 수정'을, 가입해지(이용계약 해지)를 위해서는 '회원탈퇴'를 클릭하여 본인 확인 절차를 거치신 후 직접 열람, 정정 또는 탈퇴가 가능합니다. 혹은 개인정보보호책임자에게 이메일로 연락하시면 조치해드리겠습니다.</li>
            </ol>
          </section>

          <section id="sec-9" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">9. 개인정보 자동수집 장치의 설치, 운영 및 그 거부에 관한 사항</h3>
            <p className="text-gray-300 leading-7">TCP는 서비스 보안 및 세션 유지를 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 기능 이용이 제한될 수 있습니다.</p>
          </section>

          <section id="sec-10" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">10. 개인정보의 기술적/관리적 보호 대책</h3>
            <p className="text-gray-300 leading-7">TCP는 개인정보의 안전성 확보를 위해 합리적인 범위에서 다음 조치를 시행합니다.</p>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1 mt-2">
              <li>비밀번호 등 인증정보의 안전한 저장 및 관리</li>
              <li>접근권한 최소화 및 관리</li>
              <li>보안 취약점 대응 및 점검(필요 시)</li>
              <li>내부 운영 환경에서의 로그/모니터링(외부 전송 없음)</li>
            </ul>
          </section>

          <section id="sec-11" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">11. 개인정보보호책임자 및 문의처</h3>
            <p className="text-gray-300 leading-7">개인정보 보호 관련 문의는 아래 채널로 연락해 주세요.</p>

            <div className="mt-4 space-y-4">
              <div>
                <strong className="text-white block mb-1">- 개인정보 보호책임자</strong>
                <ul className="list-disc pl-6 text-gray-300 space-y-1">
                  <li>성 명: 이준수</li>
                  <li>소속/담당: TCP 웹사이트 개발/운영팀</li>
                  <li>연락처: junsulee119@gmail.com</li>
                </ul>
              </div>
              <div>
                <strong className="text-white block mb-1">- 개인정보보호 문의처</strong>
                <ul className="list-disc pl-6 text-gray-300 space-y-1">
                  <li>부서명: TCP 웹사이트 개발/운영팀</li>
                  <li>연락처: junsulee119@gmail.com</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="sec-12" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">12. 권익침해 구제방법</h3>
            <p className="text-gray-300 leading-7">이용자는 개인정보침해로 인한 구제를 받기 위하여 아래 기관에 분쟁해결이나 상담 등을 신청할 수 있습니다.</p>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-1 mt-2">
              <li>개인정보 분쟁조정위원회: (국번없이) 1833-6972</li>
              <li>개인정보침해 신고센터(KISA): (국번없이) 118</li>
              <li>대검찰청 사이버범죄수사단: (국번없이) 1301</li>
              <li>경찰청 사이버수사국: (국번없이) 182</li>
            </ol>
          </section>

          <section id="sec-13" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">13. 고지의 의무</h3>
            <p className="text-gray-300 leading-7">본 개인정보처리방침의 내용이 추가·삭제·수정되는 경우, 변경사항을 서비스 내 공지사항 등을 통해 고지합니다.<br />다만, 이용자의 권리·의무에 중대한 영향을 미치는 변경의 경우 시행일 7일 전부터 고지합니다.</p>
            <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1 mt-2">
              <li>공고일자: 2026년 2월 19일</li>
              <li>시행일자: 2026년 2월 19일</li>
            </ul>
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
