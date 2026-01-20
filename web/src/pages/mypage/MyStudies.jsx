import React, { useState, useMemo } from 'react';

const studyData = {
    study1: { id: 'study1', title: 'React 심화 스터디', status: 'ongoing', period: '2024.03 - 2024.06', schedule: '매주 화, 목 오후 7시', location: '온라인 (Zoom)', members: 8, description: 'React의 고급 패턴과 성능 최적화, 상태 관리 라이브러리 등을 학습하는 심화 스터디입니다.', techStack: ['React', 'TypeScript', 'Next.js', 'Redux Toolkit'], progress: 65, assignments: ['Hook 패턴 연구', 'Context API 활용', '성능 최적화 실습'], links: ['https://github.com/tcp-react-study'] },
    study2: { id: 'study2', title: '알고리즘 문제 해결', status: 'ongoing', period: '2024.02 - 2024.05', schedule: '매주 월, 수, 금 오후 8시', location: '온라인 (Discord)', members: 6, description: '코딩 테스트 대비를 위한 알고리즘 문제 해결 스터디입니다.', techStack: ['Python', 'C++', 'Algorithm'], progress: 80, assignments: ['백준 문제 풀이', 'LeetCode 도전'], links: ['https://github.com/tcp-algorithm'] },
    study3: { id: 'study3', title: 'Spring Boot 백엔드', status: 'completed', period: '2023.09 - 2023.12', schedule: '매주 토 오후 2시', location: '학교 강의실', members: 7, description: 'Spring Boot를 활용한 백엔드 개발 전반을 학습했습니다.', techStack: ['Spring Boot', 'Java', 'MySQL'], progress: 100, assignments: ['RESTful API 구현', '데이터베이스 설계'], links: ['https://github.com/tcp-springboot'] },
    study4: { id: 'study4', title: '데이터 사이언스 기초', status: 'completed', period: '2023.03 - 2023.06', schedule: '매주 수 오후 7시', location: '온라인', members: 10, description: 'Python을 활용한 데이터 분석과 시각화를 학습했습니다.', techStack: ['Python', 'Pandas', 'NumPy'], progress: 100, assignments: ['데이터 전처리', '통계 분석', '시각화 프로젝트'] },
    study5: { id: 'study5', title: 'JavaScript 마스터', status: 'completed', period: '2022.09 - 2022.12', schedule: '매주 목 오후 6시', location: '학교 강의실', members: 12, description: 'JavaScript의 기초부터 고급 기능까지 전반적으로 학습했습니다.', techStack: ['JavaScript', 'ES6+', 'DOM'], progress: 100, assignments: ['DOM 조작', 'API 연동'] },
    study6: { id: 'study6', title: 'Unity 게임 개발', status: 'completed', period: '2022.03 - 2022.06', schedule: '매주 토 오후 1시', location: '학교 실습실', members: 5, description: 'Unity 엔진을 활용한 2D/3D 게임 개발을 학습했습니다.', techStack: ['Unity', 'C#', 'Game Dev'], progress: 100, assignments: ['게임 기획', '캐릭터 제작'] },
    study7: { id: 'study7', title: 'iOS 앱 개발', status: 'completed', period: '2021.09 - 2021.12', schedule: '매주 일 오후 3시', location: '온라인', members: 6, description: 'Swift를 활용한 iOS 네이티브 앱 개발을 학습했습니다.', techStack: ['Swift', 'UIKit', 'iOS'], progress: 100, assignments: ['UI 구현', '데이터 관리'] },
    study8: { id: 'study8', title: 'C 프로그래밍 기초', status: 'completed', period: '2021.03 - 2021.06', schedule: '매주 화, 목 오후 5시', location: '학교 강의실', members: 15, description: 'C 언어의 기초 문법과 프로그래밍 개념을 학습했습니다.', techStack: ['C', 'Programming', 'Basic'], progress: 100, assignments: ['기초 문법', '자료구조'] },
};

