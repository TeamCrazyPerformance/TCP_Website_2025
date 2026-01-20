import React, { useState, useMemo } from 'react';

const sampleApplications = [
    { id: 1, name: '김민준', nickname: 'minjun_dev', studentId: '20241234', major: '컴퓨터공학과', submitDate: '2024-01-15T10:30:00', status: 'pending', comment: '' },
    { id: 2, name: '이서연', nickname: 'seoyeon_ai', studentId: '20241235', major: '전자IT미디어공학과', submitDate: '2024-01-16T14:20:00', status: 'reviewed', comment: 'AI 기본기 탄탄.' },
    { id: 3, name: '박지훈', nickname: 'jihun_backend', studentId: '20241236', major: '컴퓨터공학과', submitDate: '2024-01-17T09:15:00', status: 'accepted', comment: '실력 우수.' },
];

const StatusBadge = ({ status }) => {
    const styles = {
        pending: 'status-pending',
        reviewed: 'status-reviewed',
        accepted: 'status-accepted',
        rejected: 'status-rejected',
    };
    const text = { pending: '대기', reviewed: '검토 완료', accepted: '합격', rejected: '불합격' };
    return <span className={`status-badge ${styles[status]}`}>{text[status]}</span>;
};

const ApplicationModal = ({ app, onClose, onUpdateStatus, onSaveComment }) => {
    const [comment, setComment] = useState(app.comment || '');
    if (!app) return null;
    return (
        <div className="modal active"><div className="modal-content">
            <button className="close-modal" onClick={onClose}><i className="fas fa-times"></i></button>
            <div className="p-8">
                <h2 className="text-2xl font-bold gradient-text mb-6 text-center">지원서 상세 정보</h2>
                {/* Full application details here */}
                <div className="mt-8 pt-6 border-t border-gray-600">
                    <h4 className="text-lg font-bold mb-4 text-blue-300">관리자 검토 의견</h4>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="form-input form-textarea" placeholder="검토 의견..."></textarea>
                    <button className="btn-primary text-sm mt-4" onClick={() => onSaveComment(app.id, comment)}>의견 저장</button>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-600">
                    <h4 className="text-lg font-bold mb-4 text-purple-300">심사 결정</h4>
                    <div className="flex flex-wrap gap-3">
                        <button className="btn-primary text-sm" onClick={() => onUpdateStatus(app.id, 'reviewed')}>검토 완료</button>
                        <button className="btn-success text-sm" onClick={() => onUpdateStatus(app.id, 'accepted')}>합격</button>
                        <button className="btn-warning text-sm" onClick={() => onUpdateStatus(app.id, 'pending')}>대기</button>
                        <button className="btn-danger text-sm" onClick={() => onUpdateStatus(app.id, 'rejected')}>불합격</button>
                    </div>
                </div>
            </div>
        </div></div>
    );
};

const AdminApplicationManagement = () => {
    const [applications, setApplications] = useState(sampleApplications);
    const [selectedApp, setSelectedApp] = useState(null);

    const handleUpdateStatus = (id, status) => {
        setApplications(apps => apps.map(app => app.id === id ? { ...app, status } : app));
        setSelectedApp(null);
    };

    const handleSaveComment = (id, comment) => {
        setApplications(apps => apps.map(app => app.id === id ? { ...app, comment } : app));
    };

    return (
        <div className="container mx-auto max-w-7xl p-6">
            {/* Stats and Filters can be re-added here */}
            <section className="mb-8">
                <div className="widget-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800"><tr><th className="p-4 text-left">지원자 정보</th><th className="p-4 text-left">전공</th><th className="p-4 text-left">제출일시</th><th className="p-4 text-left">심사 상태</th><th className="p-4 text-left">작업</th></tr></thead>
                            <tbody>
                                {applications.map(app => (
                                    <tr key={app.id} className="table-row">
                                        <td className="p-4"><div className="font-semibold text-white">{app.name}</div><div className="text-sm text-gray-400">@{app.nickname}</div></td>
                                        <td className="p-4">{app.major}</td>
                                        <td className="p-4">{new Date(app.submitDate).toLocaleString('ko-KR')}</td>
                                        <td className="p-4"><StatusBadge status={app.status} /></td>
                                        <td className="p-4"><button onClick={() => setSelectedApp(app)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"><i className="fas fa-eye mr-1"></i>상세 보기</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            {selectedApp && <ApplicationModal app={selectedApp} onClose={() => setSelectedApp(null)} onUpdateStatus={handleUpdateStatus} onSaveComment={handleSaveComment} />}
        </div>
    );
};

export default AdminApplicationManagement;