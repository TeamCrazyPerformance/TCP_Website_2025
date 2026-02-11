import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { apiPost, apiPatch, apiGet, apiDelete } from '../api/client';
import { formatBirthDate } from '../utils/dateFormatter';

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
                    // We need an endpoint to get single progress. 
                    // Current StudyController only has findProgressByStudyId (list).
                    // We need GET /api/v1/study/:id/progress/:progressId ??
                    // Controller doesn't have it! I need to add it or fetch list and filter.
                    // Fetching list is inefficient but works for now if list is small.
                    const progressList = await apiGet(`/api/v1/study/${id}/progress`);
                    const progress = progressList.find(p => p.id === parseInt(progressId));

                    if (progress) {
                        setTitle(progress.title);
                        setContent(progress.content);
                        setWeekNo(progress.weekNo);
                        setDate(progress.progressDate ? new Date(progress.progressDate).toISOString().split('T')[0].replace(/-/g, '.') : '');
                        setUploadedFiles(progress.resources || []);
                    } else {
                        alert('Progress report not found.');
                        navigate(`/study/${id}`);
                    }
                } catch (error) {
                    console.error(error);
                    alert('Failed to load progress report.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchProgress();
        } else {
            // Default date to today
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
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

        // Limit to 3 files total? Or just upload one by one.
        // Mockup says "attachments".

        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await apiPost(`/api/v1/study/${id}/resources`, formData);
                setUploadedFiles(prev => [...prev, response]);
            } catch (error) {
                alert(`Failed to upload ${file.name}`);
                console.error(error);
            }
        }
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = async (resourceId) => {
        if (!window.confirm('Delete this file?')) return;
        try {
            await apiDelete(`/api/v1/study/${id}/resources/${resourceId}`);
            setUploadedFiles(prev => prev.filter(f => f.id !== resourceId));
        } catch (error) {
            alert('Failed to delete file.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !content || !weekNo || !date) {
            alert('Please fill in all required fields.');
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
                alert('Progress report updated!');
            } else {
                await apiPost(`/api/v1/study/${id}/progress`, payload);
                alert('Progress report created!');
            }
            navigate(`/study/${id}`);
        } catch (error) {
            alert('Failed to save progress report.');
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
            <div className="article-content widget-card rounded-lg p-8 mb-8">
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                <div className="text-gray-400 mb-4">Week {weekNo} | {date}</div>
                <div className="article-body text-gray-200 text-left" dangerouslySetInnerHTML={{ __html: safeHtml }} />
                {uploadedFiles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h3 className="font-bold mb-2">Attachments</h3>
                        <ul className="list-disc pl-5">
                            {uploadedFiles.map(f => (
                                <li key={f.id}>{f.name}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) return <div className="pt-20 text-center text-white">Loading...</div>;

    return (
        <main className="pt-20 pb-16 min-h-screen">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="mb-8">
                    <Link to={`/study/${id}`} className="text-gray-400 hover:text-white">
                        <i className="fas fa-arrow-left mr-2"></i> Back to Study
                    </Link>
                </div>

                <h1 className="orbitron text-3xl font-bold gradient-text mb-8">
                    {isEditMode ? 'Edit Progress Report' : 'Write Progress Report'}
                </h1>

                <form onSubmit={handleSubmit} className="form-card rounded-xl p-8">
                    {/* Week & Date Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-white mb-2">Week No <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="1"
                                className="form-input w-full px-4 py-3 rounded-lg"
                                value={weekNo}
                                onChange={e => setWeekNo(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-white mb-2">Date <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="form-input w-full px-4 py-3 rounded-lg"
                                value={date}
                                placeholder="YYYY.MM.DD"
                                onChange={e => setDate(formatBirthDate(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="mb-6">
                        <label className="block text-white mb-2">Title <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="form-input w-full px-4 py-3 rounded-lg"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    {/* Content Toolbar & Textarea */}
                    <div className="mb-6">
                        <label className="block text-white mb-2">Content <span className="text-red-500">*</span></label>
                        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-800 rounded-lg">
                            <button type="button" className="toolbar-btn" onClick={() => formatText('bold')}><i className="fas fa-bold"></i></button>
                            <button type="button" className="toolbar-btn" onClick={() => formatText('italic')}><i className="fas fa-italic"></i></button>
                            <button type="button" className="toolbar-btn" onClick={() => insertText('• ')}><i className="fas fa-list-ul"></i></button>
                            {/* Add more buttons as needed */}
                        </div>
                        <textarea
                            className="form-input w-full px-4 py-4 rounded-lg resize-none font-mono"
                            rows="15"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            ref={contentRef}
                            required
                        ></textarea>
                    </div>

                    {/* File Upload */}
                    <div className="mb-8">
                        <label className="block text-white mb-2">Attachments</label>
                        <div className="flex items-center gap-4 mb-4">
                            <button
                                type="button"
                                className="btn-secondary px-4 py-2 rounded-lg text-sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="fas fa-paperclip mr-2"></i> Add Files
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
                                    <li key={file.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                                        <span className="text-gray-300 text-sm truncate">{file.name}</span>
                                        <button type="button" onClick={() => handleRemoveFile(file.id)} className="text-red-400 hover:text-red-300">
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            className="btn-secondary px-6 py-3 rounded-lg text-white"
                            onClick={() => setIsPreviewModalOpen(true)}
                        >
                            Preview
                        </button>
                        <button
                            type="submit"
                            className="btn-primary px-6 py-3 rounded-lg text-white font-bold"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Progress'}
                        </button>
                    </div>
                </form>

                {/* Preview Modal */}
                {isPreviewModalOpen && (
                    <div className="fixed inset-0 preview-modal flex items-center justify-center z-50 bg-black bg-opacity-80">
                        <div className="bg-gray-900 rounded-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6 relative">
                            <button
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            >
                                <i className="fas fa-times text-xl"></i>
                            </button>
                            {renderPreviewContent()}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default StudyProgressWrite;
