import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../api/client';

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeStudy = (study, overrides = {}) => {
    const status = overrides.status ?? study.status ?? 'ongoing';
    const tags = study.tag ? (Array.isArray(study.tag) ? study.tag : [study.tag]) : [];

    return {
        id: study.id,
        title: study.title ?? study.study_name ?? 'Untitled Study',
        status,
        period: study.period ?? '',
        way: study.way ?? '',
        members: typeof study.memberCount === 'number' ? study.memberCount : 0,
        description: study.description ?? study.study_description ?? '',
        techStack: tags,
        progress: typeof study.progress === 'number' ? study.progress : 0,
    };
};

const normalizeStudiesResponse = (data) => {
    if (Array.isArray(data)) {
        return data.map((study) => normalizeStudy(study));
    }

    const ongoing = toArray(data?.ongoingStudies).map((study) =>
        normalizeStudy(study, { status: 'ongoing' })
    );
    const completed = toArray(data?.completedStudies).map((study) =>
        normalizeStudy(study, { status: 'completed' })
    );
    const upcoming = toArray(data?.upcomingStudies).map((study) =>
        normalizeStudy(study, { status: 'upcoming' })
    );
    return [...ongoing, ...completed, ...upcoming];
};

const MyStudies = () => {
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, ongoing, completed
    const [selectedStudy, setSelectedStudy] = useState(null);

    useEffect(() => {
        const fetchStudies = async () => {
            try {
                setLoading(true);
                const data = await apiGet('/api/v1/mypage/study');
                setStudies(normalizeStudiesResponse(data));
            } catch (err) {
                console.error('Failed to fetch studies:', err);
                // Use empty array on error
                setStudies([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStudies();
    }, []);

    const ongoingStudies = useMemo(
        () => (Array.isArray(studies) ? studies.filter((s) => s.status === 'ongoing') : []),
        [studies]
    );
    const completedStudies = useMemo(
        () => (Array.isArray(studies) ? studies.filter((s) => s.status === 'completed') : []),
        [studies]
    );
    const upcomingStudies = useMemo(
        () => (Array.isArray(studies) ? studies.filter((s) => s.status === 'upcoming') : []),
        [studies]
    );

    const handleFilterClick = (newFilter) => {
        setFilter(newFilter);
    };

    const openModal = (studyId) => {
        const study = studies.find(s => s.id === studyId);
        setSelectedStudy(study);
    };

    const closeModal = () => {
        setSelectedStudy(null);
    };

    if (loading) {
        return (
            <div className="container mx-auto max-w-7xl p-6">
                <div className="text-center text-gray-400">스터디 목록을 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl">
            <div className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-2">참여 스터디 목록</h3>
                <p className="text-gray-400 mb-6">TCP에서 참여했던 모든 스터디 활동을 확인할 수 있습니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard value={studies.length} label="총 참여 스터디" />
                    <StatCard value={ongoingStudies.length} label="진행 중" valueClass="text-blue-400" />
                    <StatCard value={upcomingStudies.length} label="예정" valueClass="text-yellow-400" />
                    <StatCard value={completedStudies.length} label="완료" valueClass="text-green-400" />
                </div>
            </div>

            <div className="mb-6">
                <div className="flex space-x-2">
                    <FilterButton label="전체" filterType="all" activeFilter={filter} onClick={handleFilterClick} />
                    <FilterButton label="진행 중" filterType="ongoing" activeFilter={filter} onClick={handleFilterClick} />
                    <FilterButton label="예정" filterType="upcoming" activeFilter={filter} onClick={handleFilterClick} />
                    <FilterButton label="완료" filterType="completed" activeFilter={filter} onClick={handleFilterClick} />
                </div>
            </div>

            {(filter === 'all' || filter === 'ongoing') && <StudySection title="진행 중인 스터디" studies={ongoingStudies} onCardClick={openModal} icon="fa-play-circle text-blue-400" />}
            {(filter === 'all' || filter === 'upcoming') && <StudySection title="예정된 스터디" studies={upcomingStudies} onCardClick={openModal} icon="fa-calendar text-yellow-400" />}
            {(filter === 'all' || filter === 'completed') && <StudySection title="완료된 스터디" studies={completedStudies} onCardClick={openModal} icon="fa-check-circle text-green-400" />}

            {selectedStudy && <StudyDetailModal study={selectedStudy} onClose={closeModal} />}
        </div>
    );
};

const StatCard = ({ value, label, valueClass = 'gradient-text' }) => (
    <div className="widget-card p-4 rounded-lg text-center">
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
    </div>
);

const FilterButton = ({ label, filterType, activeFilter, onClick }) => (
    <button className={`filter-tab ${activeFilter === filterType ? 'active' : ''}`} onClick={() => onClick(filterType)}>{label}</button>
);

const StudySection = ({ title, studies, onCardClick, icon }) => (
    <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
            <h4 className="text-2xl font-bold text-white flex items-center">
                <i className={`fas ${icon} mr-3`}></i>{title}
                <span className={`ml-2 text-sm bg-opacity-20 px-2 py-1 rounded-full ${icon.includes('blue') ? 'bg-blue-500 text-blue-400' : 'bg-green-500 text-green-400'}`}>{studies.length}</span>
            </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map(study => <StudyCard key={study.id} study={study} onClick={onCardClick} />)}
        </div>
    </section>
);

const StudyCard = ({ study, onClick }) => {
    const getStatusBadge = () => {
        switch (study.status) {
            case 'ongoing': return { class: 'status-ongoing', text: '진행중' };
            case 'upcoming': return { class: 'status-upcoming', text: '예정' };
            case 'completed': return { class: 'status-completed', text: '완료' };
            default: return { class: 'status-ongoing', text: '진행중' };
        }
    };
    const badge = getStatusBadge();

    return (
        <div className={`study-card p-6 rounded-xl card-hover ${study.status === 'completed' ? 'completed' : ''}`} onClick={() => onClick(study.id)}>
            <div className="flex items-start justify-between mb-4">
                <h5 className="text-lg font-bold text-white">{study.title}</h5>
                <span className={`status-badge ${badge.class}`}>{badge.text}</span>
            </div>
            <div className="space-y-3 mb-4">
                <InfoRow icon="fa-calendar-alt text-blue-400" text={study.period || '기간 미정'} />
                <InfoRow icon="fa-users text-green-400" text={`${study.members}명 참여`} />
                <InfoRow icon="fa-map-marker-alt text-purple-400" text={study.way || '진행 방식 미정'} />
            </div>
            {study.status === 'ongoing' && (
                <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                        <span>진행률</span><span>{study.progress}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${study.progress}%` }}></div></div>
                </div>
            )}
            <div className="flex flex-wrap">{toArray(study.techStack).map(tech => <span key={tech} className="tech-tag">{tech}</span>)}</div>
        </div>
    );
};

const InfoRow = ({ icon, text }) => (
    <div className="flex items-center text-sm text-gray-300">
        <i className={`fas ${icon} w-4`}></i><span className="ml-2">{text}</span>
    </div>
);

const StudyDetailModal = ({ study, onClose }) => {
    const getStatusBadge = () => {
        switch (study.status) {
            case 'ongoing': return { class: 'status-ongoing', text: '진행중' };
            case 'upcoming': return { class: 'status-upcoming', text: '예정' };
            case 'completed': return { class: 'status-completed', text: '완료' };
            default: return { class: 'status-ongoing', text: '진행중' };
        }
    };
    const badge = getStatusBadge();

    return (
        <div className="modal show" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold gradient-text">{study.title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <h4 className="font-semibold text-white mb-2">기본 정보</h4>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div><strong>상태:</strong> <span className={`status-badge ${badge.class}`}>{badge.text}</span></div>
                                <div><strong>기간:</strong> {study.period || '미정'}</div>
                                <div><strong>진행 방식:</strong> {study.way || '미정'}</div>
                                <div><strong>참여자:</strong> {study.members}명</div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-2">태그</h4>
                            <div className="flex flex-wrap">{toArray(study.techStack).map(tech => <span key={tech} className="tech-tag">{tech}</span>)}</div>
                        </div>
                    </div>
                    <div className="mb-6">
                        <Link to={`/study/${study.id}`} className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors">
                            <i className="fas fa-external-link-alt mr-2"></i>
                            스터디 페이지로 이동
                        </Link>
                    </div>
                    {study.description && (
                        <div className="mb-6">
                            <h4 className="font-semibold text-white mb-2">스터디 소개</h4>
                            <p className="text-gray-300">{study.description}</p>
                        </div>
                    )}
                    {study.status === 'ongoing' && (
                        <div className="mb-6">
                            <h4 className="font-semibold text-white mb-2">진행률</h4>
                            <div className="progress-bar mb-2"><div className="progress-fill" style={{ width: `${study.progress}%` }}></div></div>
                            <div className="text-sm text-gray-400">{study.progress}% 완료</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyStudies;
