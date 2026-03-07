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
        const dt = touchEnd.time - touchStartRef.current.time;

        touchStartRef.current = null;

        // Ignore taps if looking for swipes
        if (dt > 1000) return; // Took too long

        let direction = null;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            direction = dx > 0 ? 'RIGHT' : 'LEFT';
        } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
            direction = dy > 0 ? 'DOWN' : 'UP';
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && requireTap) {
            direction = 'TAP'; // For 'B' and 'A' equivalent on mobile if we wanted
        }

        if (direction) {
            setSwipeSequence((prev) => {
                const newSequence = [...prev, direction];

                // Use a shortened sequence for mobile (just the arrows) to make it easier
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
    }, [onUnlock, requireTap]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleKeyDown, handleTouchStart, handleTouchEnd]);
};
