import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { apiPost } from '../api/client';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

function AnnouncementWrite() {
  const navigate = useNavigate();

  // 폼 상태 관리
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [author] = useState('관리자');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달 상태 관리
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Ref를 사용하여 DOM 요소 직접 접근
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  // 컴포넌트 마운트 시 초기 설정
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);

    const savedDraft = localStorage.getItem('announcement_draft');
    if (savedDraft) {
      if (window.confirm('임시저장된 글이 있습니다. 불러오시겠습니까?')) {
        const draftData = JSON.parse(savedDraft);
        setTitle(draftData.title || '');
        setSummary(draftData.summary || '');
        setDate(draftData.date || today);
        setContent(draftData.content || '');
      }
    }
  }, []);

  // 페이지 이탈 경고
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (title || content) {
        e.preventDefault();
        e.returnValue = '작성 중인 내용이 있습니다. 정말 떠나시겠습니까?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [title, content]);

  // 텍스트 포맷팅 (마크다운)
  const formatText = (command) => {
    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let formattedText = '';

    switch (command) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `_${selectedText}_`;
        break;
      default:
        formattedText = selectedText;
    }

    const newValue =
      textarea.value.substring(0, start) +
      formattedText +
      textarea.value.substring(end);
    setContent(newValue);
    textarea.focus();
    setTimeout(
      () =>
        textarea.setSelectionRange(
          start + formattedText.length,
          start + formattedText.length
        ),
      0
    );
  };

  const insertText = (text) => {
    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const newValue =
      textarea.value.substring(0, start) +
      text +
      textarea.value.substring(start);
    setContent(newValue);
    textarea.focus();
    setTimeout(
      () =>
        textarea.setSelectionRange(start + text.length, start + text.length),
      0
    );
  };

  // 미리보기 모달 열기
  const handlePreview = () => {
    if (!title || !content || !summary) {
      alert('제목, 내용, 한줄요약을 모두 입력해주세요.');
      return;
    }
    setIsPreviewModalOpen(true);
  };

  // 임시저장
  const handleSaveDraft = () => {
    const formData = {
      title,
      content,
      summary,
      date,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('announcement_draft', JSON.stringify(formData));

    alert('임시 저장되었습니다.');
  };

  // 게시하기 (폼 제출)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !content.trim() || !date) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('로그인 후 공지사항을 작성할 수 있습니다.');
      return;
    }

    const payload = {
      title,
      contents: content,
      summary,
      publishAt: date,
    };

    try {
      setIsSubmitting(true);
      await apiPost('/api/v1/announcements', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      localStorage.removeItem('announcement_draft');
      setIsSuccessModalOpen(true);
    } catch (error) {
      alert(error.message || '공지사항 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPreviewContent = () => {
    const rawContent = content || '';
    const html = md.render(rawContent);
    const safeHtml = DOMPurify.sanitize(html);
    
    return (
      <article>
        <header className="mb-8">
          <div className="mb-4 text-left">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold text-black"
              style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }}
            >
              공지사항
            </span>
          </div>
          <h1 className="orbitron text-3xl md:text-5xl font-bold mb-6 gradient-text text-left">
            {title}
          </h1>
          
          {/* Meta: Left aligned content */}
          <div className="article-meta widget-card rounded-lg p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between text-sm text-gray-300">
              <div className="flex items-center space-x-6 mb-2 md:mb-0">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-user text-blue-400"></i>
                  <span>작성자: 관리자</span>
                </div>
                <div className="flex items-center space-x-2">
                  <i className="fas fa-calendar text-purple-400"></i>
                  <span>
                    {new Date(date).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="article-content widget-card rounded-lg p-8 mb-8">
          <div
            className="article-body text-gray-200 text-left"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      </article>
    );
  };

  return (
    <main className="pt-20 pb-16 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 페이지 헤더 */}
        <div className="mb-8 flex justify-start">
          {' '}
          {/* flex와 justify-start 추가 */}
          <Link
            to="/announcement"
            className="btn-secondary inline-flex items-center px-6 py-3 rounded-lg text-sm font-medium text-white"
          >
            <i className="fas fa-arrow-left mr-2"></i>공지사항 목록으로 돌아가기
          </Link>
        </div>

        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center">
            <i className="fas fa-edit text-white text-xl"></i>
          </div>
          <h1 className="orbitron text-4xl md:text-5xl font-bold gradient-text mb-2">
            공지사항 작성
          </h1>
          <p className="text-gray-400">
            TCP 동아리 회원들에게 전달할 중요한 소식을 작성해주세요.
          </p>
        </div>

        {/* 작성 폼 */}
        <form onSubmit={handleSubmit} className="form-card rounded-xl p-8">
          {/* 제목 입력 */}
          <div className="mb-8">
            <label
              htmlFor="title"
              className="block text-lg font-semibold mb-3 text-white text-left"
            >
              <i className="fas fa-heading text-blue-400 mr-2"></i>제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input w-full px-4 py-3 rounded-lg text-lg"
              placeholder="공지사항 제목을 입력해주세요..."
              maxLength="100"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              ref={titleRef}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-gray-400">
                명확하고 간결한 제목을 작성해주세요.
              </p>
              <span
                className={`char-counter ${title.length > 90 ? 'warning' : ''}`}
              >
                {title.length}/100
              </span>
            </div>
          </div>

          {/* 한줄요약 입력 */}
          <div className="mb-8">
            <label
              htmlFor="summary"
              className="block text-lg font-semibold mb-3 text-white text-left"
            >
              <i className="fas fa-align-center text-purple-400 mr-2"></i>한줄요약 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="summary"
              name="summary"
              className="form-input w-full px-4 py-3 rounded-lg"
              placeholder="공지사항의 핵심 내용을 한 줄로 요약해주세요..."
              maxLength="120"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-gray-400">
                공지사항 목록에 표시될 요약 문구입니다.
              </p>
              <span
                className={`char-counter ${summary.length > 110 ? 'warning' : ''}`}
              >
                {summary.length}/120
              </span>
            </div>
          </div>

          {/* 날짜 설정 */}
          <div className="mb-8">
            <label
              htmlFor="date"
              className="block text-lg font-semibold mb-3 text-white text-left"
            >
              <i className="fas fa-calendar text-green-400 mr-2"></i>게시일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              className="form-input px-4 py-3 rounded-lg"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              max={`${new Date().getFullYear() + 10}-12-31`}
              onInvalid={(e) => {
                e.target.setCustomValidity('게시일은 오늘 날짜 이후로만 선택할 수 있습니다.');
              }}
              onInput={(e) => {
                e.target.setCustomValidity('');
              }}
            />
            <p className="text-sm text-gray-400 mt-2 text-left">
              공지사항이 게시될 날짜를 선택해주세요.
            </p>
          </div>

          {/* 내용 작성 */}
          <div className="mb-8">
            <label
              htmlFor="content"
              className="block text-lg font-semibold mb-3 text-white text-left"
            >
              <i className="fas fa-align-left text-pink-400 mr-2"></i>내용 <span className="text-red-500">*</span>
            </label>

            {/* 텍스트 서식 도구바 */}
            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-800 rounded-lg">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => formatText('bold')}
                title="굵게"
              >
                <i className="fas fa-bold"></i>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => formatText('italic')}
                title="기울임"
              >
                <i className="fas fa-italic"></i>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => formatText('underline')}
                title="밑줄"
              >
                <i className="fas fa-underline"></i>
              </button>
              <div className="border-l border-gray-600 mx-2"></div>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => insertText('• ')}
                title="불릿 포인트"
              >
                <i className="fas fa-list-ul"></i>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => insertText('1. ')}
                title="번호 목록"
              >
                <i className="fas fa-list-ol"></i>
              </button>
              <div className="border-l border-gray-600 mx-2"></div>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => insertText('📌 ')}
                title="핀 이모지"
              >
                📌
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => insertText('⚠️ ')}
                title="경고 이모지"
              >
                ⚠️
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => insertText('🎉 ')}
                title="축하 이모지"
              >
                🎉
              </button>
            </div>

            <textarea
              id="content"
              name="content"
              className="form-input w-full px-4 py-4 rounded-lg resize-none"
              rows="15"
              placeholder="공지사항 내용을 상세히 작성해주세요...
