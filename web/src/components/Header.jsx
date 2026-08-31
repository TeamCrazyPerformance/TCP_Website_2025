import React, { useMemo, useRef, useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../logo.svg";
import { useAuth } from "../context/AuthContext";

function Header({ isScrolled }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    setImgError(false);
  }, [user?.profile_image]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [isAuthenticated, user?.profile_image]);

  useEffect(() => {
    lastScrollYRef.current = Math.max(window.scrollY, 0);

    const handleMobileNavVisibility = () => {
      const currentScrollY = Math.max(window.scrollY, 0);

      if (window.innerWidth >= 1024) {
        setIsMobileNavVisible(true);
      } else if (isMobileMenuOpen || currentScrollY <= 8) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY < lastScrollYRef.current) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 56) {
        setIsMobileNavVisible(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleMobileNavVisibility, { passive: true });
    window.addEventListener("resize", handleMobileNavVisibility);

    return () => {
      window.removeEventListener("scroll", handleMobileNavVisibility);
      window.removeEventListener("resize", handleMobileNavVisibility);
    };
  }, [isMobileMenuOpen]);

  const displayName = useMemo(
    () => user?.name || user?.username || "사용자",
    [user],
  );
  const avatarInitial = displayName ? displayName[0].toUpperCase() : "U";

  const getNavLinkClass = ({ isActive }) =>
    `nav-link orbitron text-sm font-medium whitespace-nowrap ${
      isActive ? "active" : "text-gray-300"
    } hover:text-white`;

  // 크기와 색은 App.css 의 .nav-auth-link 계열이 담당합니다. Tailwind 는 CDN 의
  // 2.2.19 프리빌드라 text-[11px] 같은 임의값 클래스가 존재하지 않습니다.
  const getLoginLinkClass = ({ isActive }) =>
    `nav-auth-link nav-auth-login ${isActive ? "is-active" : ""}`;

  const getRegisterLinkClass = ({ isActive }) =>
    `nav-auth-link nav-auth-register ${isActive ? "is-active" : ""}`;

  const logoutButtonClass =
    "px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 transition-colors";

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate("/");
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`site-nav ${isScrolled ? "is-scrolled" : ""} ${isMobileNavVisible ? "" : "is-mobile-hidden"}`}
    >
      <div className="container mx-auto px-2.5 sm:px-4">
        <div className="site-nav-row flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex-1 xl:flex-none min-w-0">
            <NavLink
              to="/"
              className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0"
            >
              <div className="site-nav-logo w-9 h-9 sm:w-10 sm:h-10">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="orbitron text-lg sm:text-xl font-bold gradient-text text-left">
                  TCP
                </h1>
                <p className="orbitron text-xs text-gray-400 text-left hidden sm:block">
                  Team Crazy Performance
                </p>
              </div>
            </NavLink>
          </div>

          {/* Navigation */}
          <nav
            className="hidden xl:flex flex-1 items-center justify-center space-x-6 px-3"
            aria-label="주요 메뉴"
          >
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
            <NavLink to="/tech-articles" className={getNavLinkClass}>
              Tech Articles
            </NavLink>
            <NavLink to="/study" className={getNavLinkClass}>
              Study
            </NavLink>
            <NavLink to="/team" className={getNavLinkClass}>
              Find Your Team
            </NavLink>
          </nav>

          <div className="flex flex-1 xl:flex-none items-center justify-end gap-1 sm:gap-2">
            {/* Login/Sign Up Links */}
            <div className="flex items-center gap-1 sm:gap-3">
              {isAuthenticated ? (
                <>
                  <NavLink
                    to="/mypage"
                    className="flex items-center space-x-2 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/10 transition-colors group"
                  >
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
                    <i className="fas fa-sign-in-alt text-xs hidden sm:inline-block"></i>
                    로그인
                  </NavLink>
                  <NavLink to="/register" className={getRegisterLinkClass}>
                    <i className="fas fa-user-plus text-xs hidden sm:inline-block"></i>
                    회원가입
                  </NavLink>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="xl:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-white hover:bg-gray-800 transition-colors flex items-center justify-center shrink-0 relative z-20 ml-0.5"
              onClick={() => {
                setIsMobileNavVisible(true);
                setIsMobileMenuOpen((prev) => !prev);
              }}
              aria-label="모바일 메뉴 열기"
              aria-expanded={isMobileMenuOpen}
            >
              <i
                className={`fas ${isMobileMenuOpen ? "fa-times" : "fa-bars"} text-white`}
              ></i>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="site-nav-mobile xl:hidden border-t border-gray-800 py-3">
            <nav className="flex flex-col gap-1 mb-3">
              <NavLink
                to="/about"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                About
              </NavLink>
              <NavLink
                to="/members"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                Members
              </NavLink>
              <NavLink
                to="/recruitment"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                Recruitment
              </NavLink>
              <NavLink
                to="/announcement"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                Announcement
              </NavLink>
              <NavLink
                to="/tech-articles"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                Tech Articles
              </NavLink>
              <NavLink
                to="/study"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
                Study
              </NavLink>
              <NavLink
                to="/team"
                className="px-3 py-2 rounded-lg text-gray-200 hover:bg-white/10 orbitron"
                onClick={closeMobileMenu}
              >
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
