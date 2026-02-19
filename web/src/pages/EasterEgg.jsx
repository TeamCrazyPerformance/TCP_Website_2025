import React from 'react';

function EasterEgg() {
  const contributors = [
    { role: '프론트엔드', names: ['박연오', '마정훈', '이준수'] },
    { role: '백엔드', names: ['김영진', '서준수', '정세영'] },
    { role: '서버 및 총괄', names: ['이준수'] },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative pt-20">
      <style>{`
        .easter-stars {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.95), transparent),
            radial-gradient(1px 1px at 75% 20%, rgba(255,255,255,0.8), transparent),
            radial-gradient(2px 2px at 60% 65%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.75), transparent),
            radial-gradient(2px 2px at 90% 55%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 10% 60%, rgba(255,255,255,0.65), transparent),
            radial-gradient(2px 2px at 45% 15%, rgba(255,255,255,0.85), transparent);
          opacity: 0.85;
          z-index: 1;
        }

        .easter-stage {
          position: relative;
          height: calc(100vh - 5rem);
          perspective: 420px;
          overflow: hidden;
          z-index: 2;
        }

        .easter-crawl {
          position: absolute;
          width: 86%;
          left: 7%;
          bottom: -70%;
          transform-origin: 50% 100%;
          animation: easter-crawl-up 32s linear forwards;
          text-align: center;
        }

        .easter-fade {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 34vh;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.92) 0%,
            rgba(0, 0, 0, 0.68) 35%,
            rgba(0, 0, 0, 0) 100%
          );
          pointer-events: none;
          z-index: 3;
        }

        .easter-title {
          color: #ffe08a;
          font-weight: 700;
          letter-spacing: 0.1em;
          font-size: clamp(1.4rem, 3.4vw, 2.5rem);
          margin-bottom: 1.7rem;
        }

        .easter-heading {
          color: #ffd54f;
          font-size: clamp(3rem, 7vw, 6.2rem);
          font-weight: 800;
          margin-bottom: 2.5rem;
          letter-spacing: 0.09em;
        }

        .easter-body {
          color: #f5deb3;
          line-height: 1.8;
          font-size: clamp(1.7rem, 4vw, 3.1rem);
          font-weight: 700;
        }

        .easter-block {
          margin-top: 2.2rem;
        }

        .easter-role {
          color: #ffe8a3;
          margin-bottom: 0.7rem;
        }

        @media (min-width: 1024px) {
          .easter-stage {
            height: calc(100vh - 4rem);
            perspective: 260px;
          }

          .easter-crawl {
            width: 98%;
            left: 1%;
            bottom: -18%;
            animation: easter-crawl-up-desktop 36s linear forwards;
          }

          .easter-title {
            font-size: 4rem;
          }

          .easter-heading {
            font-size: 10.5rem;
          }

          .easter-body {
            font-size: 5rem;
            line-height: 1.62;
          }
        }

        @media (min-width: 1440px) {
          .easter-heading {
            font-size: 11.5rem;
          }

          .easter-body {
            font-size: 5.4rem;
          }
        }

        @keyframes easter-crawl-up {
          0% {
            transform: rotateX(17deg) translateY(0);
          }
          100% {
            transform: rotateX(17deg) translateY(-290%);
          }
        }

        @keyframes easter-crawl-up-desktop {
          0% {
            transform: rotateX(15deg) translateY(0);
          }
          100% {
            transform: rotateX(15deg) translateY(-235%);
          }
        }
      `}</style>

      <div className="easter-stars" />
      <div className="easter-fade" />

      <div className="easter-stage">
        <div className="easter-crawl">
          <p className="easter-title">EASTER EGG DISCOVERED</p>
          <h1 className="easter-heading">축하합니다!</h1>
          <div className="easter-body">
            <p>이스터에그를 찾아주셔서 감사합니다.</p>
            <p className="mt-2">이 웹사이트를 함께 만든 사람들입니다.</p>

            {contributors.map((team) => (
              <div className="easter-block" key={team.role}>
                <p className="easter-role">{team.role}</p>
                <p>{team.names.join(', ')}</p>
              </div>
            ))}

            <p className="mt-6">May the Code be with you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EasterEgg;
