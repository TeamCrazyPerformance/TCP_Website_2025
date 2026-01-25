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
        <img src={logo} alt="TCP 로고" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="orbitron text-xl font-bold gradient-text">TCP</h1>
          <p className="text-xs text-gray-400">My Page</p>
        </div>
      </div>

      <nav className="space-y-4">
        <div>
          <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            개인 정보
          </h3>
          <Link
            to="/mypage"
            className={`sidebar-link ${isActive('/mypage') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faUser} />
            <span className="ml-2">프로필 보기/수정</span>
          </Link>
          <Link
            to="/mypage/settings"
            className={`sidebar-link ${isActive('/mypage/settings') ? 'active' : ''}`}
          >
            <FontAwesomeIcon icon={faEye} />
            <span className="ml-2">멤버 페이지 공개 설정</span>
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
            <span className="ml-2">계정 설정</span>
          </Link>
          <Link
            to="/mypage/withdraw"
            className={`sidebar-link ${isActive('/mypage/withdraw') ? 'text-red-400' : ''}`}
          >
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span className="ml-2">탈퇴 신청</span>
          </Link>
        </div>

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
