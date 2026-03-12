import React, { useState, useEffect } from 'react';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import { apiPost } from '../../api/client';
import { formatBirthDate, formatPeriodDate } from '../../utils/dateFormatter';

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

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        // periodStart/periodEnd는 YYYY.MM.DD 형식 (백엔드 요구사항)
        // deadline은 YYYY-MM-DD 형식 (ISO 날짜)
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
                    tags: form.tags
                        ? form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
                        : ['스터디'],
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
            className="modal active"
            onClick={(e) => { if (e.target.className.includes('modal')) handleSafeClose(); }}
        >
            <div className="modal-content">
                <button className="close-modal" onClick={handleSafeClose}>
                    <i className="fas fa-times" />
                </button>

                <div className="mb-6">
                    <h3 className="orbitron text-xl font-bold gradient-text text-left">
                        스터디 개설하기
                    </h3>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
                    <form onSubmit={handleSubmit} className="space-y-6 pb-2">

                        {/* Title */}
                        <FormInput
                            label={<>스터디 제목 <span className="text-red-500">*</span></>}
                            name="title"
                            value={form.title}
                            onChange={onForm}
                            required
                            placeholder="스터디 주제를 입력하세요"
                        />

                        {/* Start Year & Member Count */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormInput
                                label={<>시작 연도 <span className="text-red-500">*</span></>}
                                name="startYear"
                                type="number"
                                value={form.startYear}
                                onChange={onForm}
                                required
                            />
                            <FormInput
                                label={<>모집 인원 (본인 포함) <span className="text-red-500">*</span></>}
                                name="recruitCount"
                                type="number"
                                min="1"
                                value={form.recruitCount}
                                onChange={onForm}
                                required
                                placeholder="예: 5"
                            />
                        </div>

                        {/* Period */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                스터디 기간 (시작 ~ 종료) <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    name="periodStart"
                                    value={form.periodStart}
                                    onChange={handleDateChange}
                                    required
                                    className="form-input"
                                    style={{ maxWidth: '45%' }}
                                    placeholder="YYYY.MM.DD"
                                    maxLength={10}
                                />
                                <span className="text-gray-400">~</span>
                                <input
                                    type="text"
                                    name="periodEnd"
                                    value={form.periodEnd}
                                    onChange={handleDateChange}
                                    required
                                    className="form-input"
                                    style={{ maxWidth: '45%' }}
                                    placeholder="YYYY.MM.DD"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        {/* Deadline */}
                        <FormInput
                            label={<>모집 마감일 <span className="text-red-500">*</span></>}
                            name="deadline"
                            value={form.deadline}
                            onChange={handleDateChange}
                            required
                            placeholder="YYYY-MM-DD"
                            maxLength={10}
                        />

                        {/* Way & Place */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                        {/* Tags */}
                        <FormInput
                            label="태그"
                            name="tags"
                            value={form.tags}
                            onChange={onForm}
                            placeholder="예: #React, #Java (쉼표로 구분)"
                        />

                        {/* Public Toggle */}
                        <div className="w-full" style={{ textAlign: 'left' }}>
                            <label className="block text-left text-sm font-medium text-gray-300 mb-2">
                                공개 여부 (일반 회원 지원 가능)
                            </label>
                            <div
                                className="h-10"
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    gap: '0.75rem',
                                    textAlign: 'left',
                                }}
                            >
                                <button
                                    type="button"
                                    className={`toggle-switch border-0 p-0 ${normalizeBoolean(form.is_public) ? 'active' : ''}`}
                                    onClick={() => setForm((prev) => ({ ...prev, is_public: !normalizeBoolean(prev.is_public) }))}
                                    aria-pressed={normalizeBoolean(form.is_public)}
                                    aria-label="공개 여부 토글"
                                    style={{ margin: 0, flexShrink: 0 }}
                                ></button>
                                <span className="text-sm font-medium text-gray-300">
                                    {normalizeBoolean(form.is_public) ? '공개' : '비공개'}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <FormTextarea
                            label={<>스터디 소개 <span className="text-red-500">*</span></>}
                            name="description"
                            value={form.description}
                            onChange={onForm}
                            required
                            placeholder="스터디 목표, 진행 방식 등을 상세히 작성해주세요"
                            rows={5}
                        />

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-800">
                            <button
                                type="button"
                                onClick={handleSafeClose}
                                className="px-6 py-2 border border-gray-600 rounded-lg hover:border-gray-400 text-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className="cta-button px-8 py-2 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? '처리 중...' : '스터디 개설하기'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
