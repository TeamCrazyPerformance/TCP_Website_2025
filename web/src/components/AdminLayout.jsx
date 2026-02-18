// src/components/AdminLayout.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check admin authorization
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('auth_user');
      const userData = storedUser ? JSON.parse(storedUser) : null;

      if (!token || !userData) {
        alert('로그인이 필요합니다.');
        navigate('/login');
        return;
      }

      if (userData.role !== 'ADMIN') {
        alert('관리자만 접근할 수 있습니다.');
        navigate('/');
        return;
      }

      setUser(userData);
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // 외부 클릭 시 사이드바 닫기 (모바일)
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
    if (path === '/admin') return 'Dashboard';
    if (path === '/admin/main') return 'Main Page Content';
    if (path === '/admin/recruitment') return 'Recruitment Page Management';
    // ... 다른 관리 페이지 제목들
    return 'Admin Panel';
  };

  // Show loading state while checking authorization
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authorized
  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <div className="fixed inset-y-0 left-0 md:relative z-50">
        <AdminSidebar isOpen={isSidebarOpen} />
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
                <i className="fas fa-bars text-base sm:text-lg"></i>
              </button>
              <h2
                className={`orbitron text-base sm:text-lg md:text-2xl font-bold text-white truncate min-w-0 ${isSidebarOpen ? 'hidden md:block' : 'block'} md:mr-auto`}
                title={getPageTitle()}
              >
                {getPageTitle()}
              </h2>
              <div className="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-gray-400 hover:text-white shrink-0 p-1"
                  title="Main Page"
                >
                  <i className="fas fa-home text-lg"></i>
                </button>
                <div className="min-w-0 max-w-[9rem] sm:max-w-[12rem] md:max-w-[16rem]">
                  <span className="text-sm font-medium truncate block">{user?.name || 'Admin'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('auth_user');
                    navigate('/login');
                  }}
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

export default AdminLayout;
