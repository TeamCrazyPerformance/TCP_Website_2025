
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
    <main className="container mx-auto px-4 py-10 pt-20 text-left">
      {/* Title & Meta */}
      <section className="mb-8">
        <div className="flex items-start justify-between flex-col lg:flex-row gap-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-black gradient-text">서비스 이용약관</h2>
            <p className="text-gray-400 mt-2">Team Crazy Performance 서비스 이용약관입니다.</p>
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
              <a href="#sec-1" onClick={(e) => handleTocClick(e, 'sec-1')} className="toc-link">제1조 (목적)</a>
              <a href="#sec-2" onClick={(e) => handleTocClick(e, 'sec-2')} className="toc-link">제2조 (정의)</a>
              <a href="#sec-3" onClick={(e) => handleTocClick(e, 'sec-3')} className="toc-link">제3조 (약관의 게시와 개정)</a>
              <a href="#sec-4" onClick={(e) => handleTocClick(e, 'sec-4')} className="toc-link">제4조 (회원 가입 및 이용계약 체결)</a>
              <a href="#sec-5" onClick={(e) => handleTocClick(e, 'sec-5')} className="toc-link">제5조 (회원정보의 변경)</a>
              <a href="#sec-6" onClick={(e) => handleTocClick(e, 'sec-6')} className="toc-link">제6조 (개인정보보호 의무)</a>
              <a href="#sec-7" onClick={(e) => handleTocClick(e, 'sec-7')} className="toc-link">제7조 (회원의 아이디 및 비밀번호의 관리에 대한 의무)</a>
              <a href="#sec-8" onClick={(e) => handleTocClick(e, 'sec-8')} className="toc-link">제8조 ("회원"에 대한 통지)</a>
              <a href="#sec-9" onClick={(e) => handleTocClick(e, 'sec-9')} className="toc-link">제9조 ("TCP"의 의무)</a>
              <a href="#sec-10" onClick={(e) => handleTocClick(e, 'sec-10')} className="toc-link">제10조 ("회원"의 의무)</a>
              <a href="#sec-11" onClick={(e) => handleTocClick(e, 'sec-11')} className="toc-link">제11조 (서비스의 제공 등)</a>
              <a href="#sec-12" onClick={(e) => handleTocClick(e, 'sec-12')} className="toc-link">제12조 (서비스의 변경)</a>
              <a href="#sec-13" onClick={(e) => handleTocClick(e, 'sec-13')} className="toc-link">제13조 (권리의 귀속)</a>
              <a href="#sec-14" onClick={(e) => handleTocClick(e, 'sec-14')} className="toc-link">제14조 (게시물의 저작권)</a>
              <a href="#sec-15" onClick={(e) => handleTocClick(e, 'sec-15')} className="toc-link">제15조 (이용제한 등)</a>
              <a href="#sec-16" onClick={(e) => handleTocClick(e, 'sec-16')} className="toc-link">제16조 (회원 탈퇴 및 이용계약 해지)</a>
              <a href="#sec-17" onClick={(e) => handleTocClick(e, 'sec-17')} className="toc-link">제17조 (책임제한)</a>
              <a href="#sec-18" onClick={(e) => handleTocClick(e, 'sec-18')} className="toc-link">제18조 (준거법 및 재판관할)</a>
              <a href="#sec-addendum" onClick={(e) => handleTocClick(e, 'sec-addendum')} className="toc-link">부칙</a>
            </nav>
          </div>
        </aside>

        {/* Document */}
        <article className="lg:col-span-9 space-y-8">
          <section id="sec-1" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제1조 (목적)</h3>
            <p className="text-gray-300 leading-7">본 약관은 Team Crazy Performance(이하 "TCP")가 제공하는 TCP 공식 웹사이트 및 관련 제반 서비스(이하 "서비스")의 이용과 관련하여 TCP와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section id="sec-2" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제2조 (정의)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"서비스"라 함은 구현되는 단말기(PC, 휴대형단말기 등의 각종 유무선 장치를 포함)와 상관없이 "회원"이 이용할 수 있는 TCP 및 관련 제반 서비스를 의미합니다.</li>
              <li>"회원"이라 함은 TCP의 "서비스"에 접속하여 본 약관에 따라 "TCP"와 이용계약을 체결하고 "TCP"가 제공하는 "서비스"를 이용하는 고객을 말합니다.</li>
              <li>"아이디(ID)"라 함은 "회원"의 식별과 "서비스" 이용을 위하여 "회원"이 정하고 "TCP"가 승인하는 문자와 숫자의 조합을 의미합니다.</li>
              <li>"비밀번호"라 함은 "회원"이 부여 받은 아이디와 일치되는 "회원"임을 확인하고 비밀보호를 위해 "회원" 자신이 정한 문자 또는 숫자의 조합을 의미합니다.</li>
              <li>"게시물"이라 함은 "회원"이 "서비스"를 이용함에 있어 "서비스상"에 게시한 부호ㆍ문자ㆍ음성ㆍ음향ㆍ화상ㆍ동영상 등의 정보 형태의 글, 사진, 동영상 및 각종 파일과 링크 등을 의미합니다.</li>
            </ol>
          </section>

          <section id="sec-3" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제3조 (약관의 게시와 개정)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"는 이 약관의 내용을 "회원"이 쉽게 알 수 있도록 서비스 초기 화면에 게시하거나 연결화면을 통하여 볼 수 있도록 합니다.</li>
              <li>"TCP"는 ｢약관의 규제에 관한 법률｣, ｢정보통신망 이용촉진 및 정보보호 등에 관한 법률｣(이하 "정보통신망법") 등 관련법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
              <li>"TCP"가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 제1항의 방식 또는 다른 방법으로 공지합니다.<br />다만, "회원"의 권리·의무에 중대한 영향을 미치는 변경의 경우 적용일자 7일 전부터 공지합니다.</li>
            </ol>
          </section>

          <section id="sec-4" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제4조 (회원 가입 및 이용계약 체결)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>이용계약은 "회원"이 되고자 하는 자(이하 "가입신청자")가 약관의 내용에 대하여 동의를 한 다음 회원가입신청을 하고 "TCP"가 이러한 신청에 대하여 승낙함으로써 체결됩니다.</li>
              <li>"TCP"는 "가입신청자"의 신청에 대하여 "서비스" 이용을 승낙함을 원칙으로 합니다. 다만, "TCP"는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.
                <ul className="list-none pl-4 space-y-1 mt-1">
                  <li>① 가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                  <li>② 타인의 명의를 이용한 경우</li>
                  <li>③ 허위의 정보를 기재하거나, "TCP"가 요구하는 내용을 기재하지 않은 경우</li>
                  <li>④ 이용자의 귀책사유로 인하여 승인이 불가능하거나 기타 규정한 제반 사항을 위반하며 신청하는 경우</li>
                </ul>
              </li>
              <li>회원가입계약의 성립 시기는 "TCP"의 승낙이 "회원"에게 도달한 시점으로 합니다.</li>
              <li>본 서비스는 만 14세 이상인 자만 회원으로 가입할 수 있습니다.</li>
              <li>만 14세 미만의 자가 회원가입을 신청한 경우, "TCP"는 해당 신청을 승낙하지 않으며, 만 14세 미만임이 사후에 확인될 경우 회원 자격을 즉시 해지하고 관련 정보를 삭제할 수 있습니다.</li>
              <li>"TCP"는 회원의 권한(예: 비회원, 일반 회원, 부원 인증 회원 등)에 따라 서비스의 전부 또는 일부 이용을 제한할 수 있습니다.</li>
            </ol>
          </section>

          <section id="sec-5" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제5조 (회원정보의 변경)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"회원"은 마이페이지(MyPage)를 통하여 언제든지 본인의 개인정보를 열람하고 수정할 수 있습니다. 단, 서비스 관리를 위해 필요한 실명, 아이디, 학번 등은 수정이 불가능할 수 있습니다.</li>
              <li>"회원"은 회원가입신청 시 기재한 사항에 변경이 있는 경우, "마이페이지(MyPage)" 기능을 통해 이를 수정하는 것이 권장됩니다.</li>
              <li>제2항의 변경사항을 "TCP"에 알리지 않아 발생한 불이익에 대하여 "TCP"는 책임지지 않습니다.</li>
            </ol>
          </section>

          <section id="sec-6" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제6조 (개인정보보호 의무)</h3>
            <p className="text-gray-300 leading-7">"TCP"는 "정보통신망법" 등 관계 법령이 정하는 바에 따라 "회원"의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 사용에 대해서는 관련 법령 및 "TCP"의 <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">개인정보처리방침</Link>이 적용됩니다.</p>
          </section>

          <section id="sec-7" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제7조 (회원의 아이디 및 비밀번호의 관리에 대한 의무)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"회원"의 "아이디"와 "비밀번호"에 관한 관리책임은 "회원"에게 있으며, 이를 제3자가 이용하도록 하여서는 안 됩니다.</li>
              <li>"TCP"는 "회원"의 "아이디"가 개인정보 유출 우려가 있거나, 반사회적 또는 미풍양속에 어긋나거나 "TCP" 및 "TCP"의 운영자로 오인할 우려가 있는 경우, 해당 "아이디"의 이용을 제한할 수 있습니다.</li>
              <li>"회원"은 "아이디" 및 "비밀번호"가 도용되거나 제3자가 사용하고 있음을 인지한 경우, 계정 보호 및 피해 확산 방지를 위해 이를 "TCP"에 지체 없이 통지하는 것을 권장합니다. "TCP"는 계정 보호를 위해 필요한 안내를 제공할 수 있습니다.</li>
            </ol>
          </section>

          <section id="sec-8" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제8조 ("회원"에 대한 통지)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"가 "회원"에 대한 통지를 하는 경우 이 약관에 별도 규정이 없는 한 서비스 내 전자우편주소, 공지사항 등으로 할 수 있습니다.</li>
              <li>"TCP"는 불특정다수 "회원"에 대한 통지의 경우 1주일이상 "서비스" 게시판에 게시함으로써 개별 통지에 갈음할 수 있습니다.</li>
            </ol>
          </section>

          <section id="sec-9" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제9조 ("TCP"의 의무)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"는 관련 법령과 이 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고 안정적으로 "서비스"를 제공하기 위하여 최선을 다하여 노력합니다.</li>
              <li>"TCP"는 "회원"이 안전하게 "서비스"를 이용할 수 있도록 개인정보 보호를 위한 기술적·관리적 보호조치를 합리적인 범위에서 적용하기 위해 노력하며, 개인정보처리방침을 공시하고 이를 준수합니다.</li>
            </ol>
          </section>

          <section id="sec-10" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제10조 ("회원"의 의무)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"회원"은 다음 행위를 하여서는 안 됩니다.
                <ul className="list-none pl-4 space-y-1 mt-1">
                  <li>① 신청 또는 변경 시 허위내용의 등록</li>
                  <li>② 타인의 정보 도용</li>
                  <li>③ "TCP"가 게시한 정보의 변경</li>
                  <li>④ "TCP"가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                  <li>⑤ "TCP"와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                  <li>⑥ "TCP" 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                  <li>⑦ 외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 "서비스"에 공개 또는 게시하는 행위</li>
                  <li>⑧ TCP의 동의 없이 영리를 목적으로 "서비스"를 사용하는 행위</li>
                  <li>⑨ 기타 불법적이거나 부당한 행위</li>
                  <li>⑩ 회원가입 시 본인의 연령을 포함한 정보를 사실과 다르게 기재하는 행위</li>
                </ul>
              </li>
              <li>"회원"은 관계 법령, 이 약관의 규정, 이용안내 및 "서비스"와 관련하여 공지한 주의사항, "TCP"가 통지하는 사항 등을 준수하여야 하며, 기타 "TCP"의 업무에 방해되는 행위를 하여서는 안 됩니다.</li>
            </ol>
          </section>

          <section id="sec-11" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제11조 (서비스의 제공 등)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"서비스"는 운영상 필요에 따라 제공되며, 관련 사항은 "서비스" 화면을 통해 안내할 수 있습니다.</li>
              <li>"TCP"는 회원의 권한(예: 비회원, 일반 회원, 부원 인증 회원 등)에 따라 서비스의 전부 또는 일부 이용을 제한할 수 있습니다.</li>
              <li>"TCP"는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 상당한 이유가 있는 경우 "서비스"의 제공을 일시적으로 중단할 수 있습니다.</li>
              <li>"TCP"는 서비스의 제공에 필요한 경우 정기점검을 실시할 수 있으며, 정기점검시간은 서비스제공화면에 공지한 바에 따릅니다.</li>
            </ol>
          </section>

          <section id="sec-12" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제12조 (서비스의 변경)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"는 상당한 이유가 있는 경우에 운영상, 기술상의 필요에 따라 제공하고 있는 전부 또는 일부 "서비스"를 변경할 수 있습니다.</li>
              <li>"TCP"는 "서비스"의 내용, 이용방법, 이용시간에 변경이 있는 경우 이를 "서비스" 화면을 통해 공지할 수 있습니다.<br />다만, "회원"의 권리·의무에 중대한 영향을 미치는 변경의 경우 적용일자 7일 전부터 공지합니다.</li>
            </ol>
          </section>

          <section id="sec-13" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제13조 (권리의 귀속)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"서비스"에 대한 저작권 및 지적재산권은 "TCP"에 귀속됩니다.</li>
              <li>"TCP"는 서비스와 관련하여 "회원"에게 "TCP"가 정한 이용조건에 따라 계정, "아이디", 콘텐츠 등을 이용할 수 있는 이용권만을 부여하며, "회원"은 이를 양도, 판매, 담보제공 등의 처분행위를 할 수 없습니다.</li>
            </ol>
          </section>

          <section id="sec-14" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제14조 (게시물의 저작권)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"회원"이 "서비스" 내에 게시한 "게시물"의 저작권은 해당 게시물의 저작자에게 귀속됩니다.</li>
              <li>"회원"이 "서비스" 내에 게시하는 "게시물"은 검색결과 등에 노출될 수 있으며, 해당 노출을 위해 필요한 범위 내에서는 일부 수정, 복제, 편집되어 게시될 수 있습니다. 이 경우, TCP는 저작권법 규정을 준수하며, "회원"은 언제든지 "TCP"가 지정한 문의 채널(전자우편 등) 또는 "서비스" 내 관리기능을 통해 해당 게시물에 대해 삭제, 검색결과 제외, 비공개 등의 조치를 취할 수 있습니다.</li>
              <li>"TCP"는 제2항 이외의 방법으로 "회원"의 "게시물"을 이용하고자 하는 경우에는 전화, 팩스, 전자우편 등을 통해 사전에 "회원"의 동의를 얻어야 합니다.</li>
            </ol>
          </section>

          <section id="sec-15" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제15조 (이용제한 등)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"는 "회원"이 이 약관의 의무를 위반하거나 "서비스"의 정상적인 운영을 방해한 경우, 경고, 일시정지, 영구이용정지 등으로 "서비스" 이용을 단계적으로 제한할 수 있습니다.</li>
              <li>"TCP"는 명의도용, "저작권법" 및 "컴퓨터프로그램보호법"을 위반한 불법프로그램의 제공 및 운영방해, "정보통신망법"을 위반한 불법통신 및 해킹, 악성프로그램의 배포, 접속권한 초과행위 등과 같이 관련법을 위반한 경우에는 즉시 영구이용정지를 할 수 있습니다.</li>
              <li>"TCP"는 회원이 만 14세 미만임이 확인된 경우, 사전 통지 없이 회원 자격을 해지할 수 있습니다.</li>
            </ol>
          </section>

          <section id="sec-16" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제16조 (회원 탈퇴 및 이용계약 해지)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"회원"은 언제든지 "서비스" 내 "마이페이지(MyPage)" 기능 또는 "TCP"가 지정한 문의 채널(전자우편 등)을 통해 이용계약 해지(탈퇴)를 요청할 수 있습니다.</li>
              <li>"TCP"는 관련 법령 및 개인정보처리방침에 따라 탈퇴 처리 및 회원정보를 처리합니다.</li>
              <li>탈퇴가 완료되면 "회원"의 계정은 이용이 제한되며, "서비스" 운영상 또는 관련 법령에 따라 보존이 필요한 정보가 있는 경우를 제외하고 회원정보는 파기 또는 분리보관될 수 있습니다.</li>
            </ol>
          </section>

          <section id="sec-17" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제17조 (책임제한)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"는 천재지변 또는 이에 준하는 불가항력으로 인하여 "서비스"를 제공할 수 없는 경우에는 "서비스" 제공에 관한 책임이 면제됩니다.</li>
              <li>"TCP"는 "회원"의 귀책사유로 인한 "서비스" 이용의 장애에 대하여는 책임을 지지 않습니다.</li>
              <li>"TCP"는 "회원"이 "서비스"와 관련하여 게재한 정보, 자료, 사실의 신뢰도, 정확성 등의 내용에 관하여는 책임을 지지 않습니다.</li>
              <li>"TCP"는 "회원" 간 또는 "회원"과 제3자 상호간에 "서비스"를 매개로 하여 거래 등을 한 경우에는 책임이 면제됩니다.</li>
            </ol>
          </section>

          <section id="sec-18" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">제18조 (준거법 및 재판관할)</h3>
            <ol className="list-decimal pl-6 text-gray-300 leading-7 space-y-2">
              <li>"TCP"와 "회원" 간 제기된 소송은 대한민국법을 준거법으로 합니다.</li>
              <li>"TCP"와 "회원"간 발생한 분쟁에 관한 소송은 민사소송법 상의 관할법원에 제소합니다.</li>
            </ol>
          </section>

          <section id="sec-addendum" className="doc-card rounded-xl p-6 section-anchor">
            <h3 className="text-2xl font-bold text-white mb-3">부칙</h3>
            <p className="text-gray-300 leading-7">이 약관은 2026년 2월 19일부터 적용됩니다.</p>
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
