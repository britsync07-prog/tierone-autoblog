'use client';

import { useEffect, useRef } from 'react';

// Reading-progress bar: clean solid accent bar without gradients or shadows.
export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = barRef.current;
      if (!el) return;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const fraction =
        scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      el.style.width = `${fraction * 100}%`;
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="fixed top-0 left-0 h-1 w-0 bg-[#fe7141] z-50"
    />
  );
}