const MyStudies = () => {
    const [filter, setFilter] = useState('all'); // all, ongoing, completed
    const [selectedStudy, setSelectedStudy] = useState(null);

    const studies = Object.values(studyData);
    const ongoingStudies = useMemo(() => studies.filter(s => s.status === 'ongoing'), [studies]);
    const completedStudies = useMemo(() => studies.filter(s => s.status === 'completed'), [studies]);

    const handleFilterClick = (newFilter) => {
        setFilter(newFilter);
    };

    const openModal = (studyId) => {
        setSelectedStudy(studyData[studyId]);
    };

    const closeModal = () => {
        setSelectedStudy(null);
    };

    return (
        <div className="container mx-auto max-w-7xl">
            <div className="mb-8">
                <h3 className="text-3xl font-bold gradient-text mb-2">참여 스터디 목록</h3>
                <p className="text-gray-400 mb-6">TCP에서 참여했던 모든 스터디 활동을 확인할 수 있습니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard value={studies.length} label="총 참여 스터디" />
                    <StatCard value={ongoingStudies.length} label="진행 중" valueClass="text-blue-400" />
                    <StatCard value={completedStudies.length} label="완료" valueClass="text-green-400" />
                    <StatCard value="750" label="총 활동 시간" valueClass="text-purple-400" />
                </div>
            </div>

            <div className="mb-6">
                <div className="flex space-x-2">
                    <FilterButton label="전체" filterType="all" activeFilter={filter} onClick={handleFilterClick} />
                    <FilterButton label="진행 중" filterType="ongoing" activeFilter={filter} onClick={handleFilterClick} />
                    <FilterButton label="완료" filterType="completed" activeFilter={filter} onClick={handleFilterClick} />
                </div>
            </div>

            {(filter === 'all' || filter === 'ongoing') && <StudySection title="진행 중인 스터디" studies={ongoingStudies} onCardClick={openModal} icon="fa-play-circle text-blue-400" />}
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

const StudyCard = ({ study, onClick }) => (
    <div className={`study-card p-6 rounded-xl card-hover ${study.status === 'completed' ? 'completed' : ''}`} onClick={() => onClick(study.id)}>
        <div className="flex items-start justify-between mb-4">
            <h5 className="text-lg font-bold text-white">{study.title}</h5>
            <span className={`status-badge ${study.status === 'ongoing' ? 'status-ongoing' : 'status-completed'}`}>{study.status === 'ongoing' ? '진행중' : '완료'}</span>
        </div>
        <div className="space-y-3 mb-4">
            <InfoRow icon="fa-calendar-alt text-blue-400" text={study.period} />
            <InfoRow icon="fa-users text-green-400" text={`${study.members}명 참여`} />
            <InfoRow icon={study.status === 'ongoing' ? 'fa-clock text-purple-400' : 'fa-trophy text-yellow-400'} text={study.status === 'ongoing' ? study.schedule : '수료 완료'} />
        </div>
        {study.status === 'ongoing' && (
            <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                    <span>진행률</span><span>{study.progress}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${study.progress}%` }}></div></div>
            </div>
        )}
        <div className="flex flex-wrap">{study.techStack.map(tech => <span key={tech} className="tech-tag">{tech}</span>)}</div>
    </div>
);

const InfoRow = ({ icon, text }) => (
    <div className="flex items-center text-sm text-gray-300">
        <i className={`fas ${icon} w-4`}></i><span className="ml-2">{text}</span>
    </div>
);

const StudyDetailModal = ({ study, onClose }) => (
    <div className="modal show" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold gradient-text">{study.title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <h4 class="font-semibold text-white mb-2">기본 정보</h4>
                        <div class="space-y-2 text-sm text-gray-300">
                            <div><strong>상태:</strong> <span className={`status-badge ${study.status === 'ongoing' ? 'status-ongoing' : 'status-completed'}`}>{study.status === 'ongoing' ? '진행중' : '완료'}</span></div>
                            <div><strong>기간:</strong> {study.period}</div>
                            <div><strong>일정:</strong> {study.schedule}</div>
                            <div><strong>장소:</strong> {study.location}</div>
                            <div><strong>참여자:</strong> {study.members}명</div>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-semibold text-white mb-2">기술 스택</h4>
                        <div class="flex flex-wrap">{study.techStack.map(tech => <span key={tech} className="tech-tag">{tech}</span>)}</div>
                    </div>
                </div>
                <div class="mb-6">
                    <h4 class="font-semibold text-white mb-2">스터디 소개</h4>
                    <p class="text-gray-300">{study.description}</p>
                </div>
                {study.progress < 100 &&
                    <div class="mb-6">
                        <h4 class="font-semibold text-white mb-2">진행률</h4>
                        <div class="progress-bar mb-2"><div class="progress-fill" style={{ width: `${study.progress}%` }}></div></div>
                        <div class="text-sm text-gray-400">{study.progress}% 완료</div>
                    </div>
                }
                <div class="mb-6">
                    <h4 class="font-semibold text-white mb-2">주요 과제/활동</h4>
                    <ul class="list-disc list-inside text-gray-300 space-y-1">{study.assignments.map(a => <li key={a}>{a}</li>)}</ul>
                </div>
                {study.links &&
                    <div class="mb-6">
                        <h4 class="font-semibold text-white mb-2">관련 링크</h4>
                        <div class="space-y-2">{study.links.map(l => <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:text-blue-300 text-sm transition-colors"><i class="fas fa-external-link-alt mr-2"></i>{l}</a>)}</div>
                    </div>
                }
            </div>
        </div>
    </div>
);

export default MyStudies;