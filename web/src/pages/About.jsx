import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.svg';
import { stats } from '../data/stats';

function About() {
  // 아코디언 인덱스 상태 관리
  const [openAccordion, setOpenAccordion] = useState(0); // 첫 번째 아코디언 실행

  // 연도별 활동 히스토리 데이터
  const historyData = [
    {
      year: 2024,
      tag: '24',
      gradientClass: 'gradient-blue-purple', // 새로운 CSS 클래스로 변경
      title: '2024년',
      subtitle: '시스템 혁신 및 규모 확장의 해',
      achievements: [
        '내부 코드 리뷰 시스템 런칭',
        'AI 기반 학습 플랫폼 개발',
        '50명 돌파 (역대 최대 규모)',
      ],
      activities: [
        { name: '시스템 개발', type: 'project' },
        { name: 'AI/ML 스터디', type: 'study' },
        { name: '신입생 환영회', type: 'event' },
        { name: '국제 해커톤', type: 'competition' },
      ],
    },
    {
      year: 2023,
      tag: '23',
      gradientClass: 'gradient-green-blue', // 새로운 CSS 클래스로 변경
      title: '2023년',
      subtitle: '팀워크 강화 및 네트워킹 확대',
      achievements: [
        '인제 MT 성공적 개최',
        '30명 회원 달성',
        '오픈소스 프로젝트 3개 출시',
      ],
      activities: [
        { name: '인제 MT', type: 'event' },
        { name: '오픈소스 개발', type: 'project' },
        { name: '웹 개발 스터디', type: 'study' },
        { name: '창업 경진대회', type: 'competition' },
      ],
    },
    {
      year: 2022,
      tag: '22',
      gradientClass: 'gradient-yellow-red', // 새로운 CSS 클래스로 변경
      title: '2022년',
      subtitle: '대외활동 확장 및 수상 성과',
      achievements: [
        '전국 AI 해커톤 1위 수상',
        '첫 번째 대형 프로젝트 완료',
        '멘토-멘티 시스템 구축',
      ],
      activities: [
        { name: 'AI 해커톤 1위', type: 'achievement' },
        { name: '대형 프로젝트', type: 'project' },
        { name: '알고리즘 스터디', type: 'study' },
        { name: '멘토링 시스템', type: 'event' },
      ],
    },
    {
      year: 2021,
      tag: '21',
      gradientClass: 'gradient-purple-pink', // 새로운 CSS 클래스로 변경
      title: '2021년',
      subtitle: 'TCP 창립 및 기반 구축',
      achievements: [
        'TCP 동아리 공식 창립',
        '초기 멤버 15명 모집',
        '첫 번째 스터디 그룹 운영',
      ],
      activities: [
        { name: '동아리 창립', type: 'event' },
        { name: '기초 스터디', type: 'study' },
        { name: '첫 프로젝트', type: 'project' },
        { name: '창립 파티', type: 'event' },
      ],
    },
  ];

  useEffect(() => {
    // 스크롤 페이드 인 애니메이션
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // 한 번 실행 후 관찰 해제
        }
      });
    }, observerOptions);

    document.querySelectorAll('.scroll-fade').forEach((el) => {
      observer.observe(el);
    });

    // 카운트 업 애니메이션
    const counterObserverOptions = {
      threshold: 0.5, // 카운터 애니매이션 시작 임계값
    };

    const counterObserver = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counter = entry.target;
            const originalText = counter.textContent;
            const target = parseInt(originalText.replace(/[^0-9]/g, ''));
            const suffix = originalText.replace(/[0-9]/g, '');

            if (isNaN(target)) return;

            let startTime = null;
            const duration = 2000; // 애니메이션 지속 시간

            const animate = (timestamp) => {
              if (!startTime) startTime = timestamp;
              const progress = timestamp - startTime;
              const current = Math.min(
                Math.floor((progress / duration) * target),
                target
              );

              counter.textContent = current + suffix;

              if (progress < duration) {
                requestAnimationFrame(animate);
              } else {
                counter.textContent = originalText; // 애니메이션 완료 후 원래 텍스트로 복원
              }
            };

            requestAnimationFrame(animate);
            observerInstance.unobserve(counter); // 한 번 실행 후 관찰 해제
          }
        });
      },
      counterObserverOptions
    );

    document.querySelectorAll('.counter').forEach((counter) => {
      counterObserver.observe(counter);
    });

    // 컴포넌트 언마운트 시 클린업
    return () => {
      observer.disconnect(); // IntersectionObserver 연결 해제
      counterObserver.disconnect(); // Counter IntersectionObserver 연결 해제
    };
  }, []); // 빈 배열을 의존성으로 설정하여 컴포넌트가 마운트될 때만 실행

  // 아코디언 토글 함수 (React State를 활용)
  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index); // 같은 것을 클릭하면 닫고, 다르면 열기
  };

  return (
    <>
      <section className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="orbitron text-5xl md:text-6xl font-black mb-4">
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
          </div>
        </div>
      </section>

      <section className="py-12">
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
                    {/* "탁월함" h4 태그 왼쪽 정렬 */}
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
                    {/* "협력" h4 태그 왼쪽 정렬 */}
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
                    {/* "혁신" h4 태그 왼쪽 정렬 */}
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
              <h3 className="orbitron text-2xl font-bold mb-6 text-purple-300">
                TCP의 미션
              </h3>
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl">
                {/* "TCP의 미션" p 태그 왼쪽 정렬 */}
                <p className="text-gray-300 leading-relaxed text-left">
                  TCP는 기술적 탁월성과 창의적 엔지니어링 프로젝트에 중점을 두는
                  엘리트 소규모 대학 개발자 동아리입니다. 우리는 실제 소프트웨어
                  및 하드웨어 개발을 통해 실무 경험을 쌓고, 업계 선도 기업으로의
                  진출을 목표로 합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gradient-to-b from-transparent to-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              현재 현황
            </h2>
            <p className="text-xl text-gray-300">
              TCP의 성장과 성과를 한눈에 확인하세요
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.foundingYear}
              </div>
              <div className="text-sm text-gray-400">창립년도</div>
              <i className="fas fa-calendar-alt text-blue-400 text-2xl mt-3"></i>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.totalMembers}+
              </div>
              <div className="text-sm text-gray-400">
                총 멤버수 (활동 + 졸업생)
              </div>
              <i className="fas fa-users text-purple-400 text-2xl mt-3"></i>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.studyGroups}+
              </div>
              <div className="text-sm text-gray-400">기술 스터디 그룹</div>
              <i className="fas fa-book text-green-400 text-2xl mt-3"></i>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.awards}+
              </div>
              <div className="text-sm text-gray-400">국내외 대회 수상</div>
              <i className="fas fa-trophy text-yellow-400 text-2xl mt-3"></i>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.projects}+
              </div>
              <div className="text-sm text-gray-400">
                프로젝트 완료 (내부 + 오픈소스)
              </div>
              <i className="fas fa-code-branch text-pink-400 text-2xl mt-3"></i>
            </div>

            <div className="stat-card">
              <div className="text-3xl font-bold gradient-text mb-2 counter">
                {stats.employmentRate}%
              </div>
              <div className="text-sm text-gray-400">졸업생 IT 취업률</div>
              <i className="fas fa-briefcase text-cyan-400 text-2xl mt-3"></i>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              연도별 활동 히스토리
            </h2>
            <p className="text-xl text-gray-300">
              TCP의 성장 과정과 주요 마일스톤을 확인하세요
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* 아코디언 컴포넌트 */}
            {historyData.map((data, index) => (
              <div className="accordion-item" key={data.year}>
                <div
                  className={`accordion-header ${openAccordion === index ? 'active' : ''}`}
                  onClick={() => toggleAccordion(index)}
                >
                  <div className="flex items-center space-x-4">
                    {/* 연도 숫자를 포함하는 div에 Tailwind gradient 클래스 적용 */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${data.gradientClass}`}
                    >
                      <span className="orbitron font-bold text-white text-left">
                        {data.tag}
                      </span>{' '}
                      {/* text-left 추가 */}
                    </div>
                    {/* 연도 제목 (h3)과 부제목 (p)을 포함하는 div에 text-left 추가 */}
                    <div className="text-left">
                      <h3 className="orbitron text-xl font-bold">
                        {data.title}
                      </h3>
                      <p className="text-sm text-gray-400">{data.subtitle}</p>
                    </div>
                  </div>
                  <i
                    className={`fas fa-chevron-down accordion-icon ${openAccordion === index ? 'rotate' : ''}`}
                  ></i>
                </div>
                <div
                  className={`accordion-content ${openAccordion === index ? 'active' : ''}`}
                  id={`accordion-${index}`}
                >
                  <div className="accordion-body">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4
                          className={`font-semibold mb-3 ${data.year === 2024 ? 'text-blue-300' : data.year === 2023 ? 'text-green-300' : data.year === 2022 ? 'text-yellow-300' : 'text-purple-300'}`}
                        >
                          주요 성과
                        </h4>
                        <ul className="space-y-2 text-sm">
                          {data.achievements.map((achievement, i) => (
                            <li key={i} className="flex items-center space-x-2">
                              {achievement.includes('수상') ? (
                                <i className="fas fa-trophy text-yellow-400"></i>
                              ) : achievement.includes('창립') ? (
                                <i className="fas fa-star text-purple-400"></i>
                              ) : (
                                <i className="fas fa-check text-green-400"></i>
                              )}
                              <span>{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        {/* 주요 활동 h4 태그 색상 변경 로직 유지, text-left 추가 */}
                        <h4
                          className="font-semibold mb-3 text-left"
                          style={{
                            color:
                              data.year === 2024
                                ? 'var(--accent-purple)'
                                : data.year === 2023
                                  ? 'var(--accent-blue)'
                                  : data.year === 2022
                                    ? 'var(--accent-pink)'
                                    : 'var(--accent-green)',
                          }}
                        >
                          주요 활동
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {data.activities.map((activity, i) => (
                            <span
                              key={i}
                              className={`activity-tag tag-${activity.type}`}
                            >
                              {activity.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-900 via-purple-900 to-pink-900">
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

export default About;
