import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; // React Router Link
import logo from "../logo.svg"; // logo.svg from src, by relative path
import { apiPost } from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/authPages.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  // Username and password state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent the default form submission

    if (!username || !password) {
      alert("아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await apiPost("/api/v1/auth/login", { username, password });
      login(data.user, data.access_token);
      const nextPath =
        typeof location.state?.from === "string" &&
        location.state.from.startsWith("/") &&
        !location.state.from.startsWith("//")
          ? location.state.from
          : "/";
      navigate(nextPath, { replace: true });
    } catch (error) {
      alert(error.message || "로그인에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Login Section */}
      <section className="auth-page auth-login public-page-unified-background">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="auth-heading text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="orbitron text-3xl font-bold gradient-text mb-2">
                로그인
              </h1>
            </div>

            {/* Login Form */}
            <div className="login-card">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="login-credentials">
                  {/* Username Input */}
                  <div className="login-field-group">
                    <label
                      className="login-field-label block text-sm font-medium text-gray-300 mb-2 text-left"
                      htmlFor="username"
                    >
                      아이디
                    </label>
                    <div className="login-input-shell relative">
                      <input
                        type="text"
                        autoComplete="username"
                        id="username"
                        aria-label="아이디"
                        className="input-field w-full px-4 py-3 rounded-lg text-white placeholder-gray-400"
                        placeholder="ID"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                      <i className="fas fa-user absolute right-3 top-3.5 text-gray-400"></i>
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="login-field-group">
                    <label
                      className="login-field-label block text-sm font-medium text-gray-300 mb-2 text-left"
                      htmlFor="password"
                    >
                      비밀번호
                    </label>
                    <div className="login-input-shell relative">
                      <input
                        type="password"
                        autoComplete="current-password"
                        id="password"
                        aria-label="비밀번호"
                        className="input-field w-full px-4 py-3 rounded-lg text-white placeholder-gray-400"
                        placeholder="PW"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <i className="fas fa-lock absolute right-3 top-3.5 text-gray-400"></i>
                    </div>
                  </div>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  className="login-button login-submit-button w-full py-3 rounded-lg text-white font-semibold orbitron text-lg"
                  disabled={isSubmitting}
                >
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  {isSubmitting ? "로그인 중..." : "로그인"}
                </button>

                {/* Secondary Actions */}
                <div className="login-secondary-actions flex justify-center text-sm">
                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        "아직 구현되지 않은 기능입니다. TCP 운영진에게 문의 부탁드립니다.",
                      )
                    }
                    className="secondary-link hover:underline"
                  >
                    <i className="login-secondary-icon fas fa-search mr-1"></i>
                    아이디 찾기
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      alert(
                        "아직 구현되지 않은 기능입니다. TCP 운영진에게 문의 부탁드립니다.",
                      )
                    }
                    className="secondary-link hover:underline"
                  >
                    <i className="login-secondary-icon fas fa-key mr-1"></i>
                    비밀번호 재설정
                  </button>
                  <span className="text-gray-600">|</span>
                  <Link
                    to="/register"
                    className="secondary-link hover:underline"
                  >
                    <i className="login-secondary-icon fas fa-user-plus mr-1"></i>
                    회원가입
                  </Link>
                </div>
              </form>
            </div>

            {/* Additional Info */}
            <div className="auth-footer text-center mt-8 text-sm text-gray-400">
              <p>
                TCP 부원이 되고싶으신가요?{" "}
                <Link
                  to="/recruitment"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  지금 지원하세요
                </Link>
              </p>{" "}
              {/* Sign-up link */}
              <p className="mt-2">
                문의사항:{" "}
                <span className="text-blue-400">seoultech.tcp@gmail.com</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Login;
