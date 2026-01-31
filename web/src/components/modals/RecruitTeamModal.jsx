import React, { useEffect, useState } from 'react';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import FormSelect from '../ui/FormSelect';
import { apiPost, apiPatch } from '../../api/client';

export default function RecruitTeamModal({ isOpen, onClose, onAddTeam, onUpdateTeam, initialData }) {
  const [form, setForm] = useState({
    title: '',
    category: '',
    periodStart: '',
    periodEnd: '',
    deadline: '',
    description: '',
    techStack: '',
    goals: '',
    executionType: 'online',
    selectionProcess: '',
    contact: '',
    link: '',
    projectImage: '',
  });

  const [roles, setRoles] = useState([{ id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData;

  useEffect(() => {
    if (isOpen && initialData) {
      setForm({
        title: initialData.title || '',
        category: initialData.category || '',
        periodStart: initialData.periodStart ? new Date(initialData.periodStart).toISOString().split('T')[0] : '',
        periodEnd: initialData.periodEnd ? new Date(initialData.periodEnd).toISOString().split('T')[0] : '',
        deadline: initialData.deadlineDate ? new Date(initialData.deadlineDate).toISOString().split('T')[0] : '',
        description: initialData.description || '',
        techStack: Array.isArray(initialData.techStackRaw) ? initialData.techStackRaw.join(', ') : initialData.techStackRaw || '',
        goals: Array.isArray(initialData.goals) ? initialData.goals.join(', ') : initialData.goals || '',
        executionType: initialData.executionTypeRaw || 'online',
        selectionProcess: initialData.selectionProcess || '',
        contact: initialData.contact || '',
        link: Array.isArray(initialData.linksRaw) ? initialData.linksRaw.join(', ') : initialData.linksRaw || '',
        projectImage: '', // Image URL logic if needed
      });

      if (initialData.rolesRaw && initialData.rolesRaw.length > 0) {
        setRoles(
          initialData.rolesRaw.map((r) => ({
            id: r.id,
            roleName: r.roleName,
            recruitCount: r.recruitCount,
            isDeleted: false,
          }))
        );
      } else {
        setRoles([{ id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
      }

    } else if (isOpen && !initialData) {
      // Reset form
      setForm({
        title: '',
        category: '',
        periodStart: '',
        periodEnd: '',
        deadline: '',
        description: '',
        techStack: '',
        goals: '',
        executionType: 'online',
        selectionProcess: '',
        contact: '',
        link: '',
        projectImage: '',
      });
      setRoles([{ id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
    }
  }, [isOpen, initialData]);

  const onForm = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ---- Role Handlers ----
  const handleAddRole = () => {
    setRoles((prev) => [...prev, { id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
  };

  const handleRemoveRole = (index) => {
    setRoles((prev) => {
      const newRoles = [...prev];
      if (newRoles[index].id) {
        // 기존에 있던 역할이면 isDeleted = true
        newRoles[index].isDeleted = true;
      } else {
        // 새로 추가하던 역할이면 배열에서 제거
        newRoles.splice(index, 1);
      }
      return newRoles;
    });
  };

  const handleRoleChange = (index, field, value) => {
    setRoles((prev) => {
      const newRoles = [...prev];
      newRoles[index][field] = value;
      return newRoles;
    });
  };

  // ---- Helper ----
  const splitCsv = (s) => {
    if (!s) return [];
    if (Array.isArray(s)) return s;
    return s.split(',').map((v) => v.trim()).filter(Boolean);
  };

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
    leaderId: team.leader?.id,
    title: team.title,
    category: team.category,
    leader: {
      name: team.leader?.name || team.leader?.username || '팀 리더',
      avatar: team.leader?.profile_image || 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=팀',
      role: '팀 리더',
    },
    status: team.status === 'open' ? '모집중' : '모집완료',
    period: `${formatDate(team.periodStart)} – ${formatDate(team.periodEnd)}`,
    periodStart: team.periodStart,
    periodEnd: team.periodEnd,
    deadline: team.deadline ? formatDate(team.deadline, '-') : '',
    deadlineDate: team.deadline,
    description: team.description,
    fullDescription: team.description,
    neededRoles: (team.roles || [])
      .map((role) => `${role.roleName} ${role.recruitCount}명`)
      .join(', '),
    rolesRaw: team.roles,
    participants: [
      {
        name: team.leader?.name || team.leader?.username || '팀 리더',
        role: '팀 리더',
        avatar: team.leader?.profile_image || 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=팀',
      },
    ],
    techStack: splitCsv(team.techStack || ''),
    techStackRaw: team.techStack,
    tags: splitCsv(team.tag || ''),
    tagsRaw: team.tag,
    images: team.projectImage ? [team.projectImage] : [],
    links: team.link ? [team.link] : [],
    linksRaw: team.link,
    location:
      team.executionType === 'offline'
        ? '오프라인'
        : team.executionType === 'hybrid'
          ? '온/오프라인 혼합'
          : '온라인',
    executionTypeRaw: team.executionType,
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
      alert('로그인 후 팀 모집글을 등록/수정할 수 있습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      let team;

      if (isEditMode) {
        const rolesToAdd = roles
          .filter((r) => !r.id && !r.isDeleted && r.roleName.trim())
          .map((r) => ({ roleName: r.roleName, recruitCount: Number(r.recruitCount) }));

        const rolesToUpdate = roles
          .filter((r) => r.id) // 기존 ID가 있는 것들
          .map((r) => {
            if (r.isDeleted) return { id: r.id, action: 'delete' };
            return { id: r.id, roleName: r.roleName, recruitCount: Number(r.recruitCount) };
          });

        const payload = {
          title: form.title,
          category: form.category,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          deadline: form.deadline,
          description: form.description,
          techStack: form.techStack,
          tag: form.tags, // TODO: Add tags input if needed, mapping to same logic
          goals: form.goals,
          executionType: form.executionType,
          selectionProc: form.selectionProcess,
          contact: form.contact,
          link: form.link,
          // projectImage: ... // Not implemented
          rolesToAdd: rolesToAdd.length > 0 ? rolesToAdd : undefined,
          rolesToUpdate: rolesToUpdate.length > 0 ? rolesToUpdate : undefined,
        };

        team = await apiPatch(`/api/v1/teams/${initialData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (onUpdateTeam) onUpdateTeam(mapResponseTeam(team));
        alert('모집글이 수정되었습니다.');

      } else {
        // Create Mode
        const validRoles = roles
          .filter((r) => !r.isDeleted && r.roleName.trim())
          .map((r) => ({ roleName: r.roleName, recruitCount: Number(r.recruitCount) }));

        if (validRoles.length === 0) {
          alert('최소 하나의 역할이 필요합니다.');
          setIsSubmitting(false);
          return;
        }

        const payload = {
          title: form.title,
          category: form.category || '프로젝트',
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          deadline: form.deadline,
          description: form.description,
          techStack: form.techStack,
          goals: form.goals,
          executionType: form.executionType,
          selectionProc: form.selectionProcess,
          contact: form.contact,
          link: form.link,
          roles: validRoles,
        };

        team = await apiPost('/api/v1/teams', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (onAddTeam) onAddTeam(mapResponseTeam(team));
        alert('모집글이 등록되었습니다.');
      }

      onClose();
    } catch (error) {
      alert(error.message || '처리 중 오류가 발생했습니다.');
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
            {isEditMode ? '팀 모집 수정하기' : '팀 모집 시작하기'}
          </h3>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
          <form onSubmit={handleSubmit} className="space-y-6 pb-2">

            {/* Project Image (Mock UI) */}
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-300 mb-2 text-left">프로젝트 이미지</label>
              <div className="flex items-center gap-3">
                <button type="button" className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300">
                  파일 선택
                </button>
                <span className="text-gray-300 text-sm">선택된 파일 없음</span>
              </div>
            </div>

            {/* Row 1: Title & Category */}
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
                placeholder="카테고리를 선택하세요"
              />
            </div>

            {/* Row 2: Period & Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">진행 기간 (시작 ~ 종료) *</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    name="periodStart"
                    value={form.periodStart}
                    onChange={onForm}
                    required
                    className="form-input"
                    style={{ maxWidth: '45%' }}
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="text"
                    name="periodEnd"
                    value={form.periodEnd}
                    onChange={onForm}
                    required
                    className="form-input"
                    style={{ maxWidth: '45%' }}
                    placeholder="YYYY-MM-DD"
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              </div>
              <FormInput
                label="지원 마감일 *"
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={onForm}
                required
                min="0000-01-01"
                max="9999-12-31"
              />
            </div>

            {/* Row 3: Description */}
            <FormTextarea
              label="프로젝트 설명 *"
              name="description"
              value={form.description}
              onChange={onForm}
              required
              placeholder="프로젝트에 대한 상세 설명을 입력하세요"
              rows={5}
            />

            {/* Row 4: Roles (Dynamic) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">필요한 역할 *</label>
              <div className="space-y-3 mb-3">
                {roles.map((role, idx) => !role.isDeleted && (
                  <div key={idx} className="flex gap-3 items-center">
                    <input
                      type="text"
                      placeholder="역할명 (예: 프론트엔드)"
                      className="form-input"
                      style={{ flex: '6' }}
                      value={role.roleName}
                      onChange={(e) => handleRoleChange(idx, 'roleName', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="인원"
                      className="form-input"
                      style={{ flex: '1' }}
                      value={role.recruitCount}
                      onChange={(e) => handleRoleChange(idx, 'recruitCount', e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(idx)}
                      className="form-input text-gray-400 hover:text-red-400 transition-colors"
                      style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0.75rem' }}
                    >
                      <i className="fas fa-minus" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddRole}
                className="add-btn text-sm font-medium"
              >
                <i className="fas fa-plus" /> 역할 추가
              </button>
            </div>

            {/* Row 5: Tech Stack */}
            <FormInput
              label="기술 스택"
              name="techStack"
              value={form.techStack}
              onChange={onForm}
              placeholder="예) React, Node.js"
            />

            {/* Row 6: Tags */}
            <FormInput
              label="태그"
              name="tags"
              value={form.tags || ''}
              onChange={onForm}
              placeholder="예) AI, 해커톤(쉼표로 구분)"
            />

            {/* Row 7: Goals */}
            <FormInput
              label="프로젝트 목표"
              name="goals"
              value={form.goals}
              onChange={onForm}
              placeholder="프로젝트 완성, 실무 경험 (쉼표로 구분)"
            />

            {/* Row 8: Execution & Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormSelect
                label="진행 방식"
                name="executionType"
                value={form.executionType}
                onChange={onForm}
                options={['온라인', '오프라인', '온라인+오프라인']}
              />
              <FormInput
                label="선발 과정"
                name="selectionProcess"
                value={form.selectionProcess}
                onChange={onForm}
                placeholder="포트폴리오 검토 -> 간단한 면담"
              />
            </div>

            {/* Row 8: Link */}
            <FormInput
              label="관련 링크"
              name="link"
              value={form.link}
              onChange={onForm}
              placeholder="https://github.com/project (쉼표로 구분)"
            />

            {/* Row 9: Contact */}
            <FormInput
              label="연락처 *"
              name="contact"
              value={form.contact}
              onChange={onForm}
              required
              placeholder="이메일 또는 오픈채팅 링크"
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
                {isSubmitting ? '처리 중...' : (isEditMode ? '수정완료' : '모집 시작하기')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
