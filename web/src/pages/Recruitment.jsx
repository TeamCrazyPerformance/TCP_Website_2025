import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faTrash,
  faTimes,
  faPaperPlane,
  faRocket,
  faGraduationCap,
  faTrophy,
  faProjectDiagram,
  faCode,
  faGlobe,
  faMobileAlt,
  faBrain,
  faUsers,
  faCalendarAlt,
  faUserFriends,
  faAward,
  faFire,
  faBook,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { apiPost, apiGet } from '../api/client';
import { formatBirthDate } from '../utils/dateFormatter';
import PublicPageHero from '../components/public/PublicPageHero';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  buildRecruitmentApplication,
  formatPhoneNumber,
  hasValidApplicationDates,
  validatePhoneNumber,
} from '../utils/recruitmentApplication';
import '../styles/recruitmentApplication.css';

let applicationEntryId = 0;
const createApplicationEntry = () => ({ id: `application-entry-${applicationEntryId++}` });

function Recruitment() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState(() => [createApplicationEntry()]);
  const [awards, setAwards] = useState(() => [createApplicationEntry()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecruitmentActive, setIsRecruitmentActive] = useState(false);
  const [recruitmentPeriod, setRecruitmentPeriod] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [studentNumberError, setStudentNumberError] = useState('');
  const applicationFormRef = useRef(null);

  useScrollReveal();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await apiGet('/api/v1/recruitment/status');
        setIsRecruitmentActive(data.is_application_enabled);

        if (data.start_date && data.end_date) {
          const formatDate = (dateString) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}.${month}.${day}`;
          };
          setRecruitmentPeriod(
            `${formatDate(data.start_date)} ~ ${formatDate(data.end_date)}`
          );
        } else {
          setRecruitmentPeriod('');
        }
      } catch (error) {
        console.error('Failed to check recruitment status:', error);
        setIsRecruitmentActive(false);
        setRecruitmentPeriod('');
      }
    };
    checkStatus();

  }, []);

  const openModal = () => {
    if (!isRecruitmentActive) {
      alert('현재 모집 기간이 아닙니다.');
      return;
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const requestCloseModal = () => {
    const form = applicationFormRef.current;
    const inputs = form ? form.querySelectorAll('input, textarea, select') : [];
    const hasContent = Array.from(inputs).some((element) => {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked;
      }

      return element.value && element.value.trim();
    });

    if (
      hasContent &&
      !window.confirm('작성 중인 내용이 있습니다. 정말 닫으시겠습니까?')
    ) {
      return;
    }

    closeModal();
  };

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;

    const privacyAgreement = form.elements.privacyAgreement;
    if (!privacyAgreement.checked) {
      alert('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('올바른 전화번호 형식이 아닙니다. (예: 010-1234-5678)');
      return;
    }

    const formData = new FormData(form);
    const application = buildRecruitmentApplication(formData, {
      studentNumber,
      phoneNumber,
    });

    if (studentNumberError || !studentNumber || studentNumber.length !== 8) {
      alert('8자리 학번을 정확히 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    if (phoneError || !phoneNumber) {
      alert('올바른 전화번호를 입력해주세요.');
      setIsSubmitting(false);
      return;
    }

    if (!hasValidApplicationDates(application)) {
      alert('연도는 9999년까지만 입력 가능합니다.');
      setIsSubmitting(false);
      return;
    }

    try {
      setIsSubmitting(true);
      await apiPost('/api/v1/recruitment', application.payload);
      alert('지원서가 성공적으로 제출되었습니다! 검토 후 연락드리겠습니다.');
      form.reset();
      setProjects([createApplicationEntry()]);
      setAwards([createApplicationEntry()]);
      setPhoneNumber('');
      setPhoneError('');
      setStudentNumber('');
      setStudentNumberError('');
      closeModal();
    } catch (error) {
      alert(error.message || '지원서 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addProject = () => {
    setProjects((currentProjects) => [...currentProjects, createApplicationEntry()]);
  };

  const removeProject = (index) => {
    setProjects((currentProjects) =>
      currentProjects.filter((_, projectIndex) => projectIndex !== index)
    );
  };

  const addAward = () => {
    setAwards((currentAwards) => [...currentAwards, createApplicationEntry()]);
  };

  const removeAward = (index) => {
    setAwards((currentAwards) =>
      currentAwards.filter((_, awardIndex) => awardIndex !== index)
    );
  };

  return (
    <main className="public-page-unified-background">
      <PublicPageHero
        icon={<FontAwesomeIcon icon={faRocket} className="text-white text-3xl" />}
        iconClassName="bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400"
        title="Team Crazy Performance"
        titleClassName="recruitment-hero-title"
        lead={(
          <>
            TCP에서 뛰어난 동료들과 협업하고,
            <br />
            함께 성장하여 자신의 꿈을 현실로 만들어보세요.
          </>
        )}
        action={(
          <button
            id="heroApplyBtn"
            onClick={openModal}
            disabled={!isRecruitmentActive}
            className={`recruitment-hero-action cta-button px-12 py-4 rounded-full text-lg font-bold orbitron transition-colors ${!isRecruitmentActive ? 'opacity-50 cursor-not-allowed bg-gray-600 text-white' : 'primary-cta-text'}`}
          >
            <FontAwesomeIcon icon={faRocket} className="mr-2" />
            {isRecruitmentActive ? '지금 지원하기' : '모집 기간이 아닙니다'}
          </button>
        )}
      />

      {/* About TCP 세션 */}
      <section
        id="about"
        className="py-16"
      >
        <div className="container site-content-container mx-auto px-4">
          <div className="text-center">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              Change Starts with TCP
              </h2>
            <div className="max-w-4xl mx-auto">
              <p className="recruitment-about-summary orbitron text-xl text-gray-300">
                TCP (Team Crazy Performance)는,
                <br />
                서울과학기술대학교 컴퓨터공학과 학술동아리로,
                <br />
                뛰어난 동료와 같이 탐구하고, 함께 성장하는 것을 목표로 합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 지원자 세션 */}
      <section id="who-should-apply" className="recruitment-candidate-section">
        <div className="container site-content-container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="orbitron text-3xl font-bold gradient-text mb-8 text-center">
              TCP는 이런 사람을 찾고 있어요
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="scroll-fade h-full">
                <div className="feature-card p-8 rounded-2xl h-full flex flex-col">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faFire}
                      className="text-white text-2xl"
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-4 text-red-300 text-center">
                    열정적인 학습자
                  </h3>
                  <p className="text-gray-300 text-center flex-1">
                    스스로를 개선하고, 성장하고자 하는 열정을 가진 학습자를 찾고 있어요.
                    같이 배우고, 함께 발전하는 것을 중요하게 생각해요.
                  </p>
                </div>
              </div>
              <div className="scroll-fade h-full">
                <div className="feature-card p-8 rounded-2xl h-full flex flex-col">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                      className="text-white text-2xl"
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-4 text-blue-300 text-center">
                    서울과학기술대학교 학생
                  </h3>
                  <p className="text-gray-300 text-center flex-1">
                    서울과학기술대학교의 모든 학생들을 환영해요. 전공에
                    관계없이 개발에 대한 열정과 사랑이 있다면 누구나 지원할 수
                    있어요.
                  </p>
                </div>
              </div>
              <div className="scroll-fade h-full">
                <div className="feature-card p-8 rounded-2xl h-full flex flex-col">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faBook}
                      className="text-white text-2xl"
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-4 text-purple-300 text-center">
                    실전 경험자
                  </h3>
                  <p className="text-gray-300 text-center flex-1">
                    실무, 대회, 프로젝트 등에서 얻은 경험을 공유하며,
                    함께 배우고 도전하는 분위기를 만들어갈 수 있는 사람을 찾아요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TCP 활동 세션 */}
      <section
        id="what-we-do"
        className="py-16"
      >
        <div className="container site-content-container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl font-bold gradient-text mb-8">
              TCP는 이런 활동을 해요
            </h2>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* 2024-2025 성과 */}
            <div className="mb-12 scroll-fade">
              <h3 className="orbitron text-2xl font-bold mb-6 text-center text-blue-300">
                2024-2025 주요 성과
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="achievement-card">
                  <div className="text-center">
                    <FontAwesomeIcon
                      icon={faTrophy}
                      className="text-3xl text-yellow-400 mb-4"
                    />
                    <h4 className="orbitron font-bold text-lg mb-2">
                      대회/해커톤 성과
                    </h4>
                    <p className="text-gray-300 text-sm">
                      • 동아리 연합 해커톤 진행 (TCP-EC-NL)
                      <br />
                      • TCPC 2024 진행
                      <br />
                      • 2024 제 12회 K-hackathon 본선 진출
                      <br />
                      • 2024 동계 SCI 음성인식 부트캠프 최우수상 수상
                    </p>
                  </div>
                </div>
                <div className="achievement-card">
                  <div className="text-center">
                    <FontAwesomeIcon
                      icon={faProjectDiagram}
                      className="text-3xl text-green-400 mb-4"
                    />
                    <h4 className="orbitron font-bold text-lg mb-2">
                      스터디 운영
                    </h4>
                    <p className="text-gray-300 text-sm">
                      • 웹 개발 스터디 (HTML/CSS/JS)
                      <br />
                      • 보안 스터디 (Dreamhack)
                      <br />
                      • 백엔드 스터디
                      <br />
                      • 알고리즘 스터디
                      <br />
                      • 블록체인 스터디 등
                    </p>
                  </div>
                </div>
                <div className="achievement-card">
                  <div className="text-center">
                    <FontAwesomeIcon
                      icon={faBook}
                      className="text-3xl text-purple-400 mb-4"
                    />
                    <h4 className="orbitron font-bold text-lg mb-2">
                      세미나·커뮤니티 활동
                    </h4>
                    <p className="text-gray-300 text-sm">
                      • CS 현직자 세미나 진행
                      <br />
                      • 개발자 튜토리얼 운영 (신입/1학년 대상)
                      <br />• 동아리 MT 및 멘토/멘티 프로그램
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2024-2025 스터디 활동 */}
            <div className="scroll-fade">
              <h3 className="orbitron text-2xl font-bold mb-6 text-center text-purple-300">
                2024-2025 스터디 활동
              </h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="feature-card p-6 rounded-2xl">
                  <h4 className="orbitron font-bold text-lg mb-4 text-blue-300 text-left">
                    기술 스터디
                  </h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faCode}
                        className="text-blue-400"
                      />
                      <span>웹 개발 스터디 (HTML/CSS/JS, 실습 중심)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faGlobe}
                        className="text-green-400"
                      />
                      <span>보안 스터디 (Dreamhack 실습 중심)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faMobileAlt}
                        className="text-purple-400"
                      />
                      <span>알고리즘 스터디 (수준별 문제 해결)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faBrain}
                        className="text-pink-400"
                      />
                      <span>안드로이드 스터디</span>
                    </li>
                  </ul>
                </div>
                <div className="feature-card p-6 rounded-2xl">
                  <h4 className="orbitron font-bold text-lg mb-4 text-green-300 text-left">
                    프로젝트 기반 학습
                  </h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="text-blue-400"
                      />
                      <span>JS/TS · Python · Java 조별 스터디 및 프로젝트</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faCalendarAlt}
                        className="text-green-400"
                      />
                      <span>CS 현직자 세미나 (토스페이, 와드, 와이즈라이트 등)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faUserFriends}
                        className="text-purple-400"
                      />
                      <span>개발자 튜토리얼 (신입/1학년 대상 기초 온보딩)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <FontAwesomeIcon
                        icon={faAward}
                        className="text-pink-400"
                      />
                      <span>TCPC 및 연합 해커톤으로 실전 협업 경험 강화</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="recruitment-closing-cta py-16">
        <div className="container site-content-container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="orbitron text-4xl md:text-5xl font-black mb-6 text-white">
              TCP에서{' '}
              <br className="recruitment-cta-mobile-break" />
              개발자의 길을 걸어보세요
            </h2>
            <p className="text-xl text-gray-200 mb-8">
              <span className="recruitment-cta-copy-line">뛰어난 동료들과 함께 성장하고,</span>{' '}
              <span className="recruitment-cta-copy-line">협업 경험을 쌓으며,</span>{' '}
              <span className="recruitment-cta-copy-line">자신의 꿈을 현실로 만들어보세요.</span>
            </p>
            <button
              id="sectionApplyBtn"
              onClick={openModal}
              disabled={!isRecruitmentActive}
              className={`cta-button px-12 py-4 rounded-full text-lg font-bold orbitron transition-colors ${!isRecruitmentActive ? 'opacity-50 cursor-not-allowed bg-gray-600 text-white' : 'primary-cta-text'}`}
            >
              <FontAwesomeIcon icon={faRocket} className="mr-2" />
              {isRecruitmentActive ? '지금 지원하기' : '모집 기간이 아닙니다'}
            </button>
            <p className="text-sm text-gray-300 mt-4">
              * 지원 기간: {recruitmentPeriod || '추후 공지'}
            </p>
          </div>
        </div>
      </section>

      {/* 지원서 모달 */}
      {isModalOpen && (
        <div
          id="applicationModal"
          className="modal active recruitment-application-modal"
          onClick={(e) => {
            if (e.target.id === 'applicationModal') {
              requestCloseModal();
            }
          }}
        >
          <section
            className="modal-content recruitment-application-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="applicationModalTitle"
            aria-describedby="applicationModalDescription"
          >
            <header className="recruitment-application-header">
              <div className="recruitment-application-heading">
                <h2 id="applicationModalTitle">TCP 지원서</h2>
                <p id="applicationModalDescription">
                  필수 항목을 작성한 뒤 제출해 주세요.
                </p>
              </div>
              <button
                type="button"
                className="close-modal recruitment-application-close"
                onClick={requestCloseModal}
                aria-label="지원서 닫기"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </header>

            <form ref={applicationFormRef} className="recruitment-application-form" onSubmit={handleSubmit}>
              <div className="recruitment-application-scroll">
                <section className="recruitment-form-section recruitment-application-basic-section">
                  <div className="recruitment-form-section-heading">
                    <h3>기본 정보</h3>
                  </div>
                <div className="form-group">
                  <label
                    htmlFor="name"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>이름</span>
                  </label>
                  <p className="recruitment-question-hint">이름을 입력해주세요.</p>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="form-input"
                    placeholder="이름"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label
                    htmlFor="studentId"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>학번</span>
                  </label>
                  <p className="recruitment-question-hint">학번 8자리를 입력해주세요.</p>
                  <input
                    type="text"
                    id="studentId"
                    name="studentId"
                    className={`form-input ${studentNumberError ? 'border-red-500' : ''}`}
                    placeholder="8자리 숫자"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={Boolean(studentNumberError)}
                    aria-describedby={studentNumberError ? 'studentIdError' : undefined}
                    value={studentNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                      setStudentNumber(value);
                      if (value && value.length !== 8) {
                        setStudentNumberError('학번은 8자리 숫자여야 합니다.');
                      } else {
                        setStudentNumberError('');
                      }
                    }}
                    required
                  />
                  {studentNumberError && (
                    <p id="studentIdError" className="text-red-500 text-sm mt-1" role="alert">
                      {studentNumberError}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label
                    htmlFor="major"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>학과/전공</span>
                  </label>
                  <p className="recruitment-question-hint">학과 또는 전공을 입력해주세요.</p>
                  <input
                    type="text"
                    id="major"
                    name="major"
                    className="form-input"
                    placeholder="학과/전공"
                    required
                  />
                </div>

                <div className="form-group">
                  <label
                    htmlFor="phone"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>전화번호</span>
                  </label>
                  <p className="recruitment-question-hint">연락 가능한 전화번호를 입력해주세요.</p>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className={`form-input ${phoneError ? 'border-red-500' : ''}`}
                    placeholder="010-0000-0000"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={phoneError ? 'phoneError' : undefined}
                    value={phoneNumber}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setPhoneNumber(formatted);
                      // 최소 완성 길이(02-XXX-XXXX = 11자) 이상일 때만 검증
                      if (formatted && formatted.length >= 11 && !validatePhoneNumber(formatted)) {
                        setPhoneError('올바른 전화번호 형식이 아닙니다.');
                      } else {
                        setPhoneError('');
                      }
                    }}
                    required
                  />
                  {phoneError && (
                    <p id="phoneError" className="text-red-500 text-sm mt-1" role="alert">
                      {phoneError}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label
                    htmlFor="interests"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>관심 분야</span>
                  </label>
                  <p className="recruitment-question-hint">관심 있는 개발 분야를 알려주세요.</p>
                  <textarea
                    id="interests"
                    name="interests"
                    className="form-input form-textarea"
                    placeholder="웹 개발, 모바일 앱, AI/ML, 게임 개발 등 관심 있는 분야를 작성해주세요"
                    required
                  ></textarea>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="selfIntroduction"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>자기소개</span>
                  </label>
                  <p className="recruitment-question-hint">자신을 자유롭게 소개해주세요.</p>
                  <textarea
                    id="selfIntroduction"
                    name="selfIntroduction"
                    className="form-input form-textarea"
                    placeholder="자신의 성격, 장점, 개발에 대한 열정 등을 자유롭게 작성해주세요"
                    required
                  ></textarea>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="expectations"
                    className="form-label recruitment-question-label text-left"
                  >
                    <span className="recruitment-question-required" aria-hidden="true">*</span>
                    <span>TCP에 대한 기대</span>
                  </label>
                  <p className="recruitment-question-hint">TCP에서 기대하는 경험을 작성해주세요.</p>
                  <textarea
                    id="expectations"
                    name="expectations"
                    className="form-input form-textarea"
                    placeholder="TCP에서 무엇을 배우고 경험하고 싶은지, 어떤 기여를 할 수 있는지 작성해주세요"
                    required
                  ></textarea>
                </div>

                </section>

                {/* 프로젝트 경험 */}
                <div className="section">
                  <h3 className="orbitron text-xl font-bold gradient-text mb-4 text-left">
                    프로젝트 경험
                  </h3>
                  <div id="projects-container">
                    {projects.map((project, index) => (
                      <div
                        key={project.id}
                        className="entry mb-4 p-4 border border-gray-700 rounded-lg"
                      >
                        <div className="entry-heading">
                          <h4 className="font-semibold text-white">
                            프로젝트 #{index + 1}
                          </h4>
                          {projects.length > 1 && (
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => removeProject(index)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                        <label className="entry-field">
                          프로젝트명:
                          <input
                            type="text"
                            name="project_name"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="entry-field">
                          참여율 (%):
                          <input
                            type="text"
                            name="project_contribution"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="entry-field">
                          진행 기간:
                          <div className="project-date-range">
                            <input
                              type="text"
                              name="project_start_date"
                              className="form-input mt-1"
                              placeholder="YYYY-MM-DD"
                              inputMode="numeric"
                              aria-label={`프로젝트 ${index + 1} 시작일`}
                              maxLength={10}
                              onChange={(e) => {
                                e.target.value = formatBirthDate(e.target.value);
                              }}
                            />
                            <span aria-hidden="true">~</span>
                            <input
                              type="text"
                              name="project_end_date"
                              className="form-input mt-1"
                              placeholder="YYYY-MM-DD"
                              inputMode="numeric"
                              aria-label={`프로젝트 ${index + 1} 종료일`}
                              maxLength={10}
                              onChange={(e) => {
                                e.target.value = formatBirthDate(e.target.value);
                              }}
                            />
                          </div>
                        </label>
                        <label className="entry-field">
                          프로젝트 내용:
                          <textarea
                            name="project_description"
                            className="form-input form-textarea mt-1"
                          />
                        </label>
                        <label className="entry-field">
                          사용 기술:
                          <input
                            type="text"
                            name="project_tech_stack"
                            className="form-input mt-1"
                            placeholder="예: React, Node.js"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary entry-add-button"
                    onClick={addProject}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    프로젝트 추가
                  </button>
                </div>

                {/* 수상 기록 */}
                <div className="section">
                  <h3 className="orbitron text-xl font-bold gradient-text mb-4 text-left">
                    수상 기록
                  </h3>
                  <div id="awards-container">
                    {awards.map((award, index) => (
                      <div
                        key={award.id}
                        className="entry mb-4 p-4 border border-gray-700 rounded-lg"
                      >
                        <div className="entry-heading">
                          <h4 className="font-semibold text-white">
                            수상 #{index + 1}
                          </h4>
                          {awards.length > 1 && (
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => removeAward(index)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                        <label className="entry-field">
                          수상명:
                          <input
                            type="text"
                            name="award_name"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="entry-field">
                          수여 기관:
                          <input
                            type="text"
                            name="award_institution"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="entry-field">
                          수상 년월일:
                          <input
                            type="text"
                            name="award_date"
                            className="form-input mt-1"
                            placeholder="YYYY-MM-DD"
                            maxLength={10}
                            onChange={(e) => {
                              e.target.value = formatBirthDate(e.target.value);
                            }}
                          />
                        </label>
                        <label className="entry-field">
                          수상 내용:
                          <textarea
                            name="award_description"
                            className="form-input form-textarea mt-1"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary entry-add-button"
                    onClick={addAward}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    수상 추가
                  </button>
                </div>

                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    id="privacyAgreement"
                    name="privacyAgreement"
                    required
                  />
                  <label
                    htmlFor="privacyAgreement"
                    className="text-sm text-gray-300"
                  >
                    <Link
                      to="/privacy-consent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      개인정보 수집 및 이용
                    </Link>
                    에 동의합니다.
                  </label>
                </div>

              </div>

              <footer className="recruitment-application-footer">
                <button
                  type="button"
                  className="recruitment-application-cancel"
                  onClick={requestCloseModal}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="recruitment-application-submit"
                  disabled={isSubmitting}
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  {isSubmitting ? '제출 중...' : '지원서 제출'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )
      }
    </main>
  );
}

export default Recruitment;
