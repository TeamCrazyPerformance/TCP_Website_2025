import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const StepIndicator = ({ currentStep }) => (
    <div className="step-indicator">
        <div className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>1</div>
        <div className={`step-connector ${currentStep > 1 ? 'completed' : ''}`}></div>
        <div className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>2</div>
        <div className={`step-connector ${currentStep > 2 ? 'completed' : ''}`}></div>
        <div className={`step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>3</div>
    </div>
);

const Withdraw = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmations, setConfirmations] = useState({
        dataLoss: false,
        reregisterLimit: false,
        teamExit: false,
        final: false,
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();

    const allChecked = Object.values(confirmations).every(Boolean);

    useEffect(() => {
        // Reset state if component unmounts or step changes to 1
        return () => {
            setCurrentStep(1);
            setPassword('');
            setPasswordError('');
            setConfirmations({ dataLoss: false, reregisterLimit: false, teamExit: false, final: false });
        };
    }, []);

    const handleConfirmationChange = (e) => {
        const { name, checked } = e.target;
        setConfirmations(prev => ({ ...prev, [name]: checked }));
    };

    const verifyPassword = () => {
        if (!password) {
            setPasswordError('비밀번호를 입력해주세요.');
            return;
        }
        // This is a mock verification. In a real app, you'd call an API.
        if (password === 'wrongpassword') {
            setPasswordError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setPasswordError('');
        setCurrentStep(3);
    };

    const handlePasswordKeyPress = (e) => {
        if (e.key === 'Enter') {
            verifyPassword();
        }
    };

    const finalWithdraw = () => {
        if (!allChecked) return;
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setCurrentStep(4); // Move to success step
            setTimeout(() => navigate('/'), 5000); // Redirect to home after 5s
        }, 2000);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <section id="withdrawal-step-1">
                        <div className="widget-card p-8 rounded-xl">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full mb-4">
                                    <i className="fas fa-exclamation-triangle text-3xl text-white"></i>
                                </div>
                                <h3 className="text-3xl font-bold gradient-text-red mb-4">계정 탈퇴 안내</h3>
                                <p className="text-gray-300 text-lg"><span className="orbitron">TCP</span> 계정을 삭제하기 전에 아래 내용을 신중히 검토해주세요.</p>
                            </div>

                            <div className="warning-card p-6 rounded-xl mb-6">
                                <h4 className="text-xl font-bold text-red-300 mb-4 flex items-center">
                                    <i className="fas fa-info-circle mr-3"></i>
                                    탈퇴 시 삭제되는 정보
                                </h4>
                                <div className="warning-list">
                                    <ul>
                                        <li><i className="fas fa-user-circle"></i><span><strong>프로필 정보:</strong> 닉네임, 프로필 사진, 자기소개, 기술 스택 등 모든 개인 정보</span></li>
                                        <li><i className="fas fa-history"></i><span><strong>활동 기록:</strong> 참여한 스터디, 팀 프로젝트, 대회 참가 이력 등 모든 활동 데이터</span></li>
                                        <li><i className="fas fa-comments"></i><span><strong>커뮤니케이션:</strong> 작성한 게시글, 댓글, 메시지 등 모든 소통 기록</span></li>
                                        <li><i className="fas fa-trophy"></i><span><strong>성과 기록:</strong> 획득한 배지, 포인트, 랭킹 등 모든 성취 데이터</span></li>
                                    </ul>
                                </div>
                            </div>

                            <div className="warning-card p-6 rounded-xl mb-8">
                                <h4 className="text-xl font-bold text-red-300 mb-4 flex items-center">
                                    <i className="fas fa-ban mr-3"></i>
                                    탈퇴 후 제한 사항
                                </h4>
                                <div className="warning-list">
                                    <ul>
                                        <li><i className="fas fa-clock"></i><span><strong>재가입 제한:</strong> 탈퇴 후 30일간 동일한 이메일로 재가입이 불가능합니다</span></li>
                                        <li><i className="fas fa-database"></i><span><strong>데이터 복구 불가:</strong> 삭제된 모든 데이터는 복구할 수 없으며, 백업도 제공되지 않습니다</span></li>
                                        <li><i className="fas fa-users"></i><span><strong>팀 활동 중단:</strong> 현재 참여 중인 모든 팀 활동에서 자동으로 제외됩니다</span></li>
                                        <li><i className="fas fa-link"></i><span><strong>외부 연동 해제:</strong> GitHub, 포트폴리오 등 연동된 모든 외부 서비스 연결이 해제됩니다</span></li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <Link to="/mypage" className="btn-secondary">
                                    <i className="fas fa-arrow-left mr-2"></i>
                                    마이페이지로 돌아가기
                                </Link>
                                <button onClick={() => setCurrentStep(2)} className="btn-danger">
                                    위 내용을 확인했으며, 탈퇴를 진행하겠습니다
                                    <i className="fas fa-arrow-right ml-2"></i>
                                </button>
                            </div>
                        </div>
                    </section>
                );
            case 2:
                return (
                    <section id="withdrawal-step-2">
                        <div className="widget-card p-8 rounded-xl">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                                    <i className="fas fa-shield-alt text-3xl text-white"></i>
                                </div>
                                <h3 className="text-3xl font-bold gradient-text mb-4">본인 확인</h3>
                                <p className="text-gray-300 text-lg">계정 보안을 위해 비밀번호를 다시 입력해주세요.</p>
                            </div>

                            <div className="max-w-md mx-auto">
                                <div className="mb-6">
                                    <label htmlFor="password-verification" className="block text-sm font-medium text-gray-300 mb-3">
                                        <i className="fas fa-lock mr-2"></i>
                                        현재 비밀번호
                                    </label>
                                    <input type="password" id="password-verification" className="editable" placeholder="현재 사용 중인 비밀번호를 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={handlePasswordKeyPress} />
                                    {passwordError && (
                                        <div className="text-red-400 text-sm mt-2">
                                            <i className="fas fa-exclamation-circle mr-1"></i>
                                            {passwordError}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 border-opacity-50 rounded-lg p-4 mb-6">
                                    <div className="flex items-start">
                                        <i className="fas fa-info-circle text-yellow-400 mt-1 mr-3"></i>
                                        <div className="text-yellow-200 text-sm">
                                            <p className="font-semibold mb-1">보안 안내</p>
                                            <p>본인 확인을 위해 현재 계정의 비밀번호를 정확히 입력해주세요. 여러 번 실패 시 보안을 위해 일시적으로 접근이 제한될 수 있습니다.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={() => setCurrentStep(1)} className="btn-secondary">
                                    <i className="fas fa-arrow-left mr-2"></i>
                                    이전 단계
                                </button>
                                <button onClick={verifyPassword} className="btn-primary">
                                    비밀번호 확인
                                    <i className="fas fa-arrow-right ml-2"></i>
                                </button>
                            </div>
                        </div>
                    </section>
                );
            case 3:
                return (
                    <section id="withdrawal-step-3">
                        <div className="widget-card p-8 rounded-xl">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full mb-4">
                                    <i className="fas fa-check-circle text-3xl text-white"></i>
                                </div>
                                <h3 className="text-3xl font-bold gradient-text-red mb-4">최종 확인</h3>
                                <p className="text-gray-300 text-lg">아래 내용을 확인하고 최종 탈퇴 신청을 완료해주세요.</p>
                            </div>

                            <div className="max-w-2xl mx-auto">
                                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                                        <i className="fas fa-user mr-3 text-blue-400"></i>
                                        탈퇴 계정 정보
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="text-gray-400">닉네임:</span><span className="text-white ml-2 font-medium">Admin Kim</span></div>
                                        <div><span className="text-gray-400">이메일:</span><span className="text-white ml-2 font-medium">kimtcp@seoultech.ac.kr</span></div>
                                        <div><span className="text-gray-400">가입일:</span><span className="text-white ml-2 font-medium">2022년 3월 15일</span></div>
                                        <div><span className="text-gray-400">활동 기간:</span><span className="text-white ml-2 font-medium">2년 3개월</span></div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="checkbox-container">
                                        <input type="checkbox" id="confirm-data-loss" name="dataLoss" checked={confirmations.dataLoss} onChange={handleConfirmationChange} required />
                                        <label htmlFor="confirm-data-loss" className="text-gray-300">모든 개인 데이터(프로필, 활동 기록, 작성 글 등)가 영구적으로 삭제되며, 복구가 불가능함을 이해했습니다.</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input type="checkbox" id="confirm-reregister-limit" name="reregisterLimit" checked={confirmations.reregisterLimit} onChange={handleConfirmationChange} required />
                                        <label htmlFor="confirm-reregister-limit" className="text-gray-300">탈퇴 후 30일간 동일한 이메일로 재가입이 불가능함을 이해했습니다.</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input type="checkbox" id="confirm-team-exit" name="teamExit" checked={confirmations.teamExit} onChange={handleConfirmationChange} required />
                                        <label htmlFor="confirm-team-exit" className="text-gray-300">현재 참여 중인 모든 팀 활동에서 자동으로 제외되며, 이로 인한 팀원들의 불편함을 이해했습니다.</label>
                                    </div>
                                    <div className="checkbox-container">
                                        <input type="checkbox" id="confirm-final" name="final" checked={confirmations.final} onChange={handleConfirmationChange} required />
                                        <label htmlFor="confirm-final" className="text-gray-300 font-semibold">위의 모든 내용을 숙지했으며, <span className="text-red-400"><span className="orbitron">TCP</span> 계정을 영구적으로 삭제</span>하는 것에 동의합니다.</label>
                                    </div>
                                </div>

                                <div className="bg-red-900 bg-opacity-30 border border-red-500 border-opacity-50 rounded-xl p-6 mb-8">
                                    <div className="flex items-start">
                                        <i className="fas fa-exclamation-triangle text-red-400 text-xl mt-1 mr-4"></i>
                                        <div>
                                            <h5 className="text-red-300 font-bold mb-2">최종 경고</h5>
                                            <p className="text-red-200 text-sm leading-relaxed">이 작업은 되돌릴 수 없습니다. 탈퇴 버튼을 클릭하면 즉시 계정이 삭제되며, 모든 데이터가 영구적으로 사라집니다. 정말 탈퇴하시겠습니까?</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={() => setCurrentStep(2)} className="btn-secondary">
                                    <i className="fas fa-arrow-left mr-2"></i>
                                    이전 단계
                                </button>
                                <button onClick={finalWithdraw} id="final-withdraw-btn" className={`btn-danger ${!allChecked || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!allChecked || isProcessing}>
                                    {isProcessing ? <><i className="fas fa-spinner fa-spin mr-2"></i>처리 중...</> : <><i className="fas fa-trash-alt mr-2"></i>계정 영구 삭제</>}
                                </button>
                            </div>
                        </div>
                    </section>
                );
            case 4:
                return (
                    <section id="withdrawal-success" className="withdrawal-step">
                        <div className="widget-card p-8 rounded-xl text-center success-animation">
                            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
                                <i className="fas fa-check text-4xl text-white"></i>
                            </div>
                            <h3 className="text-3xl font-bold text-green-400 mb-4">탈퇴가 완료되었습니다</h3>
                            <p className="text-gray-300 text-lg mb-8">
                                김TCP님의 <span className="orbitron">TCP</span> 홈페이지 계정이 성공적으로 삭제되었습니다.<br />
                                그동안 <span className="orbitron">TCP</span>와 함께해 주셔서 감사했습니다.
                            </p>
                            <div className="bg-green-900 bg-opacity-30 border border-green-500 border-opacity-50 rounded-xl p-6 mb-8 max-w-md mx-auto">
                                <h4 className="text-green-300 font-bold mb-3">처리 완료된 작업</h4>
                                <ul className="text-green-200 text-sm space-y-2">
                                    <li className="flex items-center"><i className="fas fa-check-circle mr-2 text-green-400"></i>계정 및 프로필 데이터 삭제</li>
                                    <li className="flex items-center"><i className="fas fa-check-circle mr-2 text-green-400"></i>활동 기록 및 게시글 삭제</li>
                                    <li className="flex items-center"><i className="fas fa-check-circle mr-2 text-green-400"></i>팀 활동에서 자동 제외</li>
                                    <li className="flex items-center"><i className="fas fa-check-circle mr-2 text-green-400"></i>외부 서비스 연동 해제</li>
                                </ul>
                            </div>
                            <p className="text-sm text-gray-400 mb-8">5초 후 자동으로 메인 페이지로 이동합니다...</p>
                            <button onClick={() => navigate('/')} className="btn-primary">
                                <i className="fas fa-home mr-2"></i>
                                메인 페이지로 이동
                            </button>
                        </div>
                    </section>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container mx-auto max-w-4xl">
            {currentStep < 4 && <StepIndicator currentStep={currentStep} />}
            {renderStepContent()}
        </div>
    );
};

export default Withdraw;