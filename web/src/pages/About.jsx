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
      year: 2025,
      tag: '25',
      gradientClass: 'gradient-purple-pink',
      title: '2025년',
      subtitle: '실전 중심 스터디와 프로젝트 확장의 해',
      highlights: [
        '동아리 연합 해커톤 진행 (TCP-EC-NL)',
        'TCP_WEBSITE_2025 프로젝트 진행',
        'CS 현직자 세미나',
      ],
      studies: [
        '웹 개발 스터디 (HTML/CSS/JS)',
        '보안 스터디 (Dreamhack)',
        'C 스터디',
        '안드로이드 스터디 (with EC)',
        '블록체인 스터디',
      ],
      activities: [
        '개발자 튜토리얼',
        '동아리 연합 해커톤 진행 (TCP-EC-NL)',
        'CS 현직자 세미나',
      ],
    },
    {
      year: 2024,
      tag: '24',
      gradientClass: 'gradient-blue-purple',
      title: '2024년',
      subtitle: '수준별 학습 체계와 대외 성과의 해',
      highlights: [
        '2024 제 12회 K-hackathon 본선 진출',
        '2024 MATLAB 대학생 AI 경진대회 본선 진출',
        '2024 동계 SCI 음성인식 부트캠프 최우수상 수상',
        'CS 현직자 세미나 진행 (토스페이, 와드, 와이즈라이트, 카카오 엔터 등)',
        'TCP주최 해커톤 TCPC 2024 진행',
        '동아리 MT',
      ],
      studies: [
        '수준별 코스 (스타터, 재활, 부스터)',
        '백엔드 스터디',
        '웹 개발 스터디',
        '알고리즘 스터디',
        '블록체인 스터디',
      ],
      activities: [
        'CS 현직자 세미나 진행',
        'TCP주최 해커톤 TCPC 2024 진행',
        '동아리 MT',
      ],
    },
    {
      year: 2023,
      tag: '23',
      gradientClass: 'gradient-green-blue',
      title: '2023년',
      subtitle: '조별 프로젝트와 해커톤 중심 성장의 해',
      highlights: [
        '2023 Glitch 해커톤 참여',
        'Seoul Web3 Festival 2023 해커톤 참여',
        "SW개발 공모전 '피우다 프로젝트' 본선 진출",
        '비욘드 바운더리스 해커톤 참여 및 본선 진출',
        '관광데이터 활용 공모전 참여 및 장려상 수상',
        '대구 광역시 ABB 해커톤 참여 및 최우수상 수상',
        '현직자 선배님들과의 만남과 강연 (책걸이)',
        'TCP주최 해커톤 TCPC 2023 진행',
        '동아리 MT',
      ],
      studies: [
        '게임 (Unity, Unreal) 스터디',
        '백엔드 스터디',
        '프로그래밍 언어 (C++, Java) 스터디',
        '수준별 알고리즘 스터디',
        '컴퓨터과학 (CS) 지식 스터디',
        '한 주 한 글 스터디',
        '알고리즘 조별 스터디',
        '개발 관련 독서 스터디',
      ],
      activities: [
        'JS/TS 조별 스터디 및 프로젝트',
        '파이썬 조별 스터디 및 프로젝트',
        'Java조 조별 스터디 및 프로젝트',
        '현직자 선배님들과의 만남과 강연 (책걸이)',
        'TCP주최 해커톤 TCPC 2023 진행',
        '동아리 MT',
      ],
    },
    {
      year: 2022,
      tag: '22',
      gradientClass: 'gradient-yellow-red',
      title: '2022년',
      subtitle: '기초 스터디 확대와 인프라 구축의 해',
      highlights: [
        '컴공 연합 유니티 게임 개발 프로젝트',
        '실습장비 대여사업 (종료)',
      ],
      studies: [
        '유니티 스터디',
        '백엔드 스터디',
        '웹 크롤링- 웹 기초',
        '알고리즘 스터디',
        '웹 프론트 스터디',
        '한 주 한 글 스터디',
      ],
      activities: ['컴공 연합 유니티 게임 개발 프로젝트'],
      infra: [
        'iOS 개발을 위한 맥북 (2대)',
        '공유 모니터 (DELL UltraSharp U2722DE 6대)',
        '딥러닝 워크스테이션 (AMD R9 5950X, DDR4 128G, RTX 3090)',
        '동아리 서버',
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
              <p className="orbitron text-lg text-gray-400 max-w-2xl mx-auto">
                다양한 개발자들의 모임, TCP는 뛰어난 열정을 가진 학생 개발자들이 모여
                함께 성장하고 도전하는 서울과학기술대학교 컴퓨터공학 동아리입니다.
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
            <p className="orbitron text-xl text-gray-300 max-w-3xl mx-auto">
              Team Crazy Performance는 다양한 사람들을 연결하고 함께 성장하는
              동아리입니다.
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
                    {/* "포용" h4 태그 왼쪽 정렬 */}
                    <h4 className="orbitron font-semibold mb-1 text-left">
                      포용 (Inclusion)
                    </h4>
                    <p className="orbitron text-gray-400 text-sm text-left">
                      다양한 배경과 경험을 가진 구성원들이 서로 존중하며 함께 성장하는 환경
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check-circle text-green-400 mt-1"></i>
                  <div>
                    {/* "탐구" h4 태그 왼쪽 정렬 */}
                    <h4 className="orbitron font-semibold mb-1 text-left">
                      탐구 (Inquiry)
                    </h4>
                    <p className="orbitron text-gray-400 text-sm text-left">
                      새로운 기술과 아이디어를 향한 끊임없는 호기심과 탐구
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <i className="fas fa-check-circle text-green-400 mt-1"></i>
                  <div>
                    {/* "협력" h4 태그 왼쪽 정렬 */}
                    <h4 className="orbitron font-semibold mb-1 text-left">
                      협력 (Collaboration)
                    </h4>
                    <p className="orbitron text-gray-400 text-sm text-left">
                      함께 문제를 해결하고 성과를 만들어가는 과정
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
                <p className="orbitron text-gray-300 leading-relaxed text-left">
                  TCP는 특정 분야에 국한되지 않은 개발자들이 모여,
                  공통된 관심사를 중심으로 스터디와 프로젝트·대회에 참여하며
                  서로의 탐구와 협력을 통해 함께 성장하는 것을 목표로 합니다.
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
            <p className="orbitron text-xl text-gray-300">
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
            <p className="orbitron text-xl text-gray-300">
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
                        <h4 className="history-section-title history-section-title-achievement">
                          핵심 성과
                        </h4>
                        <ul className="space-y-2 text-sm text-left">
                          {data.highlights.map((achievement, i) => (
                            <li key={i} className="history-highlight-item">
                              <i className="fas fa-award"></i>
                              <span>{achievement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="history-section-title history-section-title-study">
                          스터디/활동
                        </h4>
                        <div className="history-subsection">
                          <div className="history-subsection-label">
                            <i className="fas fa-book-open"></i> 스터디
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {data.studies.map((study, i) => (
                              <span key={i} className="activity-tag history-tag-study-strong">
                                {study}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="history-subsection">
                          <div className="history-subsection-label">
                            <i className="fas fa-users"></i> 주요 활동
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {data.activities.map((activity, i) => (
                              <span key={i} className="activity-tag tag-event">
                                {activity}
                              </span>
                            ))}
                          </div>
                        </div>
                        {data.infra?.length ? (
                          <div className="history-infra-card text-left">
                            <div className="history-infra-title">
                              <i className="fas fa-server"></i> 인프라/운영 (참고)
                            </div>
                            <ul className="history-infra-list">
                              {data.infra.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
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
              TCP에서 개발자의 길을 걸어보세요
            </h2>
            <p className="text-xl text-gray-200 mb-8">
              뛰어난 동료들과 함께 성장하고, 협업 경험을 쌓으며, 자신의
              꿈을 현실로 만들어보세요.
            </p>
            { }
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
