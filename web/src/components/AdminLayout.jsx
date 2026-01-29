// src/components/AdminLayout.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
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
      <div
        className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50`}
      >
        <AdminSidebar />
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
                <i className="fas fa-bars text-xl"></i>
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
                <button
                  onClick={() => navigate('/')}
                  className="text-gray-400 hover:text-white mr-4"
                  title="Main Page"
                >
                  <i className="fas fa-home text-lg"></i>
                </button>
                <div className="flex items-center space-x-2">
                  <img
                    src={user?.profile_image || "https://i.pravatar.cc/40?u=admin"}
                    alt="Admin"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium">{user?.name || 'Admin'}</span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('auth_user');
                    navigate('/login');
                  }}
                  className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Logout
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
