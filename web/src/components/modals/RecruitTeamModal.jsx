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
    tags: '',
    projectImage: '',
  });

  const [roles, setRoles] = useState([{ id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
        tags: Array.isArray(initialData.tagsRaw) ? initialData.tagsRaw.join(', ') : initialData.tagsRaw || '',
        projectImage: initialData.projectImage || '',
      });

      // 기존 이미지 미리보기 설정
      setImageFile(null);
      if (initialData.projectImage) {
        setImagePreview(initialData.projectImage);
      } else {
        setImagePreview('');
      }

      // 역할 설정
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
        tags: '',
        projectImage: '',
      });
      setRoles([{ id: null, roleName: '', recruitCount: 1, isDeleted: false }]);
      setImageFile(null);
      setImagePreview('');
    }
  }, [isOpen, initialData]);

  const onForm = (e) => {
    let value = e.target.value;
    
    // executionType 변환: 한글 -> 영어 (데이터 저장용)
    if (e.target.name === 'executionType') {
      const executionTypeMap = {
        '온라인': 'online',
        '오프라인': 'offline',
        '온라인+오프라인': 'hybrid'
      };
      value = executionTypeMap[value] || value;
    }
    
    setForm((f) => ({ ...f, [e.target.name]: value }));
  };
  
  // executionType을 표시용 한글로 변환
  const getExecutionTypeDisplay = () => {
    const executionTypeReverseMap = {
      'online': '온라인',
      'offline': '오프라인',
      'hybrid': '온라인+오프라인'
    };
    return executionTypeReverseMap[form.executionType] || '온라인';
  };

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

  // 이미지 파일 선택 핸들러
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('이미지 파일만 업로드 가능합니다 (jpeg, jpg, png, gif, webp)');
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    setImageFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 기존 이미지 삭제 함수
  const deleteOldImage = async (imageUrl) => {
    if (!imageUrl) return;
    
    // 기본 이미지 URL은 삭제하지 않음
    if (imageUrl.includes('unsplash.com') || imageUrl.includes('placeholder')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/teams/delete-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl }),
      });
      
      if (response.ok) {
        // Successfully deleted
      } else {
        console.error('Failed to delete image with status:', response.status);
      }
    } catch (error) {
      console.error('Error deleting old image:', error);
      // 삭제 실패해도 계속 진행
    }
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setForm((f) => ({ ...f, projectImage: '' }));
  };

  // 이미지 업로드 함수
  const uploadImage = async () => {
    if (!imageFile) return form.projectImage; // 기존 이미지 URL 반환

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/v1/teams/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('이미지 업로드 실패');
      }

      const data = await response.json();
      return data.imageUrl;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
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
      avatar: team.leader?.profile_image || 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=L',
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
        avatar: team.leader?.profile_image || 'https://via.placeholder.com/40/A8C5E6/FFFFFF?text=L',
      },
    ],
    techStack: splitCsv(team.techStack || ''),
    techStackRaw: team.techStack,
    tags: splitCsv(team.tag || ''),
    tagsRaw: team.tag,
    images: team.projectImage && team.projectImage.trim()
      ? [team.projectImage]
      : ['https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=2020&auto=format&fit=crop'],
    projectImage: team.projectImage || '',
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

      // 이미지 처리
      let projectImageUrl = form.projectImage;
      const oldImageUrl = initialData?.projectImage || '';
      
      // 새 이미지가 선택된 경우
      if (imageFile) {
        // 기존 이미지 삭제 (교체시)
        if (oldImageUrl && isEditMode) {
          await deleteOldImage(oldImageUrl);
        }
        // 새 이미지 업로드
        projectImageUrl = await uploadImage();
      } 
      // 이미지가 제거된 경우 (form.projectImage가 빈 문자열)
      else if (!form.projectImage && oldImageUrl && isEditMode) {
        await deleteOldImage(oldImageUrl);
        projectImageUrl = '';
      }

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
          tag: form.tags,
          goals: form.goals,
          executionType: form.executionType,
          selectionProc: form.selectionProcess,
          contact: form.contact,
          link: form.link,
          projectImage: projectImageUrl,
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
          projectImage: projectImageUrl,
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

            {/* Project Image */}
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-300 mb-2 text-left">프로젝트 이미지</label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="projectImageInput"
                  />
                  <label
                    htmlFor="projectImageInput"
                    className="px-3 py-1.5 bg-white text-gray-800 rounded text-sm border border-gray-300 cursor-pointer hover:bg-gray-100"
                  >
                    파일 선택
                  </label>
                  {(imageFile || imagePreview) && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      사진 제거
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <div className="relative w-full max-w-md">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="w-full h-48 object-cover rounded border border-gray-600"
                    />
                  </div>
                )}
                {isUploadingImage && (
                  <div className="text-sm text-blue-400">이미지 업로드 중...</div>
                )}
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
                    type="date"
                    name="periodStart"
                    value={form.periodStart}
                    onChange={onForm}
                    required
                    className="form-input"
                    style={{ maxWidth: '45%' }}
                    min="0000-01-01"
                    max="9999-12-31"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    name="periodEnd"
                    value={form.periodEnd}
                    onChange={onForm}
                    required
                    className="form-input"
                    style={{ maxWidth: '45%' }}
                    min="0000-01-01"
                    max="9999-12-31"
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
                value={getExecutionTypeDisplay()}
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
