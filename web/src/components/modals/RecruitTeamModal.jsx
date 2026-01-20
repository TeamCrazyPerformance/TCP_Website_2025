import React, { useState } from 'react';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import FormSelect from '../ui/FormSelect';
import { apiPost } from '../../api/client';

export default function RecruitTeamModal({ isOpen, onClose, onAddTeam }) {
  const [form, setForm] = useState({
    title: '',
    category: '',
    periodStart: '',
    periodEnd: '',
    deadline: '',
    description: '',
    neededRoles: '',
    techStack: '',
    tags: '',
    links: '',
    executionType: 'online',
    selectionProcess: '',
    contact: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onForm = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const splitCsv = (s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const parseRoles = (value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const tokens = item.split(' ').filter(Boolean);
        const lastToken = tokens[tokens.length - 1];
        const count = Number(lastToken);
        if (!Number.isNaN(count)) {
          return {
            roleName: tokens.slice(0, -1).join(' '),
            recruitCount: count,
          };
        }
        return { roleName: item, recruitCount: 1 };
      })
      .filter((role) => role.roleName);

  const formatDate = (value, separator = '.') => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${separator}${month}${separator}${day}`;
  };

  const mapResponseTeam = (team) => ({
    id: team.id,
    title: team.title,
    category: team.category,
    leader: {
      name: team.leader?.name || team.leader?.username || '팀 리더',
      avatar: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=팀',
      role: '팀 리더',
    },
    status: team.status === 'open' ? '모집중' : '모집완료',
    period: `${formatDate(team.periodStart)} – ${formatDate(team.periodEnd)}`,
    deadline: team.deadline ? formatDate(team.deadline, '-') : '',
    description: team.description,
    fullDescription: team.description,
    neededRoles: (team.roles || [])
      .map((role) => `${role.roleName} ${role.recruitCount}명`)
      .join(', '),
    participants: [
      {
        name: team.leader?.name || team.leader?.username || '팀 리더',
        role: '팀 리더',
        avatar: 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=팀',
      },
    ],
    techStack: splitCsv(team.techStack || ''),
    tags: splitCsv(team.tag || ''),
    images: team.projectImage
      ? [team.projectImage]
      : [
          'https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=2020&auto=format&fit=crop',
        ],
    links: team.link ? [team.link] : [],
    location:
      team.executionType === 'offline'
        ? '오프라인'
        : team.executionType === 'hybrid'
          ? '온/오프라인 혼합'
          : '온라인',
    selectionProcess: team.selectionProc || '지원서 검토 후 안내',
    contact: team.contact || '연락처 없음',
    goals: splitCsv(team.goals || '') || ['프로젝트 완수'],
    benefits: ['실무 경험', '포트폴리오'],
    createdAt: team.createdAt,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('로그인 후 팀 모집글을 등록할 수 있습니다.');
      return;
    }

    const payload = {
      title: form.title,
      category: form.category,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      deadline: form.deadline,
      description: form.description,
      techStack: form.techStack || undefined,
      tag: form.tags || undefined,
      goals: '',
      executionType: form.executionType,
      selectionProc: form.selectionProcess || undefined,
      link: splitCsv(form.links)[0] || undefined,
      contact: form.contact,
      projectImage: '',
      roles: parseRoles(form.neededRoles),
    };

    try {
      setIsSubmitting(true);
      const team = await apiPost('/api/v1/teams', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      onAddTeam(mapResponseTeam(team));
      // Reset form
      setForm({
        title: '',
        category: '',
        periodStart: '',
        periodEnd: '',
        deadline: '',
        description: '',
        neededRoles: '',
        techStack: '',
        tags: '',
        links: '',
        executionType: 'online',
        selectionProcess: '',
        contact: '',
      });
      onClose();
      alert('팀 모집이 성공적으로 등록되었습니다!');
    } catch (error) {
      alert(error.message || '팀 모집 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl bg-gray-900 rounded-2xl border border-gray-800 p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-2xl font-bold gradient-text">
            팀 모집 시작하기
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
            aria-label="모달 닫기"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              label="프로젝트 제목 *"
              name="title"
              value={form.title}
              onChange={onForm}
              required
              placeholder="프로젝트 제목을 입력하세요"
            />
            <FormSelect
              label="카테고리 *"
              name="category"
              value={form.category}
              onChange={onForm}
              required
              options={['해커톤', '공모전', '프로젝트', '스터디']}
            />
            <FormInput
              label="진행 기간 *"
              name="periodStart"
              type="date"
              value={form.periodStart}
              onChange={onForm}
              required
            />
            <FormInput
              label="종료 일자 *"
              name="periodEnd"
              type="date"
              value={form.periodEnd}
              onChange={onForm}
              required
            />
            <FormInput
              label="지원 마감일 *"
              name="deadline"
              type="date"
              value={form.deadline}
              onChange={onForm}
              required
            />
            <FormTextarea
              label="프로젝트 설명 *"
              name="description"
              value={form.description}
              onChange={onForm}
              required
              placeholder="무엇을 만들고 왜 하는지 적어주세요"
            />
            <FormInput
              label="모집 중인 역할 *"
              name="neededRoles"
              value={form.neededRoles}
              onChange={onForm}
              required
              placeholder="예) 기획 1, 프론트엔드 2"
            />
            <FormInput
              label="기술 스택"
              name="techStack"
              value={form.techStack}
              onChange={onForm}
              placeholder="예) React, Tailwind (쉼표로 구분)"
            />
            <FormInput
              label="태그"
              name="tags"
              value={form.tags}
              onChange={onForm}
              placeholder="예) AI, 해커톤 (쉼표로 구분)"
            />
            <FormInput
              label="관련 링크"
              name="links"
              value={form.links}
              onChange={onForm}
              placeholder="https://github.com/project (쉼표로 구분)"
            />
            <FormInput
              label="진행 방식"
              name="executionType"
              value={form.executionType}
              onChange={onForm}
              placeholder="online / offline / hybrid"
            />
            <FormInput
              label="선발 과정"
              name="selectionProcess"
              value={form.selectionProcess}
              onChange={onForm}
              placeholder="서류 → 과제 → 인터뷰"
            />
            <FormInput
              label="연락처 *"
              name="contact"
              value={form.contact}
              onChange={onForm}
              required
              placeholder="이메일 또는 오픈채팅 링크"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="cta-button px-6 py-2 rounded-lg font-medium text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '모집 시작하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
