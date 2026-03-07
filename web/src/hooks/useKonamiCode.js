import { useEffect, useState, useCallback, useRef } from 'react';

const KONAMI_CODE_KEYS = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a'
];

const KONAMI_CODE_SWIPES = [
    'UP',
    'UP',
    'DOWN',
    'DOWN',
    'LEFT',
    'RIGHT',
    'LEFT',
    'RIGHT',
    // 'b' and 'a' mapped to taps or we just accept the first 8 for mobile
];

export const useKonamiCode = (onUnlock, requireTap = false) => {
    const [keySequence, setKeySequence] = useState([]);
    const [swipeSequence, setSwipeSequence] = useState([]);

    // Touch handling refs
    const touchStartRef = useRef(null);

    const handleKeyDown = useCallback((e) => {
        setKeySequence((prev) => {
            const newSequence = [...prev, e.key];
            // Keep only the last N keys where N is the length of KONAMI_CODE_KEYS
            if (newSequence.length > KONAMI_CODE_KEYS.length) {
                newSequence.shift();
            }

            // Check if matches completely
            if (newSequence.join(',').toLowerCase() === KONAMI_CODE_KEYS.join(',').toLowerCase()) {
                onUnlock();
                return []; // Reset after unlock
            }

            return newSequence;
        });
    }, [onUnlock]);

    const handleTouchStart = useCallback((e) => {
        // Only track single touches for swipe
        if (e.touches.length !== 1) return;
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            time: Date.now()
        };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (!touchStartRef.current) return;

        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY,
            time: Date.now()
        };

        const dx = touchEnd.x - touchStartRef.current.x;
        const dy = touchEnd.y - touchStartRef.current.y;

        touchStartRef.current = null;

        let direction = null;
        // Require at least 20px movement to count as a swipe (very forgiving)
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
            direction = dx > 0 ? 'RIGHT' : 'LEFT';
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20) {
            direction = dy > 0 ? 'DOWN' : 'UP';
        }

        if (direction) {
            setSwipeSequence((prev) => {
                const newSequence = [...prev, direction];
                const targetSequence = KONAMI_CODE_SWIPES.slice(0, 8);

                if (newSequence.length > targetSequence.length) {
                    newSequence.shift();
                }

                if (newSequence.join(',') === targetSequence.join(',')) {
                    onUnlock();
                    return [];
                }
                return newSequence;
            });
        }
    }, [onUnlock]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        // For modern mobile browsers, passive: false is sometimes required to capture all touches
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleKeyDown, handleTouchStart, handleTouchEnd]);
};
