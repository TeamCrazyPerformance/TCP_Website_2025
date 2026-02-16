import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';
import RecruitStudyModal from '../components/modals/RecruitStudyModal';

function Study() {
  const navigate = useNavigate();

  const [studies, setStudies] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [hasYearInit, setHasYearInit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecruitModalOpen, setIsRecruitModalOpen] = useState(false);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    const user = localStorage.getItem('auth_user');
    if (!user) return false;
    try {
      const parsed = JSON.parse(user);
      return parsed.role === 'ADMIN';
    } catch {
      return false;
    }
  }, []);

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

  const handleStudyClick = (studyId) => {
    navigate(`/study/${studyId}`);
  };

  const handleOpenRecruit = () => {
    setIsRecruitModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseRecruit = () => {
    setIsRecruitModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleAddStudy = (newStudy) => {
    setStudies(prev => [newStudy, ...prev]);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchStudies = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet('/api/v1/study');
        const mapped = (data || []).map((study) => ({
          id: study.id,
          year: study.start_year,
          title: study.study_name,
          period: `${study.start_year}년`,
          description: study.study_description,
          tags: ['스터디'],
        }));
        if (isMounted) {
          setStudies(mapped);
          setErrorMessage('');
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '스터디 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStudies();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasYearInit || studies.length === 0) return;
    const currentYear = new Date().getFullYear().toString();
    const hasCurrent = studies.some(
      (study) => study.year.toString() === currentYear
    );
    setSelectedYear(hasCurrent ? currentYear : 'all');
    setHasYearInit(true);
  }, [studies, hasYearInit]);

  useEffect(() => {
    const observerOptions = {
      threshold: 0,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const scrollFadeElements = document.querySelectorAll('.scroll-fade');
    scrollFadeElements.forEach((el) => {
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [selectedYear, studies]);

  const filteredStudies = useMemo(() => {
    return selectedYear === 'all'
      ? studies
      : studies.filter((study) => study.year?.toString() === selectedYear);
  }, [studies, selectedYear]);

  filteredStudies.sort((a, b) => {
    return (b.year || 0) - (a.year || 0);
  });

  const getTagClassName = (tagType) => {
    switch (tagType) {
      case '알고리즘':
      case '코딩테스트':
      case '심화':
      case 'Java':
      case '프로그래밍':
      case 'C언어':
      case '입문':
      case '자료구조':
        return 'tag-blue';
      case '웹개발':
      case '풀스택':
      case 'Next.js':
      case '모바일':
      case 'iOS':
      case 'Swift':
      case '백엔드':
      case 'Spring':
      case '프론트엔드':
      case 'React':
        return 'tag-purple';
      case 'DevOps':
      case '클라우드':
      case 'Kubernetes':
      case '데이터분석':
      case '파이썬':
      case '초급':
        return 'tag-green';
      case 'AI':
      case '머신러닝':
      case '생성형AI':
      case '데이터베이스':
      case 'SQL':
        return 'tag-yellow';
      case '게임개발':
      case 'Unity':
      case 'C#':
        return 'tag-red';
      default:
        return 'tag-gray';
    }
  };

  return (
    <>
      <section className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 via-blue-400 to-purple-400 flex items-center justify-center">
                <i className="fas fa-book-open text-white text-3xl"></i>
              </div>
              <h1 className="orbitron text-5xl md:text-7xl font-black mb-4">
                <span className="gradient-text">TCP Study</span>
              </h1>
              <p className="orbitron text-xl md:text-2xl text-gray-300 mb-6">
                다른 TCP 부원들과 함께 성장해요
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                스터디를 개설하여 자신의 지식을 나누고 스터디에 참여하여 함께 성장해 보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="study-list"
        className="py-16 bg-gradient-to-b from-transparent to-gray-900"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 space-y-4 md:space-y-0">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text">
              스터디 목록
            </h2>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <button
                  onClick={handleOpenRecruit}
                  className="cta-button px-6 py-2 rounded-lg text-sm font-bold text-white"
                >
                  <i className="fas fa-plus mr-2" />
                  스터디 개설하기
                </button>
              )}
              <div className="relative w-full md:w-auto">
                <label htmlFor="year-select" className="sr-only">
                  년도 선택
                </label>
                <select
                  id="year-select"
                  className="w-full md:w-48 bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-accent-blue focus:outline-none"
                  value={selectedYear}
                  onChange={handleYearChange}
                >
                  <option value="all">전체 년도</option>
                  {[...new Set(studies.map((study) => study.year))]
                    .sort((a, b) => b - a)
                    .map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}년
                      </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <i className="fas fa-chevron-down"></i>
                </div>
              </div>
            </div>
          </div>

          <div
            id="study-container"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {isLoading && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p className="text-xl">스터디 정보를 불러오는 중...</p>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="col-span-full text-center py-12 text-red-400">
                <p className="text-xl">{errorMessage}</p>
              </div>
            )}
            {!isLoading && !errorMessage && filteredStudies.length > 0 ? (
              filteredStudies.map((study) => (
                <div
                  key={study.id}
                  className="study-item p-6 rounded-xl card-hover scroll-fade"
                  onClick={() => handleStudyClick(study.id)}
                >
                  <h3 className="orbitron text-xl font-bold mb-2 text-white text-left">
                    {study.title}
                  </h3>
                  <p className="text-gray-400 mb-2 text-left">{study.period}</p>
                  <p className="text-sm text-gray-500 text-left">
                    {(study.description || '').substring(0, 80)}...
                  </p>
                  <div className="flex flex-wrap mt-3">
                    {(study.tags || []).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`tag ${getTagClassName(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div
                id="no-studies-message"
                className="col-span-full text-center py-12 text-gray-500"
              >
                <i className="fas fa-exclamation-circle text-5xl mb-4"></i>
                <p className="text-xl">
                  해당 년도에는 등록된 스터디가 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <RecruitStudyModal
        isOpen={isRecruitModalOpen}
        onClose={handleCloseRecruit}
        onAddStudy={handleAddStudy}
      />
    </>
  );
}

export default Study;

