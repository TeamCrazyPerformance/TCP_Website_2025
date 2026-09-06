import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "./App.css";
import "./index.css";

// Shared components
import Header from "./components/Header";
import Footer from "./components/Footer";
import { AuthProvider } from "./context/AuthContext";

// Page components
import About from "./pages/About";
import Members from "./pages/Members";
import Recruitment from "./pages/Recruitment";
import Announcement from "./pages/Announcement";
import AnnouncementWrite from "./pages/AnnouncementWrite";
import AnnouncementArticle from "./pages/AnnouncementArticle";
import RequireRole from "./components/auth/RequireRole";
import Study from "./pages/Study";
import StudyWrite from "./pages/StudyWrite";
import StudyDetail from "./pages/StudyDetail";
import StudyManagement from "./pages/StudyManagement";
import StudyProgressWrite from "./pages/StudyProgressWrite";
import Team from "./pages/Team";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Privacy from "./pages/Privacy";
import PrivacyConsent from "./pages/PrivacyConsent";
import Terms from "./pages/Terms";
import OpenSourceCredits from "./pages/OpenSourceCredits";
import EasterEgg from "./pages/EasterEgg";

// My page components
import MyPageLayout from "./components/MyPageLayout";
import Profile from "./pages/mypage/Profile";
import MyPageSettings from "./pages/mypage/MyPageSettings";
import MyPageAccountSettings from "./pages/mypage/MyPageAccountSettings";
import MyStudies from "./pages/mypage/MyStudies";
import MyTeams from "./pages/mypage/MyTeams";
import Withdraw from "./pages/mypage/Withdraw";

// Admin page components
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMainContent from "./pages/admin/AdminMainContent";
import AdminRecruitment from "./pages/admin/AdminRecruitment";
import AdminAnnouncement from "./pages/admin/AdminAnnouncement";
import AdminApplicationManagement from "./pages/admin/AdminApplicationManagement";
import AdminDeleteAccount from "./pages/admin/AdminDeleteAccount";
import AdminModifyUserInfo from "./pages/admin/AdminModifyUserInfo";
import AdminPermission from "./pages/admin/AdminPermission";
import AdminStudy from "./pages/admin/AdminStudy";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminServer from "./pages/admin/AdminServer";
// Lazy-loaded: a static import would merge the v9 scoped CSS into main.css.
const TechArticles = lazy(() => import("./pages/TechArticles"));
const TechArticleDetail = lazy(() => import("./pages/TechArticleDetail"));

// Lazy-loaded for the same reason, splitting out roughly 100KB of scoped CSS.
const AdminTechArticles = lazy(() => import("./pages/admin/AdminTechArticles"));
const AdminTechArticleReviews = lazy(
  () => import("./pages/admin/AdminTechArticleReviews"),
);
const AdminCrawlOperations = lazy(
  () => import("./pages/admin/AdminCrawlOperations"),
);

// Chunk fallback for public pages. pt-24 clears the fixed shared header.
function PublicChunkFallback() {
  return (
    <section className="pt-24 pb-16 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-400">화면을 불러오는 중...</p>
      </div>
    </section>
  );
}

// Chunk fallback for admin pages, matching the AdminLayout spinner.
function AdminChunkFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-400">화면을 불러오는 중...</p>
      </div>
    </div>
  );
}

// All logic lives in AppContent
function AppContent() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Tech article pages use the shared Header/Footer like every other public page
  const isNonCommonLayout =
    location.pathname.startsWith("/mypage") ||
    location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isNonCommonLayout) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isNonCommonLayout]);

  return (
    <div className="App">
      {!isNonCommonLayout && <Header isScrolled={isScrolled} />}
      <Routes>
        <Route path="/" element={<About />} />
        <Route path="/about" element={<Navigate to="/" replace />} />
        <Route path="/members" element={<Members />} />
        <Route path="/recruitment" element={<Recruitment />} />
        <Route path="/announcement" element={<Announcement />} />
        <Route
          path="/announcement/write"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AnnouncementWrite />
            </RequireRole>
          }
        />
        <Route
          path="/announcement/edit/:id"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AnnouncementWrite />
            </RequireRole>
          }
        />
        <Route path="/announcement/:id" element={<AnnouncementArticle />} />
        <Route path="/study" element={<Study />} />
        <Route path="/study/write" element={<StudyWrite />} />
        <Route path="/study/:id" element={<StudyDetail />} />
        <Route path="/study/:id/manage" element={<StudyManagement />} />
        <Route
          path="/study/:id/progress/write"
          element={<StudyProgressWrite />}
        />
        <Route
          path="/study/:id/progress/:progressId/edit"
          element={<StudyProgressWrite />}
        />
        <Route path="/team" element={<Team />} />
        <Route
          path="/tech-articles"
          element={
            <Suspense fallback={<PublicChunkFallback />}>
              <TechArticles />
            </Suspense>
          }
        />
        <Route
          path="/tech-articles/:articleId"
          element={
            <Suspense fallback={<PublicChunkFallback />}>
              <TechArticleDetail />
            </Suspense>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/privacy-consent" element={<PrivacyConsent />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/opensource" element={<OpenSourceCredits />} />
        <Route path="/easter-egg" element={<EasterEgg />} />

        {/* My page nested routes */}
        <Route path="/mypage" element={<MyPageLayout />}>
          <Route index element={<Profile />} />
          <Route path="settings" element={<MyPageSettings />} />
          <Route path="account-settings" element={<MyPageAccountSettings />} />
          <Route path="studies" element={<MyStudies />} />
          <Route path="teams" element={<MyTeams />} />
          <Route path="withdraw" element={<Withdraw />} />
        </Route>

        {/* Admin pages (nested routes) */}
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
          <Route
            path="tech-articles"
            element={
              <Suspense fallback={<AdminChunkFallback />}>
                <AdminTechArticles />
              </Suspense>
            }
          />
          <Route
            path="tech-articles/reviews/duplicates"
            element={
              <Suspense fallback={<AdminChunkFallback />}>
                <AdminTechArticleReviews kind="duplicates" />
              </Suspense>
            }
          />
          <Route
            path="tech-articles/reviews/quality"
            element={
              <Suspense fallback={<AdminChunkFallback />}>
                <AdminTechArticleReviews kind="quality" />
              </Suspense>
            }
          />
          <Route
            path="tech-articles/reviews/publication"
            element={
              <Suspense fallback={<AdminChunkFallback />}>
                <AdminTechArticleReviews kind="publication" />
              </Suspense>
            }
          />
          <Route
            path="tech-articles/crawls"
            element={
              <Suspense fallback={<AdminChunkFallback />}>
                <AdminCrawlOperations />
              </Suspense>
            }
          />
        </Route>
      </Routes>
      {!isNonCommonLayout && <Footer />}
    </div>
  );
}

// App only renders the Router
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
