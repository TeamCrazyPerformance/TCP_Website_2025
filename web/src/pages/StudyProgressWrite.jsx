import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { apiPost, apiPatch, apiGet, apiDelete } from '../api/client';
import WritingPreviewModal from '../components/public/WritingPreviewModal';
import BackToListLink from '../components/public/BackToListLink';
import '../styles/studyDetail.css';
import '../styles/studyProgressWrite.css';

const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
});

function StudyProgressWrite() {
    const navigate = useNavigate();
    const { id, progressId } = useParams(); // id = studyId, progressId if editing
    const isEditMode = Boolean(progressId);

    // Form State
    const [weekNo, setWeekNo] = useState('');
    const [date, setDate] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]); // Array of { id, name, format }
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);

    // Preview Modal
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Refs
    const contentRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isEditMode && progressId) {
            const fetchProgress = async () => {
                try {
                    setIsLoading(true);
                    const progressList = await apiGet(`/api/v1/study/${id}/progress`);
                    const progress = progressList.find(p => p.id === parseInt(progressId));

                    if (progress) {
                        setTitle(progress.title);
                        setContent(progress.content);
                        setWeekNo(progress.weekNo);
                        setDate(progress.progressDate ? new Date(progress.progressDate).toISOString().split('T')[0] : '');
                        setUploadedFiles(progress.resources || []);
                    } else {
                        alert('진행 글을 찾을 수 없습니다.');
                        navigate(`/study/${id}`);
                    }
                } catch (error) {
                    console.error(error);
                    alert('진행 글을 불러오지 못했습니다.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchProgress();
        } else {
            // Default date to today
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
        }
    }, [isEditMode, id, progressId, navigate]);

    // Markdown Formatting Logic (Reuse from AnnouncementWrite)
    const formatText = (command) => {
        const textarea = contentRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let formattedText = '';

        switch (command) {
            case 'bold': formattedText = `**${selectedText}**`; break;
            case 'italic': formattedText = `*${selectedText}*`; break;
            case 'underline': formattedText = `_${selectedText}_`; break;
            default: formattedText = selectedText;
        }

        const newValue = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
        setContent(newValue);
        textarea.focus();
        setTimeout(() => textarea.setSelectionRange(start + formattedText.length, start + formattedText.length), 0);
    };

    const insertText = (text) => {
        const textarea = contentRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const newValue = textarea.value.substring(0, start) + text + textarea.value.substring(start);
        setContent(newValue);
        textarea.focus();
        setTimeout(() => textarea.setSelectionRange(start + text.length, start + text.length), 0);
    };

    // File Upload Handler
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await apiPost(`/api/v1/study/${id}/resources`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setUploadedFiles(prev => [...prev, response]);
            } catch (error) {
                alert(`${file.name} 파일을 업로드하지 못했습니다.`);
                console.error(error);
            }
        }
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = async (resourceId) => {
        if (!window.confirm('첨부파일을 삭제하시겠습니까?')) return;
        try {
            await apiDelete(`/api/v1/study/${id}/resources/${resourceId}`);
            setUploadedFiles(prev => prev.filter(f => f.id !== resourceId));
        } catch (error) {
            alert('첨부파일을 삭제하지 못했습니다.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content || !weekNo || !date) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        const payload = {
            title,
            content,
            weekNo: parseInt(weekNo),
            progressDate: date,
            resourceIds: uploadedFiles.map(f => f.id),
        };

        try {
            setIsSubmitting(true);
            if (isEditMode) {
                await apiPatch(`/api/v1/study/${id}/progress/${progressId}`, payload);
                alert('진행 글이 수정되었습니다.');
            } else {
                await apiPost(`/api/v1/study/${id}/progress`, payload);
                alert('진행 글이 등록되었습니다.');
            }
            navigate(`/study/${id}`);
        } catch (error) {
            alert('진행 글을 저장하지 못했습니다.');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Preview
    const renderPreviewContent = () => {
        const html = md.render(content || '');
        const safeHtml = DOMPurify.sanitize(html);
        return (
            <article className="writing-preview-content">
                <header className="writing-preview-heading">
                    <div className="writing-preview-meta">
                        <span className="writing-preview-week">{weekNo ? `${weekNo}주차` : '주차 미입력'}</span>
                        <span><i className="far fa-calendar mr-2" aria-hidden="true"></i>{date ? date.replace(/-/g, '.') : '진행일 미입력'}</span>
                    </div>
                    <h3>{title.trim() || '제목을 입력해주세요'}</h3>
                </header>
                {content.trim() ? (
                    <div className="writing-preview-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
                ) : (
                    <p className="writing-preview-empty">작성한 내용이 여기에 표시됩니다.</p>
                )}
                {uploadedFiles.length > 0 && (
                    <section className="writing-preview-attachments" aria-label="첨부파일">
                        <h4>첨부파일 <span>{uploadedFiles.length}</span></h4>
                        <ul>
                            {uploadedFiles.map(f => (
                                <li key={f.id}><i className="fas fa-paperclip" aria-hidden="true"></i><span>{f.name}</span></li>
                            ))}
                        </ul>
                    </section>
                )}
            </article>
        );
    };

    if (isLoading) return <div className="pt-20 text-center text-white">진행 글을 불러오는 중...</div>;

    return (
        <main className="study-detail-page study-progress-page">
            <div className="study-detail-shell container mx-auto px-4">
                <nav className="detail-breadcrumb study-detail-breadcrumb mb-8" aria-label="현재 위치">
                    <BackToListLink to={`/study/${id}`}>스터디로 돌아가기</BackToListLink>
                </nav>

                <header className="study-progress-heading">
                    <p className="study-progress-eyebrow">주차별 진행 현황</p>
                    <h1 className="study-detail-title">
                        {isEditMode ? '진행 글 수정' : '진행 글 작성'}
                    </h1>
                    <p className="study-progress-description">이번 주에 함께 공부한 내용과 진행 상황을 기록해주세요.</p>
                </header>

                <form onSubmit={handleSubmit} className="study-detail-surface study-progress-form">
                    {/* Week & Date Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label htmlFor="progress-weekNo" className="study-progress-label">주차 <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="1"
                                className="form-input w-full px-4 py-3 rounded-lg"
                                id="progress-weekNo"
                                value={weekNo}
                                onChange={e => setWeekNo(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="progress-date" className="study-progress-label">진행일 <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className="form-input w-full px-4 py-3 rounded-lg"
                                id="progress-date"
                                value={date}
                                placeholder="YYYY-MM-DD"
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="mb-6">
                        <label htmlFor="progress-title" className="study-progress-label">제목 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="form-input w-full px-4 py-3 rounded-lg"
                            id="progress-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    {/* Content Toolbar & Textarea */}
                    <div className="mb-6">
                        <label htmlFor="progress-content" className="study-progress-label">내용 <span className="text-red-500">*</span></label>
                        <div className="study-progress-toolbar">
                            <button type="button" className="toolbar-btn" aria-label="굵게" title="굵게" onClick={() => formatText('bold')}><i className="fas fa-bold"></i></button>
                            <button type="button" className="toolbar-btn" aria-label="기울임" title="기울임" onClick={() => formatText('italic')}><i className="fas fa-italic"></i></button>
                            <button type="button" className="toolbar-btn" aria-label="목록" title="목록" onClick={() => insertText('- ')}><i className="fas fa-list-ul"></i></button>
                        </div>
                        <textarea
                            className="form-input w-full px-4 py-4 rounded-lg study-progress-content"
                            rows="12"
                            placeholder="학습한 내용, 진행 결과, 다음 주 계획을 작성해주세요."
                            id="progress-content"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            ref={contentRef}
                            required
                        ></textarea>
                        <p className="study-progress-hint">마크다운 문법을 지원합니다. 미리보기에서 작성한 내용을 확인하실 수 있습니다.</p>
                    </div>

                    {/* File Upload */}
                    <div className="mb-8">
                        <p className="study-progress-label">첨부파일</p>
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                type="button"
                                className="study-detail-action study-detail-action-secondary"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="fas fa-paperclip mr-2"></i> 파일 첨부
                            </button>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                        {uploadedFiles.length > 0 && (
                            <ul className="space-y-2">
                                {uploadedFiles.map(file => (
                                    <li key={file.id} className="study-progress-file">
                                        <span className="text-gray-300 text-sm truncate">{file.name}</span>
                                        <button type="button" aria-label={`${file.name} 삭제`} onClick={() => handleRemoveFile(file.id)} className="text-red-400 hover:text-red-300">
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="study-progress-actions">
                        <button
                            type="button"
                            className="study-detail-action study-detail-action-secondary"
                            onClick={() => setIsPreviewModalOpen(true)}
                        >
                            미리보기
                        </button>
                        <button
                            type="submit"
                            className="study-detail-action cta-button primary-cta-text"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '저장 중...' : isEditMode ? '수정하기' : '등록하기'}
                        </button>
                    </div>
                </form>

                {/* Preview Modal */}
                {isPreviewModalOpen && (
                    <WritingPreviewModal title="진행 글 미리보기" onClose={() => setIsPreviewModalOpen(false)}>
                        {renderPreviewContent()}
                    </WritingPreviewModal>
                )}
            </div>
        </main>
    );
}

export default StudyProgressWrite;
