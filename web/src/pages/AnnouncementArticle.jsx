import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { apiGet, apiDelete } from '../api/client';
import { useAuth } from '../context/AuthContext';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

function AnnouncementArticle() {
  const { id } = useParams(); // 라우트 파라미터 이름을 'id'로 받습니다.
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 관리자 권한 확인
  const isAdmin = user?.role === 'ADMIN';
  // Admin 페이지에서 왔는지 확인
  const fromAdmin = location.state?.from === 'admin';

  useEffect(() => {
    let isMounted = true;

    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        // 어드민에서 오면 예약 공지도 조회 가능한 엔드포인트 사용
        const endpoint = fromAdmin ? `/api/v1/admin/announcements/${id}` : `/api/v1/announcements/${id}`;
        const data = await apiGet(endpoint);
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
          summary: data.summary || '',
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
  }, [id, fromAdmin]);

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

    const elements = document.querySelectorAll('.scroll-fade');
    elements.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isLoading]);

  const openShareModal = () => setIsShareModalOpen(true);
  const closeShareModal = () => setIsShareModalOpen(false);

  // 수정 페이지로 이동
  const handleEdit = () => {
    navigate(`/announcement/edit/${id}`);
  };

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!window.confirm('이 공지사항을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('로그인이 필요합니다.');
        return;
      }

      await apiDelete(`/api/v1/announcements/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert('공지사항이 삭제되었습니다.');
      navigate('/announcement');
    } catch (error) {
      alert(error.message || '공지사항 삭제에 실패했습니다.');
    }
  };

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
    const html = md.render(rawContent);
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
          to={fromAdmin ? "/admin/announcement" : "/announcement"}
          className="mt-8 back-button inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium"
        >
          <i className="fas fa-list mr-3"></i>
          {fromAdmin ? '관리자 페이지로 돌아가기' : '공지사항 목록 보기'}
        </Link>
      </div>
    );
  }

  return (
    <main className="pt-20 pb-16 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button: Left aligned, widget-card background */}
        <div className="mb-8 scroll-fade text-left">
          <Link
            to={fromAdmin ? "/admin/announcement" : "/announcement"}
            className="widget-card btn-back-hover inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            {fromAdmin ? '관리자 페이지로 돌아가기' : '공지사항 목록으로 돌아가기'}
          </Link>
        </div>

        <article className="scroll-fade">
          <header className="mb-8">
            <div className="mb-4 text-left">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-black"
                style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }}
              >
                {article.category}
              </span>
            </div>
            {/* Title: Left aligned */}
            <h1 className="orbitron text-3xl md:text-5xl font-bold mb-6 gradient-text text-left">
              {article.title}
            </h1>

            {/* Meta: Removed likes/tags, Left aligned content */}
            <div className="article-meta widget-card rounded-lg p-6 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-user text-blue-400"></i>
                    <span>작성자: {article.author}</span>
                  </div>
                  <div className="flex items-center">
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
                </div>
              </div>
            </div>
          </header>

          <div className="article-content widget-card rounded-lg p-8 mb-8">
            <div
              className="article-body text-gray-200 text-left"
              dangerouslySetInnerHTML={articleBodyMarkup}
            />
          </div>

          <footer className="border-t border-gray-700 pt-6">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isAdmin && (
                <>
                  <button
                    onClick={handleEdit}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <i className="fas fa-edit"></i>
                    <span>수정</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <i className="fas fa-trash"></i>
                    <span>삭제</span>
                  </button>
                </>
              )}
              <button
                onClick={openShareModal}
                id="shareBtn"
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <i className="fas fa-share text-blue-400"></i>
                <span>공유</span>
              </button>
            </div>
          </footer>
        </article>

        {/* Bottom Back Button: Centered */}
        <div className="mt-12 text-center">
          <Link
            to={fromAdmin ? "/admin/announcement" : "/announcement"}
            className="widget-card btn-back-hover inline-flex items-center px-8 py-4 rounded-lg text-lg font-medium transition-colors"
          >
            <i className="fas fa-list mr-3"></i>
            {fromAdmin ? '관리자 페이지로 돌아가기' : '공지사항 목록 보기'}
          </Link>
        </div>
      </div>

      {/* Share Modal remains unchanged */}
      {isShareModalOpen && (
        <div
          id="shareModal"
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shareModalTitle"
          onClick={closeShareModal}
        >
          {/* ... modal content ... */}
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
