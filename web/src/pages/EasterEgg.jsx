import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import easterEggData from '../data/easteregg.json';

function EasterEgg() {
  const navigate = useNavigate();
  const crawlRef = useRef(null);
  const [isSpeedingUp, setIsSpeedingUp] = useState(false);
  const [fadeState, setFadeState] = useState('in'); // 'in' (black to clear), 'normal' (clear), 'out' (clear to black)

  // Trigger fade-in on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeState('normal');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (crawlRef.current) {
      // Access the Web Animations API if available to smoothly change playback rate
      const animations = crawlRef.current.getAnimations();
      if (animations.length > 0) {
        animations.forEach(anim => {
          anim.playbackRate = isSpeedingUp ? 2 : 1; // Changed to 2x speed for better readability
        });
      }
    }
  }, [isSpeedingUp]);

  const handlePressStart = () => setIsSpeedingUp(true);
  const handlePressEnd = () => setIsSpeedingUp(false);

  const handleAnimationEnd = () => {
    // When the crawl finishes, fade to black, then navigate home
    setFadeState('out');
    setTimeout(() => {
      navigate('/');
    }, 3000); // Wait for the 3s fade out
  };

  const stars = useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.8 + 0.2,
      animationDuration: Math.random() * 3 + 2,
      animationDelay: Math.random() * 2
    }));
  }, []);

  return (
    <div
      className="min-h-screen bg-black text-white overflow-hidden relative pt-20 select-none"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      style={{ cursor: isSpeedingUp ? 'grabbing' : 'grab' }}
    >
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
          /* Start exactly at the bottom edge of the screen */
          bottom: -150%; 
          transform-origin: 50% 100%;
          /* Shortened duration so it finishes closer to the actual text length */
          animation: easter-crawl-up 30s linear forwards;
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
          font-size: clamp(1.2rem, 2.5vw, 2.2rem);
          font-weight: 500;
        }

        .easter-block {
          margin-top: 3.5rem;
          margin-bottom: 2rem;
          text-align: center;
          padding: 0 10%;
        }

        .easter-generation {
          color: #ffd54f;
          font-size: clamp(2rem, 5vw, 4rem);
          font-weight: 800;
          text-align: center;
          margin: 5rem 0 3rem 0;
          letter-spacing: 0.1em;
          border-bottom: 2px solid rgba(255, 213, 79, 0.3);
          padding-bottom: 1rem;
        }

        .easter-team {
          margin-bottom: 3.5rem;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
        }

        .easter-role-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .easter-role-title {
          font-size: clamp(1.6rem, 3.5vw, 2.8rem);
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .easter-role-desc {
          color: #bbb;
          font-size: clamp(1rem, 2vw, 1.6rem);
          font-weight: 400;
          margin-bottom: 2rem;
        }

        .easter-member {
          display: flex;
          flex-direction: column;
          margin-bottom: 1.5rem;
          align-items: center;
        }

        .easter-member-name {
          color: #fff;
          font-weight: 700;
          font-size: clamp(1.4rem, 2.8vw, 2.2rem);
        }

        .easter-member-role {
          color: #e0e0e0;
          font-size: clamp(1rem, 2vw, 1.6rem);
          font-weight: 400;
        }

        @media (min-width: 1024px) {
          .easter-stage {
            height: calc(100vh - 4rem);
            perspective: 260px;
          }

          .easter-crawl {
            width: 98%;
            left: 1%;
            bottom: -150%;
            animation: easter-crawl-up-desktop 35s linear forwards;
          }

          .easter-title {
            font-size: 4rem;
          }

          .easter-heading {
            font-size: 10.5rem;
          }

          .easter-body {
            font-size: 3.5rem;
            line-height: 1.62;
          }
        }

        @media (min-width: 1440px) {
          .easter-heading {
            font-size: 11.5rem;
          }

          .easter-body {
            font-size: 4rem;
          }
        }

        @keyframes easter-crawl-up {
          0% {
            transform: rotateX(17deg) translateY(50vh);
          }
          100% {
            transform: rotateX(17deg) translateY(-250%);
          }
        }

        @keyframes easter-crawl-up-desktop {
          0% {
            transform: rotateX(15deg) translateY(50vh);
          }
          100% {
            transform: rotateX(15deg) translateY(-220%);
          }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="absolute inset-0 z-0">
        {stars.map((star) => (
          <div
            key={star.id}
            style={{
              position: 'absolute',
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: '#FFF',
              borderRadius: '50%',
              opacity: star.opacity,
              animation: `twinkle ${star.animationDuration}s infinite ease-in-out ${star.animationDelay}s`,
            }}
          />
        ))}
      </div>
      <div className="easter-fade" />

      <div className="easter-stage">
        <div
          className="easter-crawl"
          ref={crawlRef}
          onAnimationEnd={handleAnimationEnd}
        >
          <p className="easter-title">EASTER EGG DISCOVERED</p>
          <h1 className="easter-heading">축하합니다!</h1>
          <div className="easter-body">
            <p className="text-center">이스터에그를 찾아주셔서 감사합니다.</p>
            <p className="mt-2 mb-12 text-center">이 웹사이트를 함께 만든 사람들입니다.</p>

            {Object.entries(easterEggData).map(([generation, teams]) => (
              teams.length > 0 && (
                <div key={generation} className="easter-block">
                  <h2 className="easter-generation">{generation}</h2>

                  {teams.map((team) => (
                    <div className="easter-team" key={team.id}>
                      <div className="easter-role-header">
                        <span>{team.icon}</span>
                        <h3 className="easter-role-title" style={{ color: team.color }}>{team.label}</h3>
                      </div>
                      <p className="easter-role-desc">{team.desc}</p>

                      <div className="easter-members">
                        {team.members.map((member, idx) => (
                          <div className="easter-member" key={idx}>
                            <span className="easter-member-name" style={{ color: team.color }}>{member.name}</span>
                            <span className="easter-member-role">{member.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))}

            <p className="mt-20 text-center" style={{ color: '#ffd54f', fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 800 }}>May the Code be with you.</p>
          </div>
        </div>
      </div>

      {/* Fade overlay for entry and exit transitions */}
      <div
        className="fixed inset-0 z-[9999] bg-black pointer-events-none transition-opacity duration-3000 ease-in-out"
        style={{
          opacity: fadeState === 'normal' ? 0 : 1
        }}
      />
    </div>
  );
}

export default EasterEgg;
