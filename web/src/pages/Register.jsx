import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../logo.svg';
import { apiPost } from '../api/client';
import { useAuth } from '../context/AuthContext';

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  // 폼 입력 필드 상태 관리
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [realName, setRealName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [major, setMajor] = useState('');
  const [joinYear, setJoinYear] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [educationStatus, setEducationStatus] = useState('재학');
  const [techStack, setTechStack] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // 비밀번호 가시성 상태
  const [showPassword, setShowPassword] = useState(false);

  // 체크박스 상태
  const [termsAgreed, setTermsAgreed] = useState(false); // 이용약관 동의

  // 추가 정보 입력 펼침 상태
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  // 유효성 검사 관련 상태
  const [usernameAvailability, setUsernameAvailability] = useState(null); // 'available', 'taken', 'checking'
  const [usernameMessage, setUsernameMessage] = useState('');
  const [emailAvailability, setEmailAvailability] = useState(null); // 'available', 'taken', 'checking'
  const [emailMessage, setEmailMessage] = useState('');
  const [studentNumberValid, setStudentNumberValid] = useState(null); // true, false, null
  const [passwordStrength, setPasswordStrength] = useState({
    minLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
    hasSpecial: false,
  });
  const [passwordMatch, setPasswordMatch] = useState(null); // true, false, null
  const [signupButtonEnabled, setSignupButtonEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 전화번호 자동 형식화 함수
  const formatPhoneNumber = (value) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');

    // 최대 11자리까지만 허용
    const limited = numbers.slice(0, 11);

    // 서울 지역번호 (02)인 경우
    if (limited.startsWith('02')) {
      if (limited.length <= 2) {
        return limited;
      } else if (limited.length <= 5) {
        return `${limited.slice(0, 2)}-${limited.slice(2)}`;
      } else if (limited.length <= 9) {
        return `${limited.slice(0, 2)}-${limited.slice(2, 5)}-${limited.slice(5)}`;
      } else {
        return `${limited.slice(0, 2)}-${limited.slice(2, 6)}-${limited.slice(6, 10)}`;
      }
    }

    // 일반 전화번호 (010, 011, 031 등 3자리 지역/통신사 번호)
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else if (limited.length <= 10) {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    }
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // 생년월일 자동 형식화 함수 (YYYY.MM.DD)
  const formatBirthDate = (value) => {
    // 숫자만 추출
    const numbers = value.replace(/[^0-9]/g, '');

    // 최대 8자리까지만 허용 (YYYYMMDD)
    const limited = numbers.slice(0, 8);

    if (limited.length <= 4) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 4)}.${limited.slice(4)}`;
    } else {
      return `${limited.slice(0, 4)}.${limited.slice(4, 6)}.${limited.slice(6)}`;
    }
  };

  const handleBirthDateChange = (e) => {
    const formatted = formatBirthDate(e.target.value);
    setBirthDate(formatted);
  };


  // 아이디 중복 확인 로직 (API 호출)
  useEffect(() => {
    if (username.length === 0) {
      setUsernameAvailability(null);
      setUsernameMessage('');
      return;
    }

    if (username.length < 3) {
      setUsernameAvailability(null);
      setUsernameMessage('아이디는 3자 이상 50자 이하여야 합니다.');
      return;
    }

    if (username.length > 50) {
      setUsernameAvailability(null);
      setUsernameMessage('아이디는 50자 이하여야 합니다.');
      return;
    }

    setUsernameAvailability('checking');
    setUsernameMessage('');

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data.available) {
          setUsernameAvailability('available');
          setUsernameMessage('사용 가능한 아이디입니다.');
        } else {
          setUsernameAvailability('taken');
          setUsernameMessage('이미 사용중인 아이디입니다.');
        }
      } catch (err) {
        setUsernameAvailability(null);
        setUsernameMessage('중복 확인 실패. 네트워크를 확인해주세요.');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [username]);

  // 이메일 중복 확인 로직 (API 호출)
  useEffect(() => {
    if (email.length === 0) {
      setEmailAvailability(null);
      setEmailMessage('');
      return;
    }

    if (email.length > 255) {
      setEmailAvailability(null);
      setEmailMessage('이메일은 255자 이하여야 합니다.');
      return;
    }

    // 이메일 형식 검증 (영문, 숫자, 허용된 특수문자만)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailAvailability(null);
      setEmailMessage('올바른 이메일 형식이 아닙니다. (영문, 숫자만 허용)');
      return;
    }

    setEmailAvailability('checking');
    setEmailMessage('');

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/auth/check-email?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data.available) {
          setEmailAvailability('available');
          setEmailMessage('사용 가능한 이메일입니다.');
        } else {
          setEmailAvailability('taken');
          setEmailMessage('이미 사용중인 이메일입니다.');
        }
      } catch (err) {
        setEmailAvailability(null);
        setEmailMessage('중복 확인 실패. 네트워크를 확인해주세요.');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email]);

  // 학번 유효성 검사 (8자리 숫자)
  useEffect(() => {
    if (studentNumber.length === 0) {
      setStudentNumberValid(null);
      return;
    }
    const isValid = /^\d{8}$/.test(studentNumber);
    setStudentNumberValid(isValid);
  }, [studentNumber]);

  // 비밀번호 강도 검사 (각 조건별 체크)
  useEffect(() => {
    setPasswordStrength({
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[@$!%*?&]/.test(password),
    });
  }, [password]);

  // 비밀번호 일치 확인
  useEffect(() => {
    if (confirmPassword.length === 0) {
      setPasswordMatch(null);
      return;
    }
    setPasswordMatch(password === confirmPassword);
  }, [password, confirmPassword]);

  // 회원가입 버튼 활성화/비활성화 로직 (termsAgreed에 따라)
  useEffect(() => {
    setSignupButtonEnabled(termsAgreed);
  }, [termsAgreed]);

  // 비밀번호 가시성 토글
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 필수 항목 검사 (아이디, 비밀번호, 이메일, 이름, 전화번호만 필수)
    if (
      !username ||
      !password ||
      !confirmPassword ||
      !email ||
      !realName ||
      !phoneNumber
    ) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (usernameAvailability === 'checking') {
      alert('아이디 중복 확인 중입니다. 잠시 기다려주세요.');
      return;
    }
    if (usernameAvailability === 'taken') {
      alert('이미 사용중인 아이디입니다. 다른 아이디를 선택해주세요.');
      return;
    }

    // 비밀번호 강도 검사
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      alert('비밀번호는 8자 이상이며, 대소문자, 숫자, 특수문자를 포함해야 합니다.');
      return;
    }

    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!termsAgreed) {
      alert('이용약관 및 개인정보처리방침에 동의해야 합니다.');
      return;
    }

    // 필수 필드
    const payload = {
      username,
      password,
      name: realName,
      phone_number: phoneNumber,
      email,
    };

    // 선택 필드 (값이 있을 때만 추가)
    if (studentNumber) payload.student_number = studentNumber;
    if (major) payload.major = major;
    if (joinYear) payload.join_year = Number(joinYear);
    if (birthDate) payload.birth_date = birthDate.replace(/\./g, '-');
    if (gender) payload.gender = gender;
    if (educationStatus) payload.education_status = educationStatus;
    if (techStack) {
      payload.tech_stack = techStack
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    try {
      setIsSubmitting(true);
      setSignupButtonEnabled(false);
      const data = await apiPost('/api/v1/auth/register', payload);
      login(data.user, data.access_token);
      // 환영 모달을 위한 플래그 설정
      sessionStorage.setItem('showWelcomeModal', 'true');
      navigate('/');
    } catch (error) {
      alert(error.message || '회원가입에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
      setSignupButtonEnabled(termsAgreed);
    }
  };

  return (
    <>
      {/* Register Form Section */}
      <section className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4">
          <div className="register-card max-w-2xl mx-auto rounded-2xl shadow-lg p-10 card-hover">
            {/* Top Branding */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="orbitron text-3xl md:text-4xl font-bold gradient-text">
                회원가입
              </h2>
              <p className="orbitron text-gray-400 mt-2">
                Team Crazy Performance에 오신 것을 환영합니다. TCP 부원이 아니더라도 회원가입이 가능합니다.
              </p>
            </div>

            {/* Form */}
            <form id="signupForm" onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div className="input-group">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-300 mb-1 text-left"
                >
                  아이디 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="username"
                    name="username"
                    required
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="아이디를 입력하세요"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    maxLength={50}
                  />
                  <div id="usernameValidation" className="validation-icon">
                    {usernameAvailability === 'checking' && (
                      <div className="loading-spinner"></div>
                    )}
                    {usernameAvailability === 'available' && (
                      <i className="fas fa-check success-icon"></i>
                    )}
                    {usernameAvailability === 'taken' && (
                      <i className="fas fa-times error-icon"></i>
                    )}
                  </div>
                </div>
                {usernameMessage && (
                  <div
                    id="usernameMessage"
                    className={`text-sm mt-1 ${usernameAvailability === 'available' ? 'text-green-400' : 'text-red-500'} text-left`}
                  >
                    {usernameMessage}
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="input-group">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-1 text-left"
                >
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    required
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <i
                    className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                    onClick={togglePasswordVisibility}
                  ></i>
                </div>
                {password.length > 0 && (
                  <div className="mt-2 space-y-1 text-left text-sm">
                    <div className={passwordStrength.minLength ? 'text-green-400' : 'text-red-400'}>
                      <i className={`fas ${passwordStrength.minLength ? 'fa-check' : 'fa-times'} mr-2`}></i>
                      8자 이상
                    </div>
                    <div className={passwordStrength.hasLowercase ? 'text-green-400' : 'text-red-400'}>
                      <i className={`fas ${passwordStrength.hasLowercase ? 'fa-check' : 'fa-times'} mr-2`}></i>
                      영문 소문자 포함
                    </div>
                    <div className={passwordStrength.hasUppercase ? 'text-green-400' : 'text-red-400'}>
                      <i className={`fas ${passwordStrength.hasUppercase ? 'fa-check' : 'fa-times'} mr-2`}></i>
                      영문 대문자 포함
                    </div>
                    <div className={passwordStrength.hasNumber ? 'text-green-400' : 'text-red-400'}>
                      <i className={`fas ${passwordStrength.hasNumber ? 'fa-check' : 'fa-times'} mr-2`}></i>
                      숫자 포함
                    </div>
                    <div className={passwordStrength.hasSpecial ? 'text-green-400' : 'text-red-400'}>
                      <i className={`fas ${passwordStrength.hasSpecial ? 'fa-check' : 'fa-times'} mr-2`}></i>
                      특수문자 포함 (@$!%*?&)
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="input-group">
                <label
                  className="block text-sm font-medium text-gray-300 mb-2 text-left"
                  htmlFor="reg-confirm-password"
                >
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="reg-confirm-password"
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {passwordMatch !== null && (
                    <div className="validation-icon">
                      {passwordMatch ? (
                        <i className="fas fa-check success-icon"></i>
                      ) : (
                        <i className="fas fa-times error-icon"></i>
                      )}
                    </div>
                  )}
                </div>
                {passwordMatch !== null && (
                  <div className={`text-sm mt-1 text-left ${passwordMatch ? 'text-green-400' : 'text-red-500'}`}>
                    {passwordMatch ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                  </div>
                )}
              </div>

              {/* Email Input */}
              <div className="input-group">
                <label
                  className="block text-sm font-medium text-gray-300 mb-2 text-left"
                  htmlFor="reg-email"
                >
                  이메일 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="reg-email"
                    name="email"
                    required
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                  <div className="validation-icon">
                    {emailAvailability === 'checking' && (
                      <div className="loading-spinner"></div>
                    )}
                    {emailAvailability === 'available' && (
                      <i className="fas fa-check success-icon"></i>
                    )}
                    {emailAvailability === 'taken' && (
                      <i className="fas fa-times error-icon"></i>
                    )}
                  </div>
                </div>
                {emailMessage && (
                  <div className={`text-sm mt-1 text-left ${emailAvailability === 'available' ? 'text-green-400' : 'text-red-500'}`}>
                    {emailMessage}
                  </div>
                )}
              </div>

              {/* Name and Phone - Required */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-gray-300 mb-2 text-left"
                    htmlFor="realName"
                  >
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="realName"
                    name="realName"
                    required
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="실명을 입력하세요"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    maxLength={50}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-300 mb-2 text-left"
                    htmlFor="phoneNumber"
                  >
                    전화번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    required
                    className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="010-1234-5678"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    maxLength={13}
                  />
                </div>
              </div>

              {/* Toggle Additional Info Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                  className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
                >
                  <i className={`fas fa-chevron-${showAdditionalInfo ? 'up' : 'down'}`}></i>
                  추가 정보 입력 (선택)
                </button>
              </div>

              {/* Additional Info Section - Collapsible */}
              {showAdditionalInfo && (
                <div className="space-y-4 pt-2 border-t border-gray-700 mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="studentNumber"
                      >
                        학번 (선택)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="studentNumber"
                          name="studentNumber"
                          maxLength={8}
                          className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                          placeholder="학번 8자리"
                          value={studentNumber}
                          onChange={(e) => setStudentNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                        {studentNumberValid !== null && (
                          <div className="validation-icon">
                            {studentNumberValid ? (
                              <i className="fas fa-check success-icon"></i>
                            ) : (
                              <i className="fas fa-times error-icon"></i>
                            )}
                          </div>
                        )}
                      </div>
                      {studentNumber.length > 0 && studentNumberValid === false && (
                        <div className="text-sm mt-1 text-left text-red-500">
                          학번은 8자리 숫자여야 합니다.
                        </div>
                      )}
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="major"
                      >
                        전공 (선택)
                      </label>
                      <input
                        type="text"
                        id="major"
                        name="major"
                        className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="예: 컴퓨터공학과"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="joinYear"
                      >
                        동아리 가입 연도 (선택)
                      </label>
                      <input
                        type="number"
                        id="joinYear"
                        name="joinYear"
                        className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="예: 2024"
                        value={joinYear}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 4);
                          setJoinYear(val);
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="birthDate"
                      >
                        생년월일 (선택)
                      </label>
                      <input
                        type="text"
                        id="birthDate"
                        name="birthDate"
                        maxLength={10}
                        className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="예: 2000.01.01"
                        value={birthDate}
                        onChange={handleBirthDateChange}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="gender"
                      >
                        성별 (선택)
                      </label>
                      <select
                        id="gender"
                        name="gender"
                        className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">선택 안함</option>
                        <option value="Male">남성</option>
                        <option value="Female">여성</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="block text-sm font-medium text-gray-300 mb-2 text-left"
                        htmlFor="educationStatus"
                      >
                        학적 상태 (선택)
                      </label>
                      <select
                        id="educationStatus"
                        name="educationStatus"
                        className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        value={educationStatus}
                        onChange={(e) => setEducationStatus(e.target.value)}
                      >
                        <option value="재학">재학</option>
                        <option value="휴학">휴학</option>
                        <option value="졸업">졸업</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-300 mb-2 text-left"
                      htmlFor="techStack"
                    >
                      기술 스택 (선택)
                    </label>
                    <input
                      type="text"
                      id="techStack"
                      name="techStack"
                      className="w-full px-3 py-2 bg-transparent border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="예: React, Node.js"
                      value={techStack}
                      onChange={(e) => setTechStack(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Terms Agreement Checkbox */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="flex items-start text-left">
                  <input
                    type="checkbox"
                    id="termsAgreement"
                    name="termsAgreement"
                    className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-600 rounded mt-1 bg-transparent"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-300">
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      이용약관
                    </Link>{' '}
                    및
                    <Link
                      to="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      개인정보처리방침
                    </Link>
                    에 동의합니다.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  id="signupBtn"
                  className={`w-full cta-button text-white py-3 px-4 rounded-md font-medium text-lg transition-all duration-200 ${signupButtonEnabled ? 'btn-enabled' : 'btn-disabled'}`}
                  disabled={!signupButtonEnabled || isSubmitting}
                >
                  {isSubmitting ? '가입 중...' : '회원가입'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                이미 계정이 있으신가요?{' '}
                <Link
                  to="/login"
                  className="text-purple-400 hover:text-purple-300 font-medium"
                >
                  로그인
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Register;
