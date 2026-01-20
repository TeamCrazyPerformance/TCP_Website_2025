import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import './App.css';
import './index.css';

// 공통 컴포넌트 임포트
import Header from './components/Header';
import Footer from './components/Footer';

// 페이지 컴포넌트 임포트
import Home from './pages/Home';
import About from './pages/About';
import Members from './pages/Members';
import Recruitment from './pages/Recruitment';
import Announcement from './pages/Announcement';
import AnnouncementWrite from './pages/AnnouncementWrite';
import AnnouncementArticle from './pages/AnnouncementArticle';
import Study from './pages/Study';
import StudyWrite from './pages/StudyWrite';
import StudyDetail from './pages/StudyDetail';
import Team from './pages/Team';
import Login from './pages/Login';
import Register from './pages/Register';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

// 마이페이지 관련 컴포넌트 임포트
import MyPageLayout from './components/MyPageLayout';
import Profile from './pages/mypage/Profile';
import MyPageSettings from './pages/mypage/MyPageSettings';
import MyPageAccountSettings from './pages/mypage/MyPageAccountSettings';
import MyStudies from './pages/mypage/MyStudies';
import MyTeams from './pages/mypage/MyTeams';
import Withdraw from './pages/mypage/Withdraw';

// 관리자 페이지 관련 컴포넌트 임포트
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMainContent from './pages/admin/AdminMainContent';
import AdminRecruitment from './pages/admin/AdminRecruitment';
import AdminAnnouncement from './pages/admin/AdminAnnouncement';
import AdminApplicationManagement from './pages/admin/AdminApplicationManagement';
import AdminDeleteAccount from './pages/admin/AdminDeleteAccount';
import AdminModifyUserInfo from './pages/admin/AdminModifyUserInfo';
import AdminPermission from './pages/admin/AdminPermission';
import AdminStudy from './pages/admin/AdminStudy';
import AdminTeam from './pages/admin/AdminTeam';
import AdminServer from './pages/admin/AdminServer';

import { useState } from 'react';

// 모든 로직을 AppContent 컴포넌트로 이동
function AppContent() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isNonCommonLayout =
    location.pathname.startsWith('/mypage') ||
    location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isNonCommonLayout) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isNonCommonLayout]);

  return (
    <div className="App">
      {!isNonCommonLayout && <Header isScrolled={isScrolled} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/members" element={<Members />} />
        <Route path="/recruitment" element={<Recruitment />} />
        <Route path="/announcement" element={<Announcement />} />
        <Route path="/announcement/write" element={<AnnouncementWrite />} />
        <Route path="/announcement/:id" element={<AnnouncementArticle />} />
        <Route path="/study" element={<Study />} />
        <Route path="/study/write" element={<StudyWrite />} />
        <Route path="/study/:id" element={<StudyDetail />} />
        <Route path="/team" element={<Team />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* 마이페이지 중첩 라우트 */}
        <Route path="/mypage" element={<MyPageLayout />}>
          <Route index element={<Profile />} />
          <Route path="settings" element={<MyPageSettings />} />
          <Route path="account-settings" element={<MyPageAccountSettings />} />
          <Route path="studies" element={<MyStudies />} />
          <Route path="teams" element={<MyTeams />} />
          <Route path="withdraw" element={<Withdraw />} />
        </Route>

        {/* Admin Pages (중첩 라우트) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="main" element={<AdminMainContent />} />
          <Route path="recruitment" element={<AdminRecruitment />} />
          <Route path="announcement" element={<AdminAnnouncement />} />
          <Route path="application" element={<AdminApplicationManagement />} />
          <Route path="delete-account" element={<AdminDeleteAccount />} />
          <Route path="modify-user-info" element={<AdminModifyUserInfo />} />
          <Route path="permission" element={<AdminPermission />} />
          <Route path="study" element={<AdminStudy />} />
          <Route path="team" element={<AdminTeam />} />
          <Route path="server" element={<AdminServer />} />
        </Route>
      </Routes>
      {!isNonCommonLayout && <Footer />}
    </div>
  );
}

// App 컴포넌트는 Router만 렌더링
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
