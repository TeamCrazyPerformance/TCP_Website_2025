import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { apiGet } from '../api/client';

function AnnouncementArticle() {
  const { id } = useParams(); // 라우트 파라미터 이름을 'id'로 받습니다.
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        const data = await apiGet(`/api/v1/announcements/${id}`);
        const mapped = {
          id: data.id,
          category: '공지사항',
          title: data.title,
          author: data.author?.name || '관리자',
          date: data.publishAt || data.createdAt,
          views: data.views ?? 0,
          likes: 0,
          tags: ['공지'],
          content: data.contents || '',
        };
        if (isMounted) {
          setArticle(mapped);
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

    fetchArticle();

    return () => {
      isMounted = false;
    };
  }, [id]);

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

    document.querySelectorAll('.scroll-fade').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const openShareModal = () => setIsShareModalOpen(true);
  const closeShareModal = () => setIsShareModalOpen(false);

  const copyUrl = () => {
    const urlToCopy = window.location.href;
    navigator.clipboard
      .writeText(urlToCopy)
      .then(() => {
        alert('URL이 클립보드에 복사되었습니다!');
      })
      .catch((err) => {
        console.error('클립보드 복사 실패:', err);
        alert('URL 복사에 실패했습니다.');
      });
  };

  const handleShareButtonClick = (platform) => {
    const url = window.location.href;
    const title = document.title;
    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(
          shareUrl,
          '_blank',
          'noopener,noreferrer,width=600,height=600'
        );
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        window.open(
          shareUrl,
          '_blank',
          'noopener,noreferrer,width=600,height=400'
        );
        break;
      case 'kakao':
        alert(
          '카카오톡 공유는 카카오 SDK 연동이 필요합니다. 원하시면 연동해드릴게요.'
        );
        break;
      case 'instagram':
        alert(
          'Instagram은 웹 링크 공유 인터페이스가 제한적입니다. Web Share API 또는 앱 내 공유를 사용하세요.'
        );
        break;
      default:
        break;
    }
  };

  const articleBodyMarkup = useMemo(() => {
    const rawContent = article?.content || '';
    const html = rawContent.replace(/\n/g, '<br />');
    return { __html: DOMPurify.sanitize(html) };
  }, [article?.content]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-gray-400">
        공지사항을 불러오는 중...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-red-400">
        {errorMessage}
      </div>
    );
  }

  // 게시글이 없을 경우 에러 메시지 렌더링
  if (!article) {
    return (
      <div className="container mx-auto px-4 py-24 text-center text-gray-400">
        <h1 className="text-4xl">게시글을 찾을 수 없습니다.</h1>
        <Link
          to="/announcement"
          className="mt-8 back-button inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium"
        >
          <i className="fas fa-list mr-3"></i>
          공지사항 목록 보기
        </Link>
      </div>
    );
  }

  return (
    <main className="pt-20 pb-16 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8 scroll-fade">
          <Link
            to="/announcement"
            className="back-button inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            공지사항 목록으로 돌아가기
          </Link>
        </div>
        <article className="scroll-fade">
          <header className="mb-8">
            <div className="mb-4">
              <span className="tag px-3 py-1 rounded-full text-xs">
                {article.category}
              </span>
            </div>
            <h1 className="orbitron text-3xl md:text-5xl font-bold mb-6 gradient-text">
              {article.title}
            </h1>
            <div className="article-meta rounded-lg p-6 mb-8">
              <div className="flex flex-wrap items-center justify-between text-sm text-gray-300">
                <div className="flex items-center space-x-6 mb-2 md:mb-0">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-user text-blue-400"></i>
                    <span>작성자: {article.author}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-calendar text-purple-400"></i>
                    <span>
                      {new Date(article.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-eye text-green-400"></i>
                    <span>조회 {article.views}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-heart text-pink-400"></i>
                    <span>좋아요 {article.likes}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div className="article-content rounded-lg p-8 mb-8">
            <div
              className="article-body text-gray-200"
              dangerouslySetInnerHTML={articleBodyMarkup}
            />
          </div>
          <footer className="border-t border-gray-700 pt-6">
            <div className="flex flex-wrap items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                  <i className="fas fa-heart text-pink-400"></i>
                  <span>좋아요</span>
                  <span className="text-pink-400">{article.likes}</span>
                </button>
                <button
                  onClick={openShareModal}
                  id="shareBtn"
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <i className="fas fa-share text-blue-400"></i>
                  <span>공유</span>
                </button>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>태그:</span>
                {article.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </footer>
        </article>
        <div className="text-center mt-12">
          <Link
            to="/announcement"
            className="back-button inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium"
          >
            <i className="fas fa-list mr-3"></i>
            공지사항 목록 보기
          </Link>
        </div>
      </div>
      {isShareModalOpen && (
        <div
          id="shareModal"
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shareModalTitle"
          onClick={closeShareModal}
        >
          <div
            className="bg-gray-900 text-white rounded-xl overflow-hidden w-80 shadow-2xl border border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 id="shareModalTitle" className="text-lg font-semibold">
                공유하기
              </h2>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={copyUrl}
                className="w-full inline-flex items-center justify-start space-x-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
              >
                <i className="fas fa-link text-gray-300"></i>
                <span>URL 복사</span>
              </button>
              <button
                onClick={() => handleShareButtonClick('kakao')}
                className="w-full inline-flex items-center justify-start space-x-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
              >
                <i className="fas fa-comment" style={{ color: '#FEE500' }}></i>
                <span>카카오톡</span>
              </button>
              <button
                onClick={() => handleShareButtonClick('instagram')}
                className="w-full inline-flex items-center justify-start space-x-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
              >
                <i className="fab fa-instagram text-pink-400"></i>
                <span>Instagram</span>
              </button>
              <button
                onClick={() => handleShareButtonClick('facebook')}
                className="w-full inline-flex items-center justify-start space-x-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
              >
                <i className="fab fa-facebook text-blue-600"></i>
                <span>Facebook</span>
              </button>
              <button
                onClick={() => handleShareButtonClick('twitter')}
                className="w-full inline-flex items-center justify-start space-x-2 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
              >
                <i className="fab fa-twitter text-blue-400"></i>
                <span>Twitter</span>
              </button>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 text-right">
              <button
                onClick={closeShareModal}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AnnouncementArticle;
