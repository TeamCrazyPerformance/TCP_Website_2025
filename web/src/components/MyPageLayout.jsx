import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import MyPageSidebar from './MyPageSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';

function MyPageLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = useMemo(
    () => user?.name || user?.username || '사용자',
    [user]
  );

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebarElement = document.getElementById('sidebar');
      const toggleButton = document.getElementById('sidebar-toggle');

      if (window.innerWidth <= 768 && sidebarElement && toggleButton) {
        if (
          isSidebarOpen &&
          !sidebarElement.contains(event.target) &&
          !toggleButton.contains(event.target)
        ) {
          setIsSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/mypage') return '내 프로필';
    if (path === '/mypage/settings') return '멤버 페이지 정보 공개 설정';
    if (path === '/mypage/studies') return '참여 스터디 목록';
    if (path === '/mypage/teams') return '팀 구성 이력';
    if (path === '/mypage/account-settings') return '개인정보 수정';
    if (path === '/mypage/withdrawal') return '회원 탈퇴';
    return '내 프로필';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <div
        className="fixed inset-y-0 left-0 md:relative z-50"
      >
        <MyPageSidebar isOpen={isSidebarOpen} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 bg-black bg-opacity-90 backdrop-blur-md border-b border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16 gap-2 sm:gap-3">
              <button
                id="sidebar-toggle"
                type="button"
                className="md:hidden text-white w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-700 hover:border-gray-500 flex items-center justify-center shrink-0"
                onClick={toggleSidebar}
              >
                <FontAwesomeIcon icon={faBars} className="text-base sm:text-lg" />
              </button>
              <h2
                className={`orbitron text-base sm:text-lg md:text-2xl font-bold text-white truncate min-w-0 ${isSidebarOpen ? 'hidden md:block' : 'block'} md:mr-auto`}
                title={getPageTitle()}
              >
                {getPageTitle()}
              </h2>
              <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
                <div className="min-w-0 max-w-[9rem] sm:max-w-[12rem] md:max-w-[16rem]">
                  <span className="text-sm font-medium truncate block">{displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-600 rounded-lg hover:border-gray-400 transition-colors whitespace-nowrap shrink-0"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-primary-black p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MyPageLayout;
