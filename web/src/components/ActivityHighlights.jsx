import React, { useEffect, useState } from 'react';

const ACTIVITY_CARDS = [
  {
    key: 'competition',
    title: '대회 참가',
    englishTitle: 'Competition Participation',
    description:
      '프로그래밍 대회, 해커톤, 창업 경진대회 등 다양한 대회에 참가하여 실력을 겨루고 경험을 쌓습니다.',
    icon: 'fa-trophy',
    iconClass: 'text-yellow-400',
    titleClass: 'text-yellow-300',
    tagClass: 'bg-yellow-900 text-yellow-300',
    imageAlt: 'TCP 대회 참가 활동',
  },
  {
    key: 'study',
    title: '스터디 세션',
    englishTitle: 'Study Sessions',
    description:
      '알고리즘, 웹 개발, 인공지능 등 다양한 주제의 정기 스터디를 통해 체계적으로 학습합니다.',
    icon: 'fa-book-open',
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-300',
    tagClass: 'bg-blue-900 text-blue-300',
    imageAlt: 'TCP 스터디 활동',
  },
  {
    key: 'mt',
    title: '멤버십 트레이닝',
    englishTitle: 'MT Events',
    description:
      '팀 빌딩, 네트워킹, 집중 코딩 캠프 등을 통해 동아리 구성원들과의 유대감을 형성합니다.',
    icon: 'fa-users',
    iconClass: 'text-green-400',
    titleClass: 'text-green-300',
    tagClass: 'bg-green-900 text-green-300',
    imageAlt: 'TCP 멤버십 트레이닝 활동',
  },
];

function ActivityHighlights() {
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
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchActivityImages = async () => {
      try {
        const response = await fetch('/api/v1/main/activity-images');
        if (!response.ok) return;
        const data = await response.json();
        if (!isMounted) return;
        setActivityImages({
          competition: data.competition ?? null,
          study: data.study ?? null,
          mt: data.mt ?? null,
        });
        setTags({
          competition: data.tags?.competition ?? [],
          study: data.tags?.study ?? [],
          mt: data.tags?.mt ?? [],
        });
      } catch (error) {
        console.error('Failed to fetch activity images:', error);
      }
    };

    fetchActivityImages();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedActivity) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedActivity(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedActivity]);

  const openActivity = (activity) => {
    const image = activityImages[activity.key];
    if (!image) return;
    setSelectedActivity({
      ...activity,
      image,
      tags: tags[activity.key] || [],
    });
  };

  return (
    <>
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedActivity(null)}
          role="presentation"
        >
          <div
            className="bg-gray-900 rounded-2xl w-full max-w-[1000px] max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-dialog-title"
          >
            <div className="p-1">
              <div
                className="relative w-full rounded-t-xl bg-black group"
                style={{ height: 'min(500px, 55vh)' }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors backdrop-blur-sm"
                  aria-label="활동 이미지 닫기"
                >
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
                <div className="w-full h-full overflow-hidden rounded-t-xl bg-black flex items-center justify-center p-2 sm:p-4">
                  <img
                    src={selectedActivity.image}
                    alt={selectedActivity.imageAlt}
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                  />
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h3
                    id="activity-dialog-title"
                    className="orbitron text-2xl md:text-3xl font-bold text-white mb-2"
                  >
                    {selectedActivity.title}
                  </h3>
                  <p className="text-gray-400 font-medium">
                    {selectedActivity.englishTitle}
                  </p>
                </div>

                <div>
                  <h4 className="text-gray-300 font-semibold mb-3 flex items-center">
                    <i className="fas fa-tags mr-2 text-blue-400" aria-hidden="true"></i>
                    관련 태그
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedActivity.tags.length > 0 ? (
                      selectedActivity.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-full text-sm"
                        >
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

      <section className="py-16" aria-labelledby="main-activities-title">
        <div className="container site-content-container mx-auto px-4">
          <div className="text-center mb-12">
            <h2
              id="main-activities-title"
              className="orbitron text-3xl md:text-4xl font-bold gradient-text mb-4"
            >
              주요 활동
            </h2>
            <p className="orbitron text-xl text-gray-300">
              TCP에서 경험할 수 있는 다양한 활동들을 소개합니다
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {ACTIVITY_CARDS.map((activity) => {
              const image = activityImages[activity.key];
              const activityTags = tags[activity.key] || [];

              return (
                <article className="scroll-fade" key={activity.key}>
                  <div className="activity-highlight-card rounded-2xl overflow-hidden card-hover h-full">
                    {image ? (
                      <button
                        type="button"
                        className="h-56 w-full relative cursor-pointer group block"
                        onClick={() => openActivity(activity)}
                        aria-label={`${activity.title} 활동 이미지 크게 보기`}
                      >
                        <img
                          src={image}
                          alt={activity.imageAlt}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-3xl transition-opacity" aria-hidden="true"></i>
                        </span>
                      </button>
                    ) : (
                      <div className="promo-placeholder">
                        <div className="text-center">
                          <i
                            className={`fas ${activity.icon} text-4xl ${activity.iconClass} mb-4`}
                            aria-hidden="true"
                          ></i>
                          <h3 className={`orbitron text-lg font-bold ${activity.titleClass}`}>
                            {activity.title}
                          </h3>
                          <p className="orbitron text-sm text-gray-400 mt-2">
                            {activity.englishTitle}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-6">
                      <h3 className={`orbitron text-xl font-bold mb-3 ${activity.titleClass}`}>
                        {activity.title}
                      </h3>
                      <p className="text-gray-400 mb-4 text-left">
                        {activity.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activityTags.length > 0 ? (
                          activityTags.map((tag) => (
                            <span
                              key={tag}
                              className={`px-3 py-1 rounded-full text-xs ${activity.tagClass}`}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs">태그 없음</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export default ActivityHighlights;
