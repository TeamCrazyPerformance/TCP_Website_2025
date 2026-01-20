import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api/client';

export default function StudyWrite() {
  const navigate = useNavigate();
  const [study, setStudy] = useState({
    title: '',
    tags: '',
    category: '스터디',
    deadline: '',
    members: 2,
    period: '',
    content: '',
    startYear: new Date().getFullYear(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStudy((prev) => ({ ...prev, [name]: value }));
  };

  const handleSliderChange = (e) => {
    setStudy((prev) => ({ ...prev, members: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('auth_user');
    const parsedUser = user ? JSON.parse(user) : null;
    if (!token || !parsedUser?.id) {
      alert('로그인 후 스터디를 개설할 수 있습니다.');
      return;
    }

    const payload = {
      study_name: study.title,
      start_year: Number(study.startYear),
      study_description: study.content,
      leader_id: parsedUser.id,
    };

    try {
      setIsSubmitting(true);
      await apiPost('/api/v1/study', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('스터디가 등록되었습니다!');
      navigate('/study');
    } catch (error) {
      alert(error.message || '스터디 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-24">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="orbitron text-4xl md:text-5xl font-bold gradient-text mb-4">
            Create New Study
          </h1>
          <p className="text-lg text-gray-400">
            새로운 스터디를 개설하여 함께 성장할 동료들을 찾아보세요.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-lg"
        >
          {/* Title */}
          <div className="mb-6">
            <label
              htmlFor="title"
              className="block text-xl font-bold text-gray-100 mb-3"
            >
              제목
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={study.title}
              onChange={handleChange}
              className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-lg focus:ring-2 focus:ring-accent-blue focus:outline-none"
              placeholder="스터디의 주제를 잘 나타내는 제목을 작성해주세요."
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-6">
            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-lg font-semibold text-gray-100 mb-3"
              >
                카테고리
              </label>
              <select
                id="category"
                name="category"
                value={study.category}
                onChange={handleChange}
                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
              >
                <option value="스터디">스터디</option>
                <option value="프로젝트">프로젝트</option>
                <option value="공모전">공모전</option>
                <option value="해커톤">해커톤</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="tags"
                className="block text-lg font-semibold text-gray-100 mb-3"
              >
                태그
              </label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={study.tags}
                onChange={handleChange}
                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
                placeholder="예: #React, #JavaScript, #초보환영 (쉼표로 구분)"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-6">
            <div>
              <label
                htmlFor="startYear"
                className="block text-lg font-semibold text-gray-100 mb-3"
              >
                시작 연도
              </label>
              <input
                type="number"
                id="startYear"
                name="startYear"
                value={study.startYear}
                onChange={handleChange}
                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-6">
            {/* Deadline */}
            <div>
              <label
                htmlFor="deadline"
                className="block text-lg font-semibold text-gray-100 mb-3"
              >
                모집 마감일
              </label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={study.deadline}
                onChange={handleChange}
                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
                required
              />
            </div>

            {/* Study Period */}
            <div>
              <label
                htmlFor="period"
                className="block text-lg font-semibold text-gray-100 mb-3"
              >
                스터디 기간
              </label>
              <input
                type="text"
                id="period"
                name="period"
                value={study.period}
                onChange={handleChange}
                className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
                placeholder="예: 3개월, 12월까지"
                required
              />
            </div>
          </div>

          {/* Member Count */}
          <div className="mb-8">
            <label
              htmlFor="members"
              className="block text-lg font-semibold text-gray-100 mb-3"
            >
              모집 인원: {' '}
              <span className="font-bold text-accent-blue">{study.members}</span>명
            </label>
            <input
              type="range"
              id="members"
              name="members"
              min="2"
              max="10"
              value={study.members}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              <span>2명</span>
              <span>10명</span>
            </div>
          </div>

          {/* Content */}
          <div className="mb-8">
            <label
              htmlFor="content"
              className="block text-xl font-bold text-gray-100 mb-3"
            >
              스터디 소개
            </label>
            <textarea
              id="content"
              name="content"
              rows="12"
              value={study.content}
              onChange={handleChange}
              className="w-full bg-gray-800 border-gray-700 rounded-lg py-3 px-4 text-base focus:ring-2 focus:ring-accent-blue focus:outline-none"
              placeholder="스터디의 목표, 진행 방식, 예상 결과물 등을 상세하게 작성해주세요."
              required
            ></textarea>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/study')}
              className="px-8 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-8 py-3 cta-button text-white font-bold rounded-lg transition-transform transform hover:scale-105"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
