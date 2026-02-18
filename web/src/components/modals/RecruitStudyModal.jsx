import React, { useState, useEffect } from 'react';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import { apiPost } from '../../api/client';
import { formatBirthDate } from '../../utils/dateFormatter';

export default function RecruitStudyModal({ isOpen, onClose, onAddStudy }) {
    const [form, setForm] = useState({
        title: '',
        startYear: new Date().getFullYear(),
        periodStart: '',
        periodEnd: '',
        deadline: '',
        recruitCount: 2,
        way: '',
        place: '',
        tags: '',
        description: '',
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
                place: '',
                tags: '',
                description: '',
            });
        }
    }, [isOpen]);

    const onForm = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        const formatted = formatBirthDate(value);
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

            const payload = {
                study_name: form.title,
                start_year: Number(form.startYear),
                study_description: form.description,
                apply_deadline: form.deadline,
                recruit_count: Number(form.recruitCount),
                period: `${form.periodStart} ~ ${form.periodEnd}`,
                way: form.way,
                place: form.place,
                tag: form.tags,
                leader_id: JSON.parse(localStorage.getItem('auth_user')).id,
                leader_name: JSON.parse(localStorage.getItem('auth_user')).name,
            };

            const newStudy = await apiPost('/api/v1/study', payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (onAddStudy) {
                // Map response to match Study.jsx expectations if needed, 
                // but Study.jsx refetches or we can just pass a simplified object to update UI immediately if we want.
                // For now, let's assuming fetching is better or we just alert and close.
                // Actually, Study.jsx maps the data. Let's just pass the raw or mapped data.
                // Study.jsx expects: id, year, title, period, description, tags
                const mapped = {
                    id: newStudy.id,
                    year: newStudy.start_year,
                    title: newStudy.study_name,
                    period: `${newStudy.start_year}년`, // The list view uses this format
                    description: newStudy.study_description,
                    tags: ['스터디'], // Default tag as per Study.jsx
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
            onClick={(e) => { if (e.target.className.includes('modal')) onClose(); }}
        >
            <div className="modal-content">
                <button className="close-modal" onClick={onClose}>
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
                            placeholder="YYYY.MM.DD"
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

                        {/* Tags */}
                        <FormInput
                            label="태그"
                            name="tags"
                            value={form.tags}
                            onChange={onForm}
                            placeholder="예: #React, #Java (쉼표로 구분)"
                        />

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
                                onClick={onClose}
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
