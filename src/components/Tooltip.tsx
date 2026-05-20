'use client';

import { Info } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Small info-icon with a CSS-only hover tooltip.
 *
 * - Pure CSS (no portal, no JS state) → cheap & no layout-shift risk.
 * - Positions above the trigger by default; falls back via `placement` prop.
 * - Backed by HTML `title` attribute too so it works for keyboard / a11y.
 */
export function HelpTooltip({
  text,
  placement = 'top',
  size = 12,
}: {
  text: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  size?: number;
}) {
  return (
    <span className="relative inline-flex items-center group/tip align-middle">
      <Info size={size} className="text-ink-500 hover:text-ink-200 cursor-help transition-colors" aria-label={text} />
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150',
          'absolute z-50 w-60 p-2.5 text-[11px] leading-snug font-normal text-ink-100 normal-case tracking-normal',
          'bg-ink-950/95 backdrop-blur border border-ink-700 rounded-lg shadow-xl',
          placement === 'top' && 'bottom-full mb-2 left-1/2 -translate-x-1/2',
          placement === 'bottom' && 'top-full mt-2 left-1/2 -translate-x-1/2',
          placement === 'left' && 'right-full mr-2 top-1/2 -translate-y-1/2',
          placement === 'right' && 'left-full ml-2 top-1/2 -translate-y-1/2',
        )}
      >
        {text}
      </span>
    </span>
  );
}
