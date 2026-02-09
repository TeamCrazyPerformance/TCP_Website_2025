import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import MyPageSidebar from './MyPageSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faBell } from '@fortawesome/free-solid-svg-icons';
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
  const avatarInitial = displayName ? displayName[0].toUpperCase() : 'U';

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
        className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50`}
      >
        <MyPageSidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 bg-black bg-opacity-90 backdrop-blur-md border-b border-gray-800">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <button
                id="sidebar-toggle"
                className="md:hidden text-white"
                onClick={toggleSidebar}
              >
                <FontAwesomeIcon icon={faBars} className="text-xl" />
              </button>
              <h2 className="orbitron text-2xl font-bold text-white hidden md:block">
                {getPageTitle()}
              </h2>
              <h2
                className={`orbitron text-xl font-bold text-white md:hidden ${isSidebarOpen ? 'hidden' : 'block'}`}
              >
                {getPageTitle()}
              </h2>
              <div className="flex items-center space-x-4 ml-auto">
                <div className="flex items-center space-x-2">
                  {user?.profile_image ? (
                    <img
                      src={user.profile_image}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white">
                      {avatarInitial}
                    </div>
                  )}
                  <span className="text-sm font-medium">{displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
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
