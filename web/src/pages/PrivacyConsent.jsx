
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const PrivacyConsent = () => {
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
                        <h2 className="text-4xl md:text-5xl font-black gradient-text">개인정보 수집·이용 동의</h2>
                        <p className="text-gray-400 mt-2">TCP 신입부원 모집 지원 시 개인정보 수집·이용 동의 안내입니다.</p>
                    </div>
                    <div className="doc-card p-4 rounded-xl w-full lg:w-auto lg:min-w-[260px] self-stretch lg:self-auto">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">버전</span>
                            <span className="text-white font-semibold">v1.0</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-400 text-sm">시행일</span>
                            <span className="text-white">2026-03-07</span>
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
                            <a href="#sec-1" onClick={(e) => handleTocClick(e, 'sec-1')} className="toc-link">1. 수집·이용 목적</a>
                            <a href="#sec-2" onClick={(e) => handleTocClick(e, 'sec-2')} className="toc-link">2. 수집하는 개인정보 항목</a>
                            <a href="#sec-3" onClick={(e) => handleTocClick(e, 'sec-3')} className="toc-link">3. 보유 및 이용 기간</a>
                            <a href="#sec-4" onClick={(e) => handleTocClick(e, 'sec-4')} className="toc-link">4. 동의 거부 권리 및 불이익</a>
                            <a href="#sec-5" onClick={(e) => handleTocClick(e, 'sec-5')} className="toc-link">5. 개인정보보호책임자 및 문의처</a>
                            <a href="#sec-6" onClick={(e) => handleTocClick(e, 'sec-6')} className="toc-link">6. 개인정보처리방침 안내</a>
                        </nav>
                    </div>
                </aside>

                {/* Document */}
                <article className="lg:col-span-9 space-y-8">
                    <section id="sec-1" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">1. 수집·이용 목적</h3>
                        <p className="text-gray-300 leading-7">Team Crazy Performance(이하 "TCP")는 신입부원 모집 지원서 접수 및 선발 절차 운영을 위하여 아래와 같이 개인정보를 수집·이용합니다.</p>
                        <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1 mt-2">
                            <li>모집(Recruitment) 지원 접수 및 지원자 식별</li>
                            <li>지원자 선발 심사 및 평가</li>
                            <li>선발 결과 통보 및 연락</li>
                            <li>지원 관련 문의 대응</li>
                        </ul>
                    </section>

                    <section id="sec-2" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">2. 수집하는 개인정보 항목</h3>
                        <p className="text-gray-300 leading-7 mb-4">TCP는 모집 지원 시 아래와 같은 개인정보를 수집합니다.</p>

                        <h4 className="text-xl font-bold text-white mt-4 mb-2">(1) 필수 수집 항목</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300 mt-2">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="py-2 px-4 text-gray-200 font-semibold">구분</th>
                                        <th className="py-2 px-4 text-gray-200 font-semibold">수집 항목</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-800">
                                        <td className="py-2 px-4 font-medium text-white">인적 사항</td>
                                        <td className="py-2 px-4">이름, 학번, 학과/전공, 전화번호</td>
                                    </tr>
                                    <tr className="border-b border-gray-800">
                                        <td className="py-2 px-4 font-medium text-white">서술 정보</td>
                                        <td className="py-2 px-4">관심 분야, 자기소개, TCP에 대한 기대</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h4 className="text-xl font-bold text-white mt-6 mb-2">(2) 선택 수집 항목</h4>
                        <p className="text-gray-400 text-sm mb-2">※ 아래 항목은 지원자가 자유롭게 입력할 수 있으며, 미입력 시에도 지원에 불이익이 없습니다.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300 mt-2">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="py-2 px-4 text-gray-200 font-semibold">구분</th>
                                        <th className="py-2 px-4 text-gray-200 font-semibold">수집 항목</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-800">
                                        <td className="py-2 px-4 font-medium text-white">기술 스택</td>
                                        <td className="py-2 px-4">보유 기술 스택</td>
                                    </tr>
                                    <tr className="border-b border-gray-800">
                                        <td className="py-2 px-4 font-medium text-white">프로젝트 경험</td>
                                        <td className="py-2 px-4">프로젝트명, 참여율(%), 진행 기간, 프로젝트 내용, 사용 기술</td>
                                    </tr>
                                    <tr className="border-b border-gray-800">
                                        <td className="py-2 px-4 font-medium text-white">수상 기록</td>
                                        <td className="py-2 px-4">수상명, 수여 기관, 수상 년월일, 수상 내용</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h4 className="text-xl font-bold text-white mt-6 mb-2">(3) 수집 방법</h4>
                        <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1">
                            <li>TCP 공식 웹사이트 모집 지원서 양식을 통해 지원자가 직접 입력</li>
                        </ul>
                    </section>

                    <section id="sec-3" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">3. 보유 및 이용 기간</h3>
                        <p className="text-gray-300 leading-7">수집된 개인정보는 다음과 같은 기준으로 보유·이용 후 파기합니다.</p>
                        <ul className="list-disc pl-6 text-gray-300 leading-7 space-y-1 mt-2">
                            <li><strong>원칙</strong>: 모집 지원 절차(접수 → 심사 → 선발 결과 통보) 종료 시까지</li>
                            <li><strong>예외</strong>: 지원 절차 종료 후에도 분쟁 대응 및 운영 기록 목적으로 합리적인 기간 동안 보관할 수 있으며, 해당 목적 달성 후 지체 없이 파기합니다.</li>
                        </ul>
                        <p className="text-gray-400 text-sm mt-2">※ 관련 법령에 따라 별도로 보관이 필요한 경우, 해당 법령에서 정한 기간 동안 보관합니다.</p>
                    </section>

                    <section id="sec-4" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">4. 동의 거부 권리 및 불이익</h3>
                        <p className="text-gray-300 leading-7">지원자는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.</p>
                        <div className="bg-gray-800 p-4 rounded-lg mt-4">
                            <p className="text-gray-300 leading-7">
                                <strong className="text-yellow-300">⚠ 유의사항: </strong>
                                필수 항목에 대한 동의를 거부할 경우, 지원서 접수가 불가능하며 신입부원 모집에 지원할 수 없습니다.
                                선택 항목에 대한 동의를 거부하더라도 지원에는 불이익이 없으나, 심사 시 참고 자료가 제한될 수 있습니다.
                            </p>
                        </div>
                    </section>

                    <section id="sec-5" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">5. 개인정보보호책임자 및 문의처</h3>
                        <p className="text-gray-300 leading-7">개인정보 수집·이용 관련 문의는 아래 채널로 연락해 주세요.</p>
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

                    <section id="sec-6" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">6. 개인정보처리방침 안내</h3>
                        <p className="text-gray-300 leading-7">
                            TCP의 개인정보 처리에 관한 보다 자세한 사항(파기 절차, 이용자 권리, 보호 대책, 권익침해 구제 방법 등)은{' '}
                            <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">
                                TCP 개인정보처리방침
                            </Link>
                            을 참고해 주세요.
                        </p>
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

export default PrivacyConsent;
