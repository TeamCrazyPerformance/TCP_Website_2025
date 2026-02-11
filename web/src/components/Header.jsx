import React, { useMemo, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../logo.svg';
import { useAuth } from '../context/AuthContext';

function Header({ isScrolled }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.profile_image]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [isAuthenticated, user?.profile_image]);

  const displayName = useMemo(
    () => user?.name || user?.username || '사용자',
    [user]
  );
  const avatarInitial = displayName ? displayName[0].toUpperCase() : 'U';

  const getNavLinkClass = ({ isActive }) =>
    `nav-link orbitron text-sm font-medium whitespace-nowrap ${isActive ? 'active' : 'text-gray-300'
    } hover:text-white`;

  const getLoginLinkClass = ({ isActive }) =>
    `px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border ${isActive ? 'border-gray-500 text-white bg-white/5' : 'border-gray-700 text-gray-200 bg-transparent'
    } rounded-xl hover:border-gray-500 hover:bg-white/5 transition-colors`;

  const getRegisterLinkClass = ({ isActive }) =>
    `px-2 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl transition-colors ${isActive
      ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
    } hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20`;

  const logoutButtonClass =
    'px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 transition-colors';

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${isScrolled ? 'bg-black' : 'bg-black'
        } backdrop-blur-md border-b border-gray-800 transition-colors duration-300`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex-1 min-w-0">
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
                <p className="orbitron text-xs text-gray-400 text-left hidden sm:block">
                  Team Crazy Performance
                </p>
              </div>
            </NavLink>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex flex-1 items-center justify-center space-x-6 px-4">
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

          <div className="flex flex-1 items-center justify-end gap-2">
            {/* Login/Sign Up Links */}
            <div className="flex items-center space-x-1 sm:space-x-3">
              {isAuthenticated ? (
                <>
                  <NavLink to="/mypage" className="flex items-center space-x-2 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/10 transition-colors group">
                    {!imgError ? (
                      <img
                        src={user?.profile_image || logo}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover border border-gray-600 group-hover:border-gray-400 bg-gray-700"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white border border-gray-600 group-hover:border-gray-400">
                        {avatarInitial}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                      {displayName}
                    </span>
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
                    <span className="inline-flex items-center gap-2">
                      <i className="fas fa-sign-in-alt text-xs"></i>
                      로그인
                    </span>
                  </NavLink>
                  <NavLink to="/register" className={getRegisterLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <i className="fas fa-user-plus text-xs"></i>
                      회원가입
                    </span>
                  </NavLink>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-gray-700 text-white hover:border-gray-500 transition-colors flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="모바일 메뉴 열기"
              aria-expanded={isMobileMenuOpen}
            >
              <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-white`}></i>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 py-3">
            <nav className="flex flex-col gap-1 mb-3">
              <NavLink to="/about" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                About
              </NavLink>
              <NavLink to="/members" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                Members
              </NavLink>
              <NavLink to="/recruitment" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                Recruitment
              </NavLink>
              <NavLink to="/announcement" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                Announcement
              </NavLink>
              <NavLink to="/study" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                Study
              </NavLink>
              <NavLink to="/team" className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10" onClick={closeMobileMenu}>
                Find Your Team
              </NavLink>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
