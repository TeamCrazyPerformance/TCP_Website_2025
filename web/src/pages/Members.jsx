import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../api/client';
import defaultProfileImage from '../logo.svg';
import { allMembers as developmentMembers } from '../data/members';
import { tagColorClass } from '../utils/helpers';
import PublicPageHero from '../components/public/PublicPageHero';
import TagMultiSelect from '../components/public/TagMultiSelect';
import { useScrollReveal } from '../hooks/useScrollReveal';

function Members() {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState([]);

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
            ...(user.current_company && { currentCompany: user.current_company }),


            // tech_stack이 없으면 빈 배열로 설정 (필터링 로직을 위해)
            ...(!user.tech_stack && { tags: [] }),
          };
        });
        if (isMounted) {
          const visibleMembers =
            process.env.NODE_ENV === 'development' && mapped.length === 0
              ? developmentMembers
              : mapped;
          setMembers(visibleMembers);
          setErrorMessage('');
        }
      } catch (error) {
        if (isMounted) {
          if (process.env.NODE_ENV === 'development') {
            setMembers(developmentMembers);
            setErrorMessage('');
          } else {
            setErrorMessage(error.message || '멤버 정보를 불러오지 못했습니다.');
          }
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

  useScrollReveal(
    '.scroll-fade',
    `${searchTerm}:${activeTags.join(',')}:${members.length}`,
  );

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const term = searchTerm.toLowerCase();
      const nameMatch = member.name
        .toLowerCase()
        .includes(term);
      const tagsMatch = (member.tags || []).some((tag) =>
        tag.toLowerCase().includes(term)
      );
      const descMatch = (member.description || '')
        .toLowerCase()
        .includes(term);
      const statusMatch = (member.educationStatus || '')
        .toLowerCase()
        .includes(term);
      const companyMatch = (member.currentCompany || '')
        .toLowerCase()
        .includes(term);
      const searchCombined = nameMatch || tagsMatch || descMatch || statusMatch || companyMatch;

      const tagButtonMatch =
        !activeTags.length ||
        (member.tags || []).some((tag) => activeTags.includes(tag));

      return searchCombined && tagButtonMatch;
    });
  }, [members, searchTerm, activeTags]);

  const currentMembers = filteredMembers
    .filter((member) => member.status === 'current')
    .sort((a, b) => {
      // 1순위: 재학이 휴학보다 위
      const statusOrder = (s) => (s === '재학' ? 0 : 1);
      const statusDiff = statusOrder(a.educationStatus) - statusOrder(b.educationStatus);
      if (statusDiff !== 0) return statusDiff;
      // 2순위: 가나다 → 알파벳 순
      return a.name.localeCompare(b.name, 'ko');
    });
  const alumniMembers = filteredMembers
    .filter((member) => member.status === 'alumni')
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const handleTagClick = (tag) => {
    setActiveTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  return (
    <main className="public-page-unified-background">
      <PublicPageHero
        className="members-page-hero"
        icon={<i className="fas fa-users text-white text-3xl"></i>}
        iconClassName="bg-gradient-to-br from-blue-400 via-purple-400 to-green-400"
        title="TCP Members"
        lead="TCP의 멤버들을 만나보세요."
        description="검색과 필터 기능으로 원하는 멤버를 찾아볼 수 있어요."
      />

      {/* Search and Filter Section */}
      <section className="members-filter-section py-8">
        <div className="container site-content-container mx-auto px-4">
          <div className="service-filter-panel members-filter-panel mb-10 rounded-xl">
            <div>
              <div className="relative">
                <input
                  type="text"
                  id="search"
                  aria-label="멤버 검색"
                  placeholder="이름, 기술 스택, 소개, 소속으로 검색"
                  className="service-filter-control py-2 pl-4 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i
                  className="search-field-icon search-field-icon-right fas fa-search text-gray-500"
                  aria-hidden="true"
                ></i>
              </div>
            </div>
            <TagMultiSelect
              className="members-tag-filter"
              ariaLabel="멤버 태그 필터"
              tags={['React', 'JavaScript', 'Node.js', 'Python', 'Swift', 'Java', 'Flutter', 'Vue.js', 'AI/ML']}
              selectedTags={activeTags}
              onToggle={handleTagClick}
              onReset={() => setActiveTags([])}
              getTagClassName={tagColorClass}
            />
          </div>
        </div>
      </section>

      {/* Current Members Section */}
      <section
        id="current-members"
        className="members-current-section"
      >
        <div className="container site-content-container mx-auto px-4">
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
            className="members-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
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
                  className="scroll-fade member-card py-6 px-5 rounded-xl text-center card-hover"
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
                  {member.currentCompany && (
                    <p className="text-xs text-orange-400 mb-2">
                      <i className="fas fa-building mr-1"></i>
                      {member.currentCompany}
                    </p>
                  )}
                  <p className="text-xs text-blue-400 mb-2">
                    <i className="fas fa-graduation-cap mr-1"></i>
                    {member.educationStatus}
                  </p>
                  <div className="member-tag-list flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`px-2 py-1 rounded-full ${tagColorClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="member-card-links flex justify-center space-x-4 mt-4">
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
        <div className="container site-content-container mx-auto px-4">
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
            className="members-grid grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
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
                  className="scroll-fade member-card py-6 px-5 rounded-xl text-center card-hover"
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
                  {member.currentCompany && (
                    <p className="text-xs text-orange-400 mb-2">
                      <i className="fas fa-building mr-1"></i>
                      {member.currentCompany}
                    </p>
                  )}
                  <p className="text-xs text-blue-400 mb-2">
                    <i className="fas fa-graduation-cap mr-1"></i>
                    {member.educationStatus}
                  </p>
                  <div className="member-tag-list flex flex-wrap justify-center gap-1 mt-3 mb-4">
                    {member.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className={`px-2 py-1 rounded-full ${tagColorClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="member-card-links flex justify-center space-x-4 mt-4">
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
    </main>
  );
}

export default Members;
