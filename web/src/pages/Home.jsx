import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.svg';
import { stats } from '../data/stats';

function Home() {
  useEffect(() => {
    // 스크롤 애니메이션
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // 한 번 실행 후 정지
        }
      });
    }, observerOptions);

    // .scroll-fade 클래스
    document.querySelectorAll('.scroll-fade').forEach((el) => {
      observer.observe(el);
    });

    // 컴포넌트 언마운트 시 클린업
    return () => {
      observer.disconnect(); // 옵저버 연결 해제
    };
  }, []);

  return (
    <>
      {' '}
      {/* React Fragment 요소 묶기 */}
      {/* Hero Section */}
      <section className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="orbitron text-5xl md:text-7xl font-black mb-4">
                <span className="gradient-text">TCP</span>
              </h1>
              <p className="orbitron text-xl md:text-2xl text-gray-300 mb-6">
                Team Crazy Performance
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                엘리트 개발자들의 모임, TCP는 뛰어난 실력을 가진 학생 개발자들이
                모여 함께 성장하고 도전하는 컴퓨터공학 동아리입니다.
              </p>
            </div>

            {/* 하이라이트 메세지 */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="feature-card p-6 rounded-xl card-hover">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <i className="fas fa-laptop-code text-white"></i>
                </div>
                <h3 className="orbitron text-lg font-bold mb-2 text-blue-300">
                  개발자를 위한 동아리
                </h3>
                <p className="text-sm text-gray-400">
                  전문적인 개발 역량을 키우고 실무 경험을 쌓을 수 있는 최적의
                  환경
                </p>
              </div>

              <div className="feature-card p-6 rounded-xl card-hover">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <i className="fas fa-graduation-cap text-white"></i>
                </div>
                <h3 className="orbitron text-lg font-bold mb-2 text-purple-300">
                  다양한 학습 기회
                </h3>
                <p className="text-sm text-gray-400">
                  스터디, 프로젝트, 멘토링을 통한 체계적이고 포괄적인 학습
                  시스템
                </p>
              </div>

              <div className="feature-card p-6 rounded-xl card-hover">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <i className="fas fa-trophy text-white"></i>
                </div>
                <h3 className="orbitron text-lg font-bold mb-2 text-green-300">
                  일관된 성과와 결과
                </h3>
                <p className="text-sm text-gray-400">
                  대회 수상, 프로젝트 성공, 취업 성과 등 검증된 실적과 경험
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* 소개 세션 */}
      <section
        id="about"
        className="py-16 bg-gradient-to-b from-transparent to-gray-900"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              TCP 소개
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Team Crazy Performance는 단순한 동아리가 아닙니다. 우리는
              개발자로서의 꿈을 현실로 만들어가는 여정을 함께하는 파트너입니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="scroll-fade">
              <h3 className="orbitron text-2xl font-bold mb-6 text-blue-300">
                우리의 가치
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check-circle text-green-400 mt-1"></i>
                  <div>
                    {/* "탁월함" h4 태그 왼쪽 정렬 - text-left 추가 */}
                    <h4 className="font-semibold mb-1 text-left">
                      Excellence (탁월함)
                    </h4>
                    <p className="text-gray-400 text-sm text-left">
                      최고 수준의 코드 품질과 개발 역량 추구
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check-circle text-green-400 mt-1"></i>
                  <div>
                    {/* "협력" h4 태그 왼쪽 정렬 - text-left 추가 */}
                    <h4 className="font-semibold mb-1 text-left">
                      Collaboration (협력)
                    </h4>
                    <p className="text-gray-400 text-sm text-left">
                      팀워크를 통한 시너지 효과 극대화
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check-circle text-green-400 mt-1"></i>
                  <div>
                    {/* "혁신" h4 태그 왼쪽 정렬 - text-left 추가 */}
                    <h4 className="font-semibold mb-1 text-left">
                      Innovation (혁신)
                    </h4>
                    <p className="text-gray-400 text-sm text-left">
                      새로운 기술과 아이디어를 통한 지속적 발전
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl">
                <h3 className="orbitron text-xl font-bold mb-4 text-center text-purple-300">
                  TCP 통계
                </h3>
                <div className="grid grid-cols-2 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold gradient-text mb-2">
                      {stats.totalMembers}+
                    </div>
                    <div className="text-sm text-gray-400">활동 회원</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold gradient-text mb-2">
                      {stats.projects}+
                    </div>
                    <div className="text-sm text-gray-400">프로젝트 완료</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold gradient-text mb-2">
                      {stats.awards}+
                    </div>
                    <div className="text-sm text-gray-400">대회 수상</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold gradient-text mb-2">
                      {stats.employmentRate}%
                    </div>
                    <div className="text-sm text-gray-400">취업 성공률</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* TCP 활동 소개 세션 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              주요 활동
            </h2>
            <p className="text-xl text-gray-300">
              TCP에서 경험할 수 있는 다양한 활동들을 소개합니다
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Competition Participation */}
            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden card-hover">
                <div className="promo-placeholder">
                  <div className="text-center">
                    <i className="fas fa-trophy text-4xl text-yellow-400 mb-4"></i>
                    <h3 className="orbitron text-lg font-bold text-yellow-300">
                      대회 참가
                    </h3>
                    <p className="text-sm text-gray-400 mt-2">
                      Competition Participation
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="orbitron text-xl font-bold mb-3 text-yellow-300">
                    대회 참가
                  </h3>
                  {/* 설명 텍스트 왼쪽 정렬 */}
                  <p className="text-gray-400 mb-4 text-left">
                    프로그래밍 대회, 해커톤, 창업 경진대회 등 다양한 대회에
                    참가하여 실력을 겨루고 경험을 쌓습니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                      ICPC
                    </span>
                    <span className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                      해커톤
                    </span>
                    <span className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                      창업경진대회
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 스터디 소개 세션 */}
            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden card-hover">
                <div className="promo-placeholder">
                  <div className="text-center">
                    <i className="fas fa-book-open text-4xl text-blue-400 mb-4"></i>
                    <h3 className="orbitron text-lg font-bold text-blue-300">
                      스터디 세션
                    </h3>
                    <p className="text-sm text-gray-400 mt-2">Study Sessions</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="orbitron text-xl font-bold mb-3 text-blue-300">
                    스터디 세션
                  </h3>
                  {/* 설명 텍스트 왼쪽 정렬 */}
                  <p className="text-gray-400 mb-4 text-left">
                    알고리즘, 웹 개발, 인공지능 등 다양한 주제의 정기 스터디를
                    통해 체계적으로 학습합니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                      알고리즘
                    </span>
                    <span className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                      웹개발
                    </span>
                    <span className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                      AI/ML
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MT 세션 */}
            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden card-hover">
                <div className="promo-placeholder">
                  <div className="text-center">
                    <i className="fas fa-users text-4xl text-green-400 mb-4"></i>
                    <h3 className="orbitron text-lg font-bold text-green-300">
                      멤버십 트레이닝
                    </h3>
                    <p className="text-sm text-gray-400 mt-2">MT Events</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="orbitron text-xl font-bold mb-3 text-green-300">
                    멤버십 트레이닝
                  </h3>
                  {/* 설명 텍스트 왼쪽 정렬 */}
                  <p className="text-gray-400 mb-4 text-left">
                    팀 빌딩, 네트워킹, 집중 코딩 캠프 등을 통해 동아리
                    구성원들과의 유대감을 형성합니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                      팀빌딩
                    </span>
                    <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                      네트워킹
                    </span>
                    <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                      코딩캠프
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-900 via-purple-900 to-pink-900">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="orbitron text-4xl md:text-5xl font-black mb-6 text-white">
              TCP와 함께 개발자의 길을 걸어보세요
            </h2>
            <p className="text-xl text-gray-200 mb-8">
              뛰어난 동료들과 함께 성장하고, 실무 경험을 쌓으며, 개발자로서의
              꿈을 현실로 만들어보세요.
            </p>
            {}
            <Link
              to="/recruitment"
              className="cta-button px-12 py-4 rounded-full text-lg font-bold orbitron text-white hover:text-black transition-colors"
            >
              <i className="fas fa-users mr-2"></i>
              지금 지원하기
            </Link>
            <p className="text-sm text-gray-300 mt-4">
              * 지원 기간: 매 학기 시작 2주 전 ~ 개강 후 1주
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;
