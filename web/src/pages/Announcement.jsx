// src/pages/Announcement.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiGet } from '../api/client';

function Announcement() {
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncements = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet('/api/v1/announcements');
        const mapped = (data || []).map((item) => ({
          id: item.id,
          title: item.title,
          date: item.publishAt || item.createdAt,
          summary: item.summary,
          author: item.author?.name || '관리자',
        }));
        if (isMounted) {
          setAnnouncements(mapped);
          setErrorMessage('');
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || '공지사항을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAnnouncements();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // IntersectionObserver를 사용하여 스크롤 시 요소가 보일 때 애니메이션 추가
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // 한 번 보이면 더 이상 관찰 안 함
        }
      });
    }, observerOptions);

    document.querySelectorAll('.scroll-fade').forEach((el) => {
      observer.observe(el);
    });

    // 컴포넌트 언마운트 시 클린업
    return () => {
      observer.disconnect(); // IntersectionObserver 연결 해제
    };
  }, [announcements]);

  const handleWriteClick = () => {
    navigate('/announcement/write'); // AnnouncementWrite 페이지로 이동
  };

  return (
    <>
      <section className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center">
                <i className="fas fa-bullhorn text-white text-3xl"></i>
              </div>
              <h1 className="orbitron text-5xl md:text-7xl font-black mb-4">
                <span className="gradient-text">Announcements</span>
              </h1>
              <p className="orbitron text-xl md:text-2xl text-gray-300 mb-6">
                TCP의 중요한 소식을 놓치지 마세요!
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                동아리 운영, 행사, 프로젝트 등 TCP의 모든 공식 공지사항을
                이곳에서 확인하실 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="announcements"
        className="py-16 bg-gradient-to-b from-transparent to-gray-900"
      >
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text">
              공지사항
            </h2>
            <button
              className="cta-button px-6 py-2 rounded-lg text-sm font-bold text-white hover:text-black transition-colors"
              onClick={handleWriteClick}
            >
              <i className="fas fa-edit mr-2"></i> 글쓰기
            </button>
          </div>

          <div className="space-y-6">
            {isLoading && (
              <div className="text-center text-gray-400 py-12">
                공지사항을 불러오는 중...
              </div>
            )}
            {errorMessage && !isLoading && (
              <div className="text-center text-red-400 py-12">
                {errorMessage}
              </div>
            )}
            {!isLoading && !errorMessage && announcements.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                등록된 공지사항이 없습니다.
              </div>
            )}
            {!isLoading &&
              !errorMessage &&
              announcements.map((announcement) => (
                <Link
                  to={`/announcement/${announcement.id}`}
                  key={announcement.id}
                  className="block announcement-item p-6 rounded-xl scroll-fade"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-xl text-blue-300 text-left">
                      {announcement.title}
                    </h3>
                    <span className="text-sm text-gray-400">
                      {announcement.date
                        ? new Date(announcement.date).toLocaleDateString(
                            'ko-KR'
                          )
                        : ''}
                    </span>
                  </div>
                  <p className="text-gray-300 mb-2 text-left">
                    {announcement.summary}
                  </p>
                  <div className="text-sm text-gray-500 text-left">
                    작성자: {announcement.author}{' '}
                    <i className="fas fa-user-shield ml-1"></i>
                  </div>
                </Link>
              ))}
          </div>

          <div className="flex justify-center mt-12 space-x-2">
            <button className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
              이전
            </button>
            <button className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold">
              1
            </button>
            <button className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
              2
            </button>
            <button className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
              3
            </button>
            <button className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
              다음
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default Announcement;
