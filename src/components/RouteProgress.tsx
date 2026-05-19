'use client';

/**
 * Top progress bar shown during client-side route transitions.
 * Mimics the "loading" UX of GitHub / YouTube.
 *
 * - Starts immediately on intra-app link click.
 * - Animates to ~90% via stepped easing while target page mounts.
 * - Snaps to 100% then fades out when `usePathname()` reports the new path.
 * - Pure CSS, no NProgress dependency.
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPath = useRef(pathname);

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }

  function startProgress() {
    clearTimers();
    setActive(true);
    setProgress(12);
    // Stepped fake progress — feels responsive without locking to actual load timing.
    const steps = [25, 42, 58, 72, 82, 89];
    steps.forEach((v, i) => {
      const t = setTimeout(() => setProgress(v), 80 * (i + 1));
      timersRef.current.push(t);
    });
  }

  // Listen for in-app link clicks anywhere; ignore external / hash / same-route links.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Modifier-click / middle-click opens new tab — don't start the bar
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
      try {
        const abs = new URL(href, window.location.origin).pathname;
        if (abs === pathname) return;
      } catch {
        return;
      }
      startProgress();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pathname]);

  // When pathname actually changes, complete the bar and fade it out.
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    clearTimers();
    setProgress(100);
    const t1 = setTimeout(() => setActive(false), 220);
    const t2 = setTimeout(() => setProgress(0), 500);
    timersRef.current.push(t1, t2);
    return () => clearTimers();
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={clsx(
        'fixed top-0 inset-x-0 h-[2px] z-[60] pointer-events-none transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-accent-600 via-accent-500 to-accent-400 shadow-[0_0_12px_rgba(52,194,255,0.7)]"
        style={{
          width: `${progress}%`,
          transition: 'width 260ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
}
