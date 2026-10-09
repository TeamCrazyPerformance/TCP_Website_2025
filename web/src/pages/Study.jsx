import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import RecruitStudyModal from '../components/modals/RecruitStudyModal';
import PublicPageHero from '../components/public/PublicPageHero';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { parseTags, tagColorClass } from '../utils/helpers';
import { tagColorStyle } from '../utils/tagPalette';

const STUDY_STATUSES = ['upcoming', 'ongoing', 'completed', 'unknown'];

const STUDY_GROUPS = [
  {
    id: 'active',
    title: '예정·진행 중인 스터디',
    statuses: ['upcoming', 'ongoing'],
    emptyMessage: '선택한 연도에 예정·진행 중인 스터디가 없습니다.',
  },
  {
    id: 'completed',
    title: '종료된 스터디',
    statuses: ['completed'],
    emptyMessage: '선택한 연도에 종료된 스터디가 없습니다.',
  },
  {
    id: 'unknown',
    title: '기간 미확인 스터디',
    statuses: ['unknown'],
    description: '진행 기간을 확인할 수 없는 스터디입니다.',
    hideWhenEmpty: true,
  },
];

function StudyCard({ study }) {
  return (
    <Link
      to={`/study/${study.id}`}
      className="study-item study-list-card p-6 rounded-xl card-hover scroll-fade"
    >
      <div className="study-card-title-row mb-2">
        <h4 className="orbitron text-xl font-bold text-white text-left">
          {study.title}
        </h4>
      </div>
      <div className="study-card-meta-row">
        <p className="study-card-period text-gray-400 text-left">{study.period}</p>
        {study.is_public && (
          <span className="study-card-visibility inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-500 bg-opacity-20 text-green-300 whitespace-nowrap">
            <i className="fas fa-unlock-alt mr-1" aria-hidden="true"></i>
            공개 스터디
          </span>
        )}
      </div>
      <p className="study-card-summary text-sm text-gray-500 text-left">
        {(study.description || '').substring(0, 80)}...
      </p>
      <div className="study-card-tags mt-3">
        {(study.tags || []).map((tag, tagIndex) => (
          <span
            key={tagIndex}
            className={tagColorClass(tag)}
            style={tagColorStyle(tag)}
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

function Study() {
  const normalizeBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

  const [studies, setStudies] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [hasYearInit, setHasYearInit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecruitModalOpen, setIsRecruitModalOpen] = useState(false);

  // Check if current user is logged in (MEMBER or ADMIN can create studies)
  const isLoggedIn = useMemo(() => {
    const user = localStorage.getItem('auth_user');
    if (!user) return false;
    try {
      const parsed = JSON.parse(user);
      return parsed.role === 'MEMBER' || parsed.role === 'ADMIN';
    } catch {
      return false;
    }
  }, []);

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

  const handleOpenRecruit = () => {
    setIsRecruitModalOpen(true);
  };

  const handleCloseRecruit = () => {
    setIsRecruitModalOpen(false);
  };

  const handleAddStudy = (newStudy) => {
    setStudies(prev => [
      { ...newStudy, status: STUDY_STATUSES.includes(newStudy.status) ? newStudy.status : 'unknown' },
      ...prev,
    ]);
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
          period: study.period || `${study.start_year}년`,
          description: study.study_description || '',
          tags: parseTags(study.tag).length ? parseTags(study.tag) : ['스터디'],
          is_public: normalizeBoolean(study.is_public),
          status: STUDY_STATUSES.includes(study.status) ? study.status : 'unknown',
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
      (study) => study.year?.toString() === currentYear
    );
    setSelectedYear(hasCurrent ? currentYear : 'all');
    setHasYearInit(true);
  }, [studies, hasYearInit]);

  const filteredStudies = useMemo(() => {
    const visibleStudies = selectedYear === 'all'
      ? [...studies]
      : studies.filter((study) => study.year?.toString() === selectedYear);

    return visibleStudies.sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [studies, selectedYear]);

  const groupedStudies = useMemo(() => STUDY_GROUPS
    .map((group) => ({
      ...group,
      studies: filteredStudies.filter((study) => group.statuses.includes(study.status)),
    }))
    .filter((group) => !group.hideWhenEmpty || group.studies.length > 0),
  [filteredStudies]);

  useScrollReveal(
    '.scroll-fade',
    `${selectedYear}:${filteredStudies.map((study) => `${study.id}:${study.status}`).join(',')}`,
  );


  return (
    <>
      <PublicPageHero
        icon={<i className="fas fa-book-open text-white text-3xl"></i>}
        iconClassName="bg-gradient-to-br from-green-400 via-blue-400 to-purple-400"
        title="TCP Study"
        lead="같이 탐구하고, 함께 성장할 스터디를 찾아보세요."
        description="스터디를 개설해 자신의 지식을 나누고, 스터디에 참여하여 함께 성장할 수 있어요."
      />

      <section
        id="study-list"
        className="py-16 bg-gradient-to-b from-transparent to-gray-900"
      >
        <div className="container site-content-container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 space-y-4 md:space-y-0">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text">
              스터디 목록
            </h2>
            <div className="flex items-center gap-4">
              {isLoggedIn && (
                <button
                  onClick={handleOpenRecruit}
                  className="cta-button study-create-button rounded-lg text-sm font-bold text-white"
                >
                  <i className="fas fa-plus mr-2" />
                  스터디 개설하기
                </button>
              )}
              <div className="study-year-filter relative">
                <label htmlFor="year-select" className="sr-only">
                  년도 선택
                </label>
                <select
                  id="year-select"
                  className="study-year-select appearance-none w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-3 pr-8 text-white focus:ring-2 focus:ring-accent-blue focus:outline-none cursor-pointer"
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
            className="study-status-groups"
          >
            {isLoading && (
              <div role="status" className="text-center py-12 text-gray-500">
                <p className="text-xl">스터디 정보를 불러오는 중...</p>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div role="alert" className="text-center py-12 text-red-400">
                <p className="text-xl">{errorMessage}</p>
              </div>
            )}
            {!isLoading && !errorMessage && filteredStudies.length > 0 && (
              groupedStudies.map((group) => (
                <section key={group.id} aria-labelledby={`study-group-${group.id}`}>
                  <div className="study-group-heading">
                    <h3 id={`study-group-${group.id}`}>
                      {group.title}
                    </h3>
                    <span className="study-group-count">{group.studies.length}개</span>
                  </div>
                  {group.description && (
                    <p className="study-group-description">{group.description}</p>
                  )}
                  {group.studies.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {group.studies.map((study) => (
                        <StudyCard key={study.id} study={study} />
                      ))}
                    </div>
                  ) : (
                    <p className="study-group-empty">{group.emptyMessage}</p>
                  )}
                </section>
              ))
            )}
            {!isLoading && !errorMessage && filteredStudies.length === 0 && (
              <div
                id="no-studies-message"
                className="text-center py-12 text-gray-500"
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
