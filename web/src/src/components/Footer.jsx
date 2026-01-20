import React from 'react';
import { Link } from 'react-router-dom'; // Link 컴포넌트 임포트
import logo from '../logo.svg'; // src 폴더에 있는 logo.svg를 상대 경로로 임포트

function Footer() {
  return (
    <footer className="bg-black border-t border-gray-800 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Club Info Column */}
          <div className="text-left">
            {' '}
            {/* 이 div에 text-left 추가 */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img
                  src={logo}
                  alt="TCP 로고"
                  className="w-full h-full object-contain"
                />
              </div>
              {/* h3 태그에 text-left 추가 (혹시 모를 상속 문제 방지) */}
              <h3 className="orbitron text-lg font-bold gradient-text text-left">
                TCP
              </h3>
            </div>
            {/* p 태그에 text-left 추가 (혹시 모를 상속 문제 방지) */}
            <p className="text-sm text-gray-400 text-left">
              Team Crazy Performance
              <br />
              컴퓨터공학과 학술 동아리
            </p>
          </div>

          {/* Leadership Column */}
          <div className="text-left">
            {' '}
            {/* 이 div에 text-left 추가 */}
            {/* h4 태그에 text-left 추가 */}
            <h4 className="orbitron text-lg font-bold mb-4 text-white text-left">
              임원진
            </h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <span className="text-blue-300">회장:</span> 컴퓨터공학과 24학번
                박연오
              </div>
              <div className="text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <span className="text-purple-300">부회장:</span> 컴퓨터공학과
                23학번 김영진
              </div>
            </div>
          </div>

          {/* Contact Column */}
          <div className="text-left">
            {' '}
            {/* 이 div에 text-left 추가 */}
            {/* h4 태그에 text-left 추가 */}
            <h4 className="orbitron text-lg font-bold mb-4 text-white text-left">
              연락처
            </h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center space-x-2 text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <i className="fas fa-phone text-blue-400"></i>
                <span>010-5096-3236</span>
              </div>
              <div className="flex items-center space-x-2 text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <i className="fas fa-envelope text-purple-400"></i>
                <span>seoultechcstcp@gmail.com</span>
              </div>
              <div className="flex items-center space-x-2 text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <i className="fab fa-instagram text-pink-400"></i>
                {/* Instagram 링크 수정 */}
                <a
                  href="https://www.instagram.com/seoultech.tcp?igsh=MTNpOG9wM201d3BhcA=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pink-300 transition-colors"
                >
                  @seoultech.tcp
                </a>
              </div>
            </div>
          </div>

          {/* Legal Column */}
          <div className="text-left">
            {' '}
            {/* 이 div에 text-left 추가 */}
            {/* h4 태그에 text-left 추가 */}
            <h4 className="orbitron text-lg font-bold mb-4 text-white text-left">
              법적 정보
            </h4>
            <div className="space-y-2 text-sm">
              <div className="text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <Link
                  to="/terms"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  이용약관
                </Link>
              </div>
              <div className="text-left">
                {' '}
                {/* 이 div에 text-left 추가 */}
                <Link
                  to="/privacy"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  개인정보처리방침
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright Section (text-center 유지) */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-sm text-gray-400">
            © 2024 TCP (Team Crazy Performance). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
