import React, { useState, useEffect, useRef } from 'react';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import { apiPost } from '../../api/client';
import { formatBirthDate, formatPeriodDate } from '../../utils/dateFormatter';
import { parseTags } from '../../utils/helpers';
import '../../styles/studyRecruitModal.css';

export default function RecruitStudyModal({ isOpen, onClose, onAddStudy }) {
    const normalizeBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';

    const [form, setForm] = useState({
        title: '',
        startYear: new Date().getFullYear(),
        periodStart: '',
        periodEnd: '',
        deadline: '',
        recruitCount: 2,
        way: '',
        cycle: '',
        place: '',
        tags: '',
        description: '',
        is_public: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSafeCloseRef = useRef(() => {});

    useEffect(() => {
        if (isOpen) {
            setForm({
                title: '',
                startYear: new Date().getFullYear(),
                periodStart: '',
                periodEnd: '',
                deadline: '',
                recruitCount: 2,
                way: '',
                cycle: '',
                place: '',
                tags: '',
                description: '',
                is_public: false,
            });
        }
    }, [isOpen]);

    const onForm = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const hasContent = () => {
        return form.title || form.periodStart || form.periodEnd || form.deadline || form.way || form.cycle || form.place || form.tags || form.description;
    };

    const handleSafeClose = () => {
        if (hasContent() && !window.confirm('작성 중인 내용이 있습니다. 정말 닫으시겠습니까?')) return;
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') handleSafeCloseRef.current();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    handleSafeCloseRef.current = handleSafeClose;

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        // periodStart/periodEnd use YYYY.MM.DD as the backend expects
        // deadline uses the ISO YYYY-MM-DD form
        const formatted = (name === 'periodStart' || name === 'periodEnd')
            ? formatPeriodDate(value)
            : formatBirthDate(value);
        setForm((prev) => ({ ...prev, [name]: formatted }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('access_token');
        if (!token) {
            alert('로그인 후 스터디를 개설할 수 있습니다.');
            return;
        }

        try {
            setIsSubmitting(true);

            const authUser = JSON.parse(localStorage.getItem('auth_user'));
            if (!authUser?.id) {
                alert('로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
                return;
            }

            const payload = {
                study_name: form.title,
                start_year: Number(form.startYear),
                study_description: form.description,
                apply_deadline: form.deadline,
                recruit_count: Number(form.recruitCount),
                period: `${form.periodStart} ~ ${form.periodEnd}`,
                way: form.way,
                cycle: form.cycle,
                place: form.place,
                tag: form.tags,
                is_public: form.is_public,
            };

            const newStudy = await apiPost('/api/v1/study', payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (onAddStudy) {
                const mapped = {
                    id: newStudy.id,
                    year: Number(form.startYear),
                    title: form.title,
                    period: `${form.periodStart} ~ ${form.periodEnd}`,
                    description: form.description,
                    tags: parseTags(form.tags).length ? parseTags(form.tags) : ['스터디'],
                    is_public: normalizeBoolean(newStudy?.is_public ?? form.is_public),
                };
                onAddStudy(mapped);
            }

            alert('스터디가 등록되었습니다!');
            onClose();
        } catch (error) {
            alert(error.message || '스터디 등록에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal active study-recruit-modal"
            onClick={(e) => { if (e.target === e.currentTarget) handleSafeClose(); }}
        >
            <section
                className="modal-content study-recruit-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="studyRecruitTitle"
                aria-describedby="studyRecruitDescription"
            >
                <header className="study-recruit-header">
                    <div className="study-recruit-heading">
                        <h2 id="studyRecruitTitle" className="orbitron gradient-text">
                            스터디 개설하기
                        </h2>
                        <p id="studyRecruitDescription">
                            별표 표시된 항목을 채운 뒤 개설해 주세요.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="close-modal study-recruit-close"
                        onClick={handleSafeClose}
                        aria-label="스터디 개설 창 닫기"
                    >
                        <i className="fas fa-times" aria-hidden="true" />
                    </button>
                </header>

                <form className="study-recruit-form" onSubmit={handleSubmit}>
                    <div className="study-recruit-scroll">
                        <FormInput
                            label={<>스터디 제목 <span className="study-recruit-required">*</span></>}
                            name="title"
                            value={form.title}
                            onChange={onForm}
                            required
                            placeholder="스터디 주제를 입력하세요"
                        />

                        <div className="study-recruit-grid">
                            <FormInput
                                label={<>시작 연도 <span className="study-recruit-required">*</span></>}
                                name="startYear"
                                type="number"
                                value={form.startYear}
                                onChange={onForm}
                                required
                            />
                            <FormInput
                                label={<>모집 인원 (본인 포함) <span className="study-recruit-required">*</span></>}
                                name="recruitCount"
                                type="number"
                                min="1"
                                value={form.recruitCount}
                                onChange={onForm}
                                required
                                placeholder="예: 5"
                            />
                        </div>

                        <div>
                            <span className="study-recruit-label">
                                스터디 기간 <span className="study-recruit-required">*</span>
                            </span>
                            <div className="study-recruit-range">
                                <input
                                    type="text"
                                    name="periodStart"
                                    value={form.periodStart}
                                    onChange={handleDateChange}
                                    required
                                    className="form-input"
                                    placeholder="YYYY.MM.DD"
                                    inputMode="numeric"
                                    aria-label="스터디 시작일"
                                    maxLength={10}
                                />
                                <span aria-hidden="true">~</span>
                                <input
                                    type="text"
                                    name="periodEnd"
                                    value={form.periodEnd}
                                    onChange={handleDateChange}
                                    required
                                    className="form-input"
                                    placeholder="YYYY.MM.DD"
                                    inputMode="numeric"
                                    aria-label="스터디 종료일"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <FormInput
                            label={<>모집 마감일 <span className="study-recruit-required">*</span></>}
                            name="deadline"
                            value={form.deadline}
                            onChange={handleDateChange}
                            required
                            placeholder="YYYY-MM-DD"
                            inputMode="numeric"
                            maxLength={10}
                        />

                        <div className="study-recruit-grid">
                            <FormInput
                                label="진행 방식"
                                name="way"
                                value={form.way}
                                onChange={onForm}
                                placeholder="예: 온라인, 오프라인"
                            />
                            <FormInput
                                label="장소"
                                name="place"
                                value={form.place}
                                onChange={onForm}
                                placeholder="예: 디스코드, 도서관"
                            />
                        </div>

                        <FormInput
                            label="주기"
                            name="cycle"
                            value={form.cycle}
                            onChange={onForm}
                            placeholder="예: 주 1회, 격주"
                        />

                        <FormInput
                            label="태그"
                            name="tags"
                            value={form.tags}
                            onChange={onForm}
                            placeholder="예: React, TypeScript (쉼표로 구분)"
                        />

                        <div>
                            <span className="study-recruit-label">공개 여부</span>
                            <div className="study-recruit-toggle-row">
                                <button
                                    type="button"
                                    className={`toggle-switch ${normalizeBoolean(form.is_public) ? 'active' : ''}`}
                                    onClick={() => setForm((prev) => ({ ...prev, is_public: !normalizeBoolean(prev.is_public) }))}
                                    aria-pressed={normalizeBoolean(form.is_public)}
                                    aria-label="공개 여부 토글"
                                />
                                <span className="study-recruit-toggle-state">
                                    {normalizeBoolean(form.is_public) ? '공개' : '비공개'}
                                </span>
                            </div>
                            <p className="study-recruit-hint">
                                공개로 두면 TCP 회원 누구나 이 스터디를 보고 지원할 수 있습니다.
                            </p>
                        </div>

                        <FormTextarea
                            label={<>스터디 소개 <span className="study-recruit-required">*</span></>}
                            name="description"
                            value={form.description}
                            onChange={onForm}
                            required
                            placeholder="스터디 목표, 진행 방식 등을 상세히 작성해주세요"
                            rows={5}
                        />
                    </div>

                    <footer className="study-recruit-footer">
                        <button
                            type="button"
                            className="study-recruit-cancel"
                            onClick={handleSafeClose}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="study-recruit-submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '처리 중...' : '스터디 개설하기'}
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
}
