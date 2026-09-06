import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Not a security boundary. The API decides access; this only blocks navigation.
export default function RequireRole({ roles, children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!roles.includes(user?.role)) {
    return (
      <main className="container mx-auto px-4 py-24">
        <section className="max-w-lg mx-auto text-center">
          <i
            className="fas fa-lock text-4xl text-gray-600 mb-6 block"
            aria-hidden="true"
          ></i>
          <h1 className="orbitron text-2xl font-bold text-white mb-3">
            접근 권한이 없습니다
          </h1>
          <p className="text-gray-400 mb-8">
            이 화면은 관리자만 사용할 수 있습니다.
          </p>
          <Link
            to="/"
            className="cta-button primary-cta-text px-6 py-3 rounded-lg font-bold inline-flex items-center"
          >
            홈으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
