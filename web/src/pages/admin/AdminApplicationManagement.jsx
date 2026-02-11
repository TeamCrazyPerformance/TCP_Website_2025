import React, { useState, useEffect } from 'react';

const StatusBadge = ({ status }) => {
    const styles = {
        pending: 'status-pending',
        reviewed: 'status-reviewed',
        accepted: 'status-accepted',
        rejected: 'status-rejected',
    };
    const text = { pending: '대기', reviewed: '검토 완료', accepted: '합격', rejected: '불합격' };
    return <span className={`status-badge ${styles[status] || styles.pending}`}>{text[status] || status}</span>;
};

const ApplicationModal = ({ app, onClose, onUpdateStatus, onSaveComment }) => {
    const [comment, setComment] = useState(app.review_comment || '');
    if (!app) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-gray-900 rounded-2xl overflow-y-auto border border-gray-700 shadow-2xl w-full"
                style={{ width: 'min(1000px, 95vw)', height: 'min(800px, 90vh)', maxWidth: '95vw', maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gray-900/95 backdrop-blur border-b border-gray-700 p-4 flex justify-between items-center">
                    <h2 className="text-2xl font-bold gradient-text">지원서 상세 정보</h2>
                    <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose}>
                        <i className="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Basic Info Section */}
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-lg font-bold text-blue-300 mb-4 border-b border-gray-700 pb-2">기본 정보</h3>
                        <div className="space-y-4">
                            <div className="flex items-center">
                                <span className="text-sm text-gray-400 w-24">이름</span>
                                <span className="text-lg text-white font-semibold">{app.name}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-400 w-24">학번</span>
                                <span className="text-lg text-white font-semibold">{app.student_number}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-400 w-24">전공</span>
                                <span className="text-lg text-white font-semibold">{app.major}</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-sm text-gray-400 w-24">전화번호</span>
                                <span className="text-lg text-white font-semibold">{app.phone_number}</span>
                            </div>
                        </div>
                    </div>

                    {/* All detailed sections stacked vertically (Single Column) for maximum readability */}

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-star mr-2"></i>관심 분야
                        </h4>
                        <p className="text-gray-200 bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-lg">{app.area_interest || '없음'}</p>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-user mr-2"></i>자기소개
                        </h4>
                        <p className="text-gray-300 bg-gray-900/50 p-6 rounded-lg border border-gray-800 whitespace-pre-wrap leading-relaxed text-lg">{app.self_introduction}</p>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-bullseye mr-2"></i>지원 동기 및 목표
                        </h4>
                        <p className="text-gray-300 bg-gray-900/50 p-6 rounded-lg border border-gray-800 whitespace-pre-wrap leading-relaxed text-lg">{app.club_expectation}</p>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-code mr-2"></i>기술 스택
                        </h4>
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                            {app.tech_stack ? (
                                <div className="flex flex-wrap gap-2">
                                    {app.tech_stack.split(',').map((tech, i) => (
                                        <span key={i} className="px-3 py-1 bg-blue-900/30 text-blue-200 rounded-full text-base border border-blue-900/50">
                                            {tech.trim()}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">없음</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-laptop-code mr-2"></i>프로젝트 경험
                        </h4>
                        {app.projects && app.projects.length > 0 ? (
                            <div className="space-y-6">
                                {app.projects.map((project, idx) => (
                                    <div key={idx} className="bg-gray-900/60 p-6 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <h5 className="font-bold text-white text-xl">{project.project_name}</h5>
                                            <span className="text-sm bg-gray-800 px-3 py-1 rounded text-gray-400 border border-gray-700">{project.project_date}</span>
                                        </div>
                                        <div className="text-blue-400 mb-4 font-medium">
                                            <span>기여도: {project.project_contribution}%</span>
                                            <span className="mx-3">|</span>
                                            <span>{project.project_tech_stack}</span>
                                        </div>
                                        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-gray-800/50 pt-4 mt-2 text-lg">{project.project_description}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic p-4 text-center">프로젝트 경험 없음</p>
                        )}
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-sm">
                        <h4 className="text-blue-300 font-bold mb-3 flex items-center text-lg">
                            <i className="fas fa-trophy mr-2"></i>수상 경력
                        </h4>
                        {app.awards && app.awards.length > 0 ? (
                            <div className="space-y-4">
                                {app.awards.map((award, idx) => (
                                    <div key={idx} className="bg-gray-900/60 p-6 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-gray-200 text-lg">{award.award_name}</span>
                                            <span className="text-sm text-gray-400">{award.award_date}</span>
                                        </div>
                                        <div className="text-purple-400 mb-3">{award.award_institution}</div>
                                        <p className="text-gray-300 whitespace-pre-wrap text-lg">{award.award_description}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic p-4 text-center">수상 경력 없음</p>
                        )}
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                        <h4 className="text-lg font-bold mb-4 text-blue-300 border-b border-gray-700 pb-2">관리자 검토</h4>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">검토 의견</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="form-input w-full h-32 bg-gray-900/80 text-white p-4 rounded-lg border border-gray-700 focus:border-blue-500 transition-colors resize-none text-lg"
                                placeholder="지원서에 대한 검토 의견을 작성해주세요..."
                            ></textarea>
                            <div className="flex justify-end mt-2">
                                <button className="btn-primary text-sm px-4 py-2 rounded shadow-lg hover:shadow-blue-500/20" onClick={() => onSaveComment(app.id, comment)}>
                                    <i className="fas fa-save mr-2"></i>의견 저장
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                        <h4 className="text-lg font-bold mb-4 text-purple-300 border-b border-gray-700 pb-2">최종 심사 결정</h4>
                        <div className="flex flex-wrap gap-4 justify-center">
                            <button className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg hover:shadow-blue-600/30 transition-all transform hover:-translate-y-1" onClick={() => onUpdateStatus(app.id, 'reviewed')}>
                                <i className="fas fa-check mr-2"></i>검토 완료
                            </button>
                            <button className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg hover:shadow-green-600/30 transition-all transform hover:-translate-y-1" onClick={() => onUpdateStatus(app.id, 'accepted')}>
                                <i className="fas fa-trophy mr-2"></i>최종 합격
                            </button>
                            <button className="px-6 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-bold shadow-lg hover:shadow-yellow-600/30 transition-all transform hover:-translate-y-1" onClick={() => onUpdateStatus(app.id, 'pending')}>
                                <i className="fas fa-clock mr-2"></i>대기 / 보류
                            </button>
                            <button className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg hover:shadow-red-600/30 transition-all transform hover:-translate-y-1" onClick={() => onUpdateStatus(app.id, 'rejected')}>
                                <i className="fas fa-times mr-2"></i>불합격
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminApplicationManagement = () => {
    const [applications, setApplications] = useState([]);
    const [selectedApp, setSelectedApp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [showAllPhones, setShowAllPhones] = useState(false);

    const fetchApplications = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch('/api/v1/recruitment', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch applications');
            const data = await res.json();
            // Sort by submitted date (newest first)
            const sorted = Array.isArray(data) ? data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
            setApplications(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleUpdateStatus = async (id, status) => {
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/v1/recruitment/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ review_status: status })
            });

            if (!res.ok) throw new Error('Failed to update status');

            setApplications(apps => apps.map(app => app.id === id ? { ...app, review_status: status } : app));
            if (selectedApp && selectedApp.id === id) {
                setSelectedApp(prev => ({ ...prev, review_status: status }));
            }
            alert('상태가 변경되었습니다.');
        } catch (err) {
            alert('업데이트 실패: ' + err.message);
        }
    };

    const handleSaveComment = async (id, comment) => {
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`/api/v1/recruitment/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ review_comment: comment })
            });

            if (!res.ok) throw new Error('Failed to save comment');

            setApplications(apps => apps.map(app => app.id === id ? { ...app, review_comment: comment } : app));
            if (selectedApp && selectedApp.id === id) {
                setSelectedApp(prev => ({ ...prev, review_comment: comment }));
            }
            alert('의견이 저장되었습니다.');
        } catch (err) {
            alert('저장 실패: ' + err.message);
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    const filteredApplications = statusFilter === 'all'
        ? applications
        : applications.filter(app => app.review_status === statusFilter);

    const statusCounts = {
        all: applications.length,
        pending: applications.filter(app => app.review_status === 'pending').length,
        reviewed: applications.filter(app => app.review_status === 'reviewed').length,
        accepted: applications.filter(app => app.review_status === 'accepted').length,
        rejected: applications.filter(app => app.review_status === 'rejected').length,
    };

    return (
        <div className="container mx-auto max-w-7xl p-6">
            <section className="mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="orbitron text-2xl font-bold gradient-text">지원서 관리</h3>
                    <button onClick={fetchApplications} className="btn-secondary text-sm"><i className="fas fa-sync mr-2"></i>새로고침</button>
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        전체 ({statusCounts.all})
                    </button>
                    <button
                        onClick={() => setStatusFilter('pending')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        대기 ({statusCounts.pending})
                    </button>
                    <button
                        onClick={() => setStatusFilter('reviewed')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'reviewed' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        검토 완료 ({statusCounts.reviewed})
                    </button>
                    <button
                        onClick={() => setStatusFilter('accepted')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        합격 ({statusCounts.accepted})
                    </button>
                    <button
                        onClick={() => setStatusFilter('rejected')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        불합격 ({statusCounts.rejected})
                    </button>
                </div>

                {/* Phone Number Toggle & Download Button */}
                <div className="flex justify-end gap-2 mb-4">
                    <button
                        onClick={() => setShowAllPhones(!showAllPhones)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${showAllPhones ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <i className={`fas ${showAllPhones ? 'fa-eye-slash' : 'fa-phone'}`}></i>
                        {showAllPhones ? '전화번호 숨기기' : '전화번호 보기'}
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const token = localStorage.getItem('access_token');
                                const res = await fetch('/api/v1/recruitment/download-all', {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                if (!res.ok) throw new Error('Download failed');
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `applications_${new Date().toISOString().split('T')[0]}.zip`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                            } catch (err) {
                                alert('다운로드 실패: ' + err.message);
                            }
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-500"
                    >
                        <i className="fas fa-download"></i>
                        일괄 다운로드 (.zip)
                    </button>
                </div>

                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="p-4 text-left text-gray-300" style={{ width: '20%' }}>지원자 정보</th>
                                    <th className="p-4 text-left text-gray-300" style={{ width: '20%' }}>전공</th>
                                    <th className="p-4 text-left text-gray-300" style={{ width: '25%' }}>제출일시</th>
                                    <th className="p-4 text-left text-gray-300" style={{ width: '15%' }}>심사 상태</th>
                                    <th className="p-4 text-left text-gray-300" style={{ width: '20%' }}>{showAllPhones ? '전화번호' : ''}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredApplications.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-500">
                                        {statusFilter === 'all' ? '지원서가 없습니다.' : '해당 상태의 지원서가 없습니다.'}
                                    </td></tr>
                                ) : (
                                    filteredApplications.map(app => (
                                        <tr
                                            key={app.id}
                                            className="table-row border-b border-gray-700 hover:bg-gray-800 transition-colors cursor-pointer"
                                            onClick={() => setSelectedApp(app)}
                                        >
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{app.name}</div>
                                                <div className="text-sm text-gray-400">{app.student_number}</div>
                                            </td>
                                            <td className="p-4 text-gray-300">{app.major}</td>
                                            <td className="p-4 text-gray-400">{new Date(app.created_at).toLocaleString('ko-KR')}</td>
                                            <td className="p-4"><StatusBadge status={app.review_status} /></td>
                                            <td className="p-4 text-gray-300">
                                                {showAllPhones ? (
                                                    <span className="flex items-center gap-1">
                                                        <i className="fas fa-phone text-green-400 text-xs"></i>
                                                        {app.phone_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-sm">클릭하여 상세보기</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            {selectedApp && (
                <ApplicationModal
                    app={selectedApp}
                    onClose={() => setSelectedApp(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onSaveComment={handleSaveComment}
                />
            )}
        </div>
    );
};

export default AdminApplicationManagement;
