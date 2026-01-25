import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';

function Members() {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const placeholderAvatar =
    'https://via.placeholder.com/120/A8C5E6/FFFFFF?text=TCP';

  // 필터링 상태 관리
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [activeTag, setActiveTag] = useState('');

  // 스크롤 애니메이션 효과
  useEffect(() => {
    let isMounted = true;

    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet('/api/v1/members');
        const mapped = (data || []).map((user) => {
          const image =
            user.profile_image?.startsWith('http')
              ? user.profile_image
              : placeholderAvatar;
          const status =
            user.education_status === '졸업' ? 'alumni' : 'current';
          return {
            name: user.name,
            profileImageUrl: image,
            description: user.self_description || 'TCP 멤버',
            role: '멤버',
            tags: user.tech_stack || [],
            status,
            educationStatus: user.education_status,
            githubUrl: user.github_username
              ? `https://github.com/${user.github_username}`
              : '',
            portfolioUrl: user.portfolio_link || '',
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
  }, [searchTerm, filterRole, activeTag, members]);

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

    const roleMatch = !filterRole || member.role === filterRole;
    const tagButtonMatch =
      !activeTag || (member.tags || []).includes(activeTag);

      return searchCombined && roleMatch && tagButtonMatch;
    });
  }, [members, searchTerm, filterRole, activeTag]);

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
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                TCP 팀의 멤버들을 만나보세요. 검색과 필터로 원하는 멤버를
                찾아보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-gradient-to-b from-transparent to-gray-900">
        <div className="container mx-auto px-4">
          <div className="mb-10 p-6 bg-gray-900 rounded-xl border border-gray-800">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Search
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
              <div>
                <label
                  htmlFor="filter-role"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Role
                </label>
                <select
                  id="filter-role"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="">모든 역할</option>
                  <option value="팀장">팀장</option>
                  <option value="프론트엔드">프론트엔드</option>
                  <option value="백엔드">백엔드</option>
                  <option value="모바일">모바일</option>
                  <option value="AI">AI</option>
                  <option value="멤버">멤버</option>
                </select>
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Technology Tags
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
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              TCP 팀의 현재 활동 중인 멤버들입니다.
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
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-2 text-white">
                    {member.name}
                  </h3>
                  <p
                    className={`${member.role === '팀장' ? 'text-blue-300' : member.role === 'AI' ? 'text-purple-300' : member.role === '백엔드' ? 'text-green-300' : 'text-pink-300'} mb-2`}
                  >
                    {member.role}
                  </p>
                  <p className="text-sm text-gray-400">{member.description}</p>
                  <div className="flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.slice(0, 3).map((tag, tagIndex) => (
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
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              TCP 팀을 졸업하여 각자의 길을 걸어가고 있는 멤버들입니다.
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
                    />
                  </div>
                  <h3 className="orbitron text-xl font-bold mb-2 text-white">
                    {member.name}
                  </h3>
                  <p className="text-gray-400 mb-2">{member.description}</p>
                  <p className="text-sm text-gray-400">
                    {member.educationStatus
                      ? `현재 ${member.educationStatus}`
                      : '졸업 멤버'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.slice(0, 3).map((tag, tagIndex) => (
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
