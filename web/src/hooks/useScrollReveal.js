import { useEffect } from 'react';

export function useScrollReveal(selector = '.scroll-fade', refreshKey = '') {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach((element) => element.classList.add('visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0, rootMargin: '0px 0px -50px 0px' },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [selector, refreshKey]);
}
