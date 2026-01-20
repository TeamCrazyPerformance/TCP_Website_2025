import React, { useEffect, useState } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import MyPageSidebar from './MyPageSidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faBell } from '@fortawesome/free-solid-svg-icons';

function MyPageLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

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
    if (path === '/mypage') return '마이페이지';
    if (path === '/mypage/settings') return '멤버 페이지 공개 설정';
    if (path === '/mypage/studies') return '참여 스터디 목록';
    if (path === '/mypage/teams') return '팀 구성 이력';
    if (path === '/mypage/account-settings') return '계정 설정';
    if (path === '/mypage/withdrawal') return '탈퇴 신청';
    return '마이페이지';
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
                <button className="text-gray-400 hover:text-white">
                  <FontAwesomeIcon icon={faBell} />
                </button>
                <div className="flex items-center space-x-2">
                  <img
                    src="https://via.placeholder.com/40/A8C5E6/FFFFFF?text=User"
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm font-medium">김TCP</span>
                </div>
                <button className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-gray-400 transition-colors">
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
