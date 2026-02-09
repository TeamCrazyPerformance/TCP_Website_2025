import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../logo.svg';
import { useAuth } from '../context/AuthContext';

function Header({ isScrolled }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const getNavLinkClass = ({ isActive }) =>
    `nav-link orbitron text-sm font-medium ${isActive ? 'active' : 'text-gray-300'
    } hover:text-white`;

  const getLoginLinkClass = ({ isActive }) =>
    `px-4 py-2 text-sm border ${isActive ? 'border-gray-400 text-white' : 'border-gray-600 text-gray-300'
    } rounded-lg hover:border-gray-400 transition-colors`;

  const getRegisterLinkClass = ({ isActive }) =>
    `px-4 py-2 text-sm rounded-lg transition-colors ${isActive
      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
      : 'bg-gradient-to-r from-blue-500 to-purple-500'
    } hover:from-blue-600 hover:to-purple-600 text-white`;

  const logoutButtonClass =
    'px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 transition-colors';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${isScrolled ? 'bg-black' : 'bg-black'
        } backdrop-blur-md border-b border-gray-800 transition-colors duration-300`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <NavLink to="/" className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-10 h-10">
              <img
                src={logo}
                alt="TCP 로고"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="orbitron text-xl font-bold gradient-text text-left">
                TCP
              </h1>
              <p className="orbitron text-xs text-gray-400 text-left">
                Team Crazy Performance
              </p>
            </div>
          </NavLink>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-6">
            <NavLink to="/about" className={getNavLinkClass}>
              About
            </NavLink>
            <NavLink to="/members" className={getNavLinkClass}>
              Members
            </NavLink>
            <NavLink to="/recruitment" className={getNavLinkClass}>
              Recruitment
            </NavLink>
            <NavLink to="/announcement" className={getNavLinkClass}>
              Announcement
            </NavLink>
            <NavLink to="/study" className={getNavLinkClass}>
              Study
            </NavLink>
            <NavLink to="/team" className={getNavLinkClass}>
              Find Your Team
            </NavLink>
          </nav>

          {/* Login/Sign Up Links */}
          <div className="flex space-x-3">
            {isAuthenticated ? (
              <>
                <NavLink to="/mypage" className={getRegisterLinkClass}>
                  마이페이지
                </NavLink>
                <button
                  type="button"
                  className={logoutButtonClass}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={getLoginLinkClass}>
                  로그인
                </NavLink>
                <NavLink to="/register" className={getRegisterLinkClass}>
                  회원가입
                </NavLink>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden">
            <i className="fas fa-bars text-white"></i>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