예시 구조:
- 인사말
- 주요 내용
- 세부 사항
- 문의처
- 마무리 인사"
              maxLength="3000"
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              ref={contentRef}
            ></textarea>

            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-gray-400">
                마크다운 문법을 지원합니다. (**, *, _, 등)
              </p>
              <span
                className={`char-counter ${content.length > 2800 ? 'warning' : ''}`}
              >
                {content.length}/3000
              </span>
            </div>
          </div>

          {/* 작성자 정보 */}
          <div className="mb-8">
            <label
              htmlFor="author"
              className="block text-lg font-semibold mb-3 text-white text-left"
            >
              <i className="fas fa-user text-yellow-400 mr-2"></i>작성자
            </label>
            <input
              type="text"
              id="author"
              name="author"
              className="form-input px-4 py-3 rounded-lg"
              value={author}
              readOnly
            />
          </div>

          {/* 버튼 그룹 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={handlePreview}
              className="btn-secondary px-8 py-3 rounded-lg font-medium text-white flex items-center justify-center"
            >
              <i className="fas fa-eye mr-2"></i>미리보기
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="btn-secondary px-8 py-3 rounded-lg font-medium text-white flex items-center justify-center"
            >
              <i className="fas fa-save mr-2"></i>임시저장
            </button>

            <button
              type="submit"
              className="btn-primary px-8 py-3 rounded-lg font-bold text-white flex items-center justify-center"
              disabled={isSubmitting}
            >
              <i className="fas fa-paper-plane mr-2"></i>
              {isSubmitting ? '게시 중...' : '게시하기'}
            </button>
          </div>
        </form>
      </div>

      {/* 미리보기 모달 */}
      {isPreviewModalOpen && (
        <div
          id="previewModal"
          className="fixed inset-0 preview-modal flex items-center justify-center z-50"
        >
          <div className="bg-gray-900 rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 px-6 py-4 border-b border-gray-700 flex justify-between items-center z-10">
              <h2 className="orbitron text-xl font-bold gradient-text">
                미리보기
              </h2>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              {renderPreviewContent()}
            </div>
          </div>
        </div>
      )}

      {/* 성공 메시지 모달 */}
      {isSuccessModalOpen && (
        <div
          id="successModal"
          className="fixed inset-0 preview-modal flex items-center justify-center z-50"
        >
          <div className="bg-gray-900 rounded-xl p-8 mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-blue-400 flex items-center justify-center">
              <i className="fas fa-check text-white text-xl"></i>
            </div>
            <h3 className="orbitron text-xl font-bold gradient-text mb-2">
              게시 완료!
            </h3>
            <p className="text-gray-300 mb-6">
              공지사항이 성공적으로 게시되었습니다.
            </p>
            <button
              onClick={() => navigate('/announcement')}
              className="btn-primary px-6 py-2 rounded-lg font-medium text-white"
            >
              공지사항 목록 보기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default AnnouncementWrite;
