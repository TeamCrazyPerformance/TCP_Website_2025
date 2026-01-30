import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.svg';

function Home() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    projects: 0,
    awards: 0,
    employmentRate: 0,
  });
  const [activityImages, setActivityImages] = useState({
    competition: null,
    study: null,
    mt: null,
  });
  const [tags, setTags] = useState({
    competition: [],
    study: [],
    mt: [],
  });

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

    // 데이터 가져오기
    const fetchData = async () => {
      try {
        const [statRes, imgRes] = await Promise.all([
          fetch('/api/v1/main/statistics'),
          fetch('/api/v1/main/activity-images')
        ]);

        if (statRes.ok) {
          const data = await statRes.json();
          setStats(data);
        }

        if (imgRes.ok) {
          const data = await imgRes.json();
          setActivityImages({
            competition: data.competition,
            study: data.study,
            mt: data.mt
          });
          if (data.tags) setTags(data.tags);
        }
      } catch (error) {
        console.error('Failed to fetch main page data:', error);
      }
    };
    fetchData();

    // 컴포넌트 언마운트 시 클린업
    return () => {
      observer.disconnect(); // 옵저버 연결 해제
    };
  }, []);

  // 모달 상태 관리
  const [modalData, setModalData] = useState(null);

  const openModal = (type) => {
    if (!activityImages[type]) return;
    setModalData({
      image: activityImages[type],
      tags: tags[type] || [],
      title: type === 'competition' ? '대회 참가' : type === 'study' ? '스터디 세션' : '멤버십 트레이닝',
      engTitle: type === 'competition' ? 'Competition Participation' : type === 'study' ? 'Study Sessions' : 'MT Events'
    });
  };

  const closeModal = () => {
    setModalData(null);
  };

  return (
    <>
      {/* 이미지 모달 */}
      {modalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={closeModal}
        >
          <div
            className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <div className="relative w-full h-[60vh] rounded-t-xl bg-black group">
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors backdrop-blur-sm"
                >
                  <i className="fas fa-times"></i>
                </button>
                <div className="w-full h-full overflow-y-auto custom-scrollbar rounded-t-xl">
                  <img
                    src={modalData.image}
                    alt={modalData.title}
                    className="w-full h-auto block"
                  />
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h3 className="orbitron text-2xl md:text-3xl font-bold text-white mb-2">
                    {modalData.title}
                  </h3>
                  <p className="text-gray-400 font-medium">
                    {modalData.engTitle}
                  </p>
                </div>

                <div>
                  <h4 className="text-gray-300 font-semibold mb-3 flex items-center">
                    <i className="fas fa-tags mr-2 text-blue-400"></i>
                    관련 태그
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {modalData.tags && modalData.tags.length > 0 ? (
                      modalData.tags.map((tag, idx) => (
                        <span key={idx} className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-full text-sm">
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">등록된 태그가 없습니다.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                {activityImages.competition ? (
                  <div
                    className="h-56 w-full relative cursor-pointer group"
                    onClick={() => openModal('competition')}
                  >
                    <img
                      src={activityImages.competition}
                      alt="Competition"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-3xl transition-opacity"></i>
                    </div>
                  </div>
                ) : (
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
                )}
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
                    {tags.competition && tags.competition.length > 0 ? (
                      tags.competition.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-yellow-900 text-yellow-300 rounded-full text-xs">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-xs">태그 없음</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 스터디 소개 세션 */}
            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden card-hover">
                {activityImages.study ? (
                  <div
                    className="h-56 w-full relative cursor-pointer group"
                    onClick={() => openModal('study')}
                  >
                    <img
                      src={activityImages.study}
                      alt="Study"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-3xl transition-opacity"></i>
                    </div>
                  </div>
                ) : (
                  <div className="promo-placeholder">
                    <div className="text-center">
                      <i className="fas fa-book-open text-4xl text-blue-400 mb-4"></i>
                      <h3 className="orbitron text-lg font-bold text-blue-300">
                        스터디 세션
                      </h3>
                      <p className="text-sm text-gray-400 mt-2">Study Sessions</p>
                    </div>
                  </div>
                )}
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
                    {tags.study && tags.study.length > 0 ? (
                      tags.study.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-xs">태그 없음</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MT 세션 */}
            <div className="scroll-fade">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden card-hover">
                {activityImages.mt ? (
                  <div
                    className="h-56 w-full relative cursor-pointer group"
                    onClick={() => openModal('mt')}
                  >
                    <img
                      src={activityImages.mt}
                      alt="MT"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-3xl transition-opacity"></i>
                    </div>
                  </div>
                ) : (
                  <div className="promo-placeholder">
                    <div className="text-center">
                      <i className="fas fa-users text-4xl text-green-400 mb-4"></i>
                      <h3 className="orbitron text-lg font-bold text-green-300">
                        멤버십 트레이닝
                      </h3>
                      <p className="text-sm text-gray-400 mt-2">MT Events</p>
                    </div>
                  </div>
                )}
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
                    {tags.mt && tags.mt.length > 0 ? (
                      tags.mt.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-xs">태그 없음</span>
                    )}
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
            {/* 지원하기 버튼 수정: /recruitment 경로가 맞음 */}
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
