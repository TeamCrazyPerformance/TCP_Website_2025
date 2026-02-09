import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../logo.svg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEye,
  faBook,
  faUsers,
  faCog,
  faSignOutAlt,
  faHome,
} from '@fortawesome/free-solid-svg-icons';

function MyPageSidebar() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside id="sidebar" className="sidebar flex-shrink-0 p-4">
      <div className="flex items-center space-x-3 mb-8 px-2">
        <Link to="/">
          <img src={logo} alt="TCP 로고" className="w-10 h-10 object-contain" />
        </Link>
        <div>
          <Link to="/">
            <h1 className="orbitron text-xl font-bold gradient-text">TCP</h1>
          </Link>
          <p className="orbitron text-xs text-gray-400">My Page</p>
        </div>
      </div>

      <nav className="space-y-4">
        <div>
          <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            프로필 관리
          </h3>
          <Link
            to="/mypage"
            className={`sidebar-link ${isActive('/mypage') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faUser} />
            <span className="ml-2">내 프로필</span>
          </Link>
          <Link
            to="/mypage/settings"
            className={`sidebar-link ${isActive('/mypage/settings') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faEye} />
            <span className="ml-2">멤버 페이지 정보 공개 설정</span>
          </Link>
        </div>

        <div>
          <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            활동 관리
          </h3>
          <Link
            to="/mypage/studies"
            className={`sidebar-link ${isActive('/mypage/studies') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faBook} />
            <span className="ml-2">참여 스터디 목록</span>
          </Link>
          <Link
            to="/mypage/teams"
            className={`sidebar-link ${isActive('/mypage/teams') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faUsers} />
            <span className="ml-2">팀 구성 이력</span>
          </Link>
        </div>

        <div>
          <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            계정 관리
          </h3>
          <Link
            to="/mypage/account-settings"
            className={`sidebar-link ${isActive('/mypage/account-settings') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faCog} />
            <span className="ml-2">개인정보 수정</span>
          </Link>
          <Link
            to="/mypage/withdraw"
            className={`sidebar-link ${isActive('/mypage/withdraw') ? 'text-red-400' : ''}`}
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span className="ml-2">회원 탈퇴</span>
          </Link>
        </div>

        {/* Admin Section - Only visible for ADMIN users */}
        {(() => {
          const user = localStorage.getItem('auth_user');
          const userData = user ? JSON.parse(user) : null;
          if (userData?.role === 'ADMIN') {
            return (
              <div className="pt-4 border-t border-gray-700">
                <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  관리자
                </h3>
                <Link
                  to="/admin"
                  className="sidebar-link text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg"
                >
                  <i className="fas fa-shield-alt"></i>
                  <span className="ml-2">관리자 페이지</span>
                </Link>
              </div>
            );
          }
          return null;
        })()}

        <div className="pt-4 border-t border-gray-700">
          <Link to="/" className="sidebar-link">
            <FontAwesomeIcon icon={faHome} />
            <span className="ml-2">메인 페이지로</span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}

export default MyPageSidebar;
