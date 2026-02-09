import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import defaultProfileImage from '../logo.svg';



function Members() {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 필터링 상태 관리
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState('');

  // 스크롤 애니메이션 효과
  useEffect(() => {
    let isMounted = true;

    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet('/api/v1/members');
        const mapped = (data || []).map((user) => {
          const image = user.profile_image;

          // education_status에 따라 구분
          const status =
            user.education_status === '졸업' ? 'alumni' : 'current';

          // 포트폴리오 링크가 절대 URL인지 확인 (http:// 또는 https://로 시작)
          const portfolioUrl = user.portfolio_link &&
            (user.portfolio_link.startsWith('http://') || user.portfolio_link.startsWith('https://'))
            ? user.portfolio_link
            : user.portfolio_link
              ? `https://${user.portfolio_link}`
              : null;

          return {
            // 항상 공개되는 필드
            name: user.name,
            profileImageUrl: image,
            description: user.self_description,
            status,
            educationStatus: user.education_status,

            // 공개 여부에 따라 조건부로 포함되는 필드
            ...(user.email && { email: user.email }),
            ...(user.tech_stack && { tags: user.tech_stack }),
            ...(user.github_username && {
              githubUrl: `https://github.com/${user.github_username}`
            }),
            ...(portfolioUrl && { portfolioUrl }),

            // tech_stack이 없으면 빈 배열로 설정 (필터링 로직을 위해)
            ...(!user.tech_stack && { tags: [] }),
          };
        });
        if (isMounted) {
          setMembers(mapped);
          setErrorMessage('');
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '멤버 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
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
  }, [searchTerm, activeTag, members]);

  // 필터링된 멤버 목록 계산
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const nameMatch = member.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const tagsMatch = (member.tags || []).some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const searchCombined = nameMatch || tagsMatch;

      const tagButtonMatch =
        !activeTag || (member.tags || []).includes(activeTag);

      return searchCombined && tagButtonMatch;
    });
  }, [members, searchTerm, activeTag]);

  const currentMembers = filteredMembers.filter(
    (member) => member.status === 'current'
  );
  const alumniMembers = filteredMembers.filter(
    (member) => member.status === 'alumni'
  );

  // 태그 버튼 클릭 핸들러
  const handleTagClick = (tag) => {
    setActiveTag((prevTag) => (prevTag === tag ? '' : tag));
  };

  // 태그 버튼의 동적 CSS 클래스 생성 (members2.html의 색상 매핑)
  const getTagBgClass = (tag) => {
    switch (tag) {
      case 'React':
      case 'JavaScript':
      case 'TypeScript':
      case 'CSS':
      case 'MySQL':
      case 'Data Science':
        return 'bg-blue-900 text-blue-300';
      case 'Python':
      case 'TensorFlow':
      case 'PyTorch':
      case 'AI/ML':
      case 'Django':
      case 'Spring':
      case 'AWS':
      case 'Machine Learning':
        return 'bg-purple-900 text-purple-300';
      case 'Node.js':
        return 'bg-green-900 text-green-300';
      case 'Swift':
      case 'Flutter':
      case 'Kotlin':
      case '모바일':
        return 'bg-pink-900 text-pink-300';
      case 'Java':
        return 'bg-red-900 text-red-300';
      case 'Vue.js':
        return 'bg-teal-900 text-teal-300';
      case 'AI':
        return 'bg-orange-900 text-orange-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <>
      <section className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-green-400 flex items-center justify-center">
                <i className="fas fa-users text-white text-3xl"></i>
              </div>
              <h1 className="orbitron text-5xl md:text-7xl font-black mb-4">
                <span className="gradient-text">TCP Members</span>
              </h1>
              <p className="orbitron text-xl md:text-2xl text-gray-300 mb-6">
                Team Crazy Performance
              </p>
              <p className="orbitron text-lg text-gray-400 max-w-2xl mx-auto">
                TCP의 멤버들을 만나보세요. 검색과 필터로 원하는 멤버를 찾아보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-gradient-to-b from-transparent to-gray-900">
        <div className="container mx-auto px-4">
          <div className="mb-10 p-6 bg-gray-900 rounded-xl border border-gray-800">
            <div>
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                검색
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="search"
                  placeholder="이름 또는 기술 스택으로 검색"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                태그 필터
              </label>
              <div id="tag-cloud" className="flex flex-wrap gap-2">
                {[
                  'React',
                  'JavaScript',
                  'Node.js',
                  'Python',
                  'Swift',
                  'Java',
                  'Flutter',
                  'Vue.js',
                  'AI/ML',
                ].map((tag) => (
                  <button
                    key={tag}
                    className={`tag-btn px-3 py-1 rounded-full text-xs hover:bg-opacity-80 transition-colors
                      ${getTagBgClass(tag)} ${activeTag === tag ? 'ring-2 ring-blue-400' : ''}`}
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current Members Section */}
      <section
        id="current-members"
        className="py-16 bg-gradient-to-b from-transparent to-gray-900"
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              현재 멤버
            </h2>
            <p className="orbitron text-xl text-gray-300 max-w-3xl mx-auto">
              현재 활동 중인 TCP 멤버들입니다.
            </p>
          </div>

          <div
            id="members-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {isLoading && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p className="text-xl">멤버 정보를 불러오는 중...</p>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="col-span-full text-center py-12 text-red-400">
                <p className="text-xl">{errorMessage}</p>
              </div>
            )}
            {!isLoading && !errorMessage && currentMembers.length > 0 ? (
              currentMembers.map((member, index) => (
                <div
                  key={index}
                  className="scroll-fade member-card p-6 rounded-xl text-center card-hover"
                >
                  <div className="img-container mx-auto">
                    <img
                      src={member.profileImageUrl}
                      alt={`${member.name} Profile`}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = defaultProfileImage;
                      }}
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-2 text-white">
                    {member.name}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">{member.description}</p>
                  {member.email && (
                    <p className="text-xs text-gray-500 mb-1">
                      <i className="fas fa-envelope mr-1"></i>
                      {member.email}
                    </p>
                  )}
                  <p className="text-xs text-blue-400 mb-2">
                    <i className="fas fa-graduation-cap mr-1"></i>
                    {member.educationStatus}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`px-2 py-1 rounded-full text-xs ${getTagBgClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-center space-x-4 mt-4">
                    {member.githubUrl && (
                      <a
                        href={member.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-400"
                      >
                        <i className="fab fa-github"></i>
                      </a>
                    )}
                    {member.portfolioUrl && (
                      <a
                        href={member.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-purple-400"
                      >
                        <i className="fas fa-link"></i>
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                <i className="fas fa-exclamation-circle text-5xl mb-4"></i>
                <p className="text-xl">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Alumni Members Section */}
      <section id="alumni-members" className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4">
              졸업 멤버
            </h2>
            <p className="orbitron text-xl text-gray-300 max-w-3xl mx-auto">
              학교를 졸업하여 각자의 길을 걸어가고 있는 TCP 멤버들입니다.
            </p>
          </div>
          <div
            id="alumni-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {isLoading && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p className="text-xl">멤버 정보를 불러오는 중...</p>
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="col-span-full text-center py-12 text-red-400">
                <p className="text-xl">{errorMessage}</p>
              </div>
            )}
            {!isLoading && !errorMessage && alumniMembers.length > 0 ? (
              alumniMembers.map((member, index) => (
                <div
                  key={index}
                  className="scroll-fade member-card p-6 rounded-xl text-center card-hover"
                >
                  <div className="img-container mx-auto">
                    <img
                      src={member.profileImageUrl}
                      alt={`${member.name} Profile`}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = defaultProfileImage;
                      }}
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-2 text-white">
                    {member.name}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">{member.description}</p>
                  {member.email && (
                    <p className="text-xs text-gray-500 mb-1">
                      <i className="fas fa-envelope mr-1"></i>
                      {member.email}
                    </p>
                  )}
                  <p className="text-xs text-blue-400 mb-2">
                    <i className="fas fa-graduation-cap mr-1"></i>
                    {member.educationStatus}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`px-2 py-1 rounded-full text-xs ${getTagBgClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-center space-x-4 mt-4">
                    {member.githubUrl && (
                      <a
                        href={member.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-400"
                      >
                        <i className="fab fa-github"></i>
                      </a>
                    )}
                    {member.portfolioUrl && (
                      <a
                        href={member.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-purple-400"
                      >
                        <i className="fas fa-link"></i>
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                <i className="fas fa-exclamation-circle text-5xl mb-4"></i>
                <p className="text-xl">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default Members;
