'use client';
import { useState, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
  title:       string;
  description: string;
  unit?:       string;
  /** Additional context line (e.g. current reading interpretation) */
  context?:    string;
}

export default function MetricTooltip({ children, title, description, unit, context }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onEnter = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const onLeave = useCallback(() => setPos(null), []);

  // Clamp so tooltip never overflows viewport
  const tipLeft = pos ? Math.min(pos.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1400) - 260) : 0;
  const tipTop  = pos ? Math.max(pos.y - 100, 8) : 0;

  return (
    <span
      className="relative cursor-help underline decoration-dotted decoration-terminal-dim/50 underline-offset-2"
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}

      {pos && (
        <span
          className="fixed z-[9999] w-56 pointer-events-none select-none"
          style={{ left: tipLeft, top: tipTop }}
        >
          <span className="block bg-[#050f1e] border border-terminal-border rounded shadow-xl px-3 py-2.5">
            {/* Title */}
            <span className="block font-['Orbitron'] text-[9px] tracking-widest text-terminal-blue font-bold uppercase mb-1.5">
              {title}
            </span>
            {/* Description */}
            <span className="block text-[10px] text-terminal-text leading-snug">
              {description}
            </span>
            {/* Unit */}
            {unit && (
              <span className="block text-[9px] text-terminal-amber font-semibold mt-1.5">
                Unit: {unit}
              </span>
            )}
            {/* Context */}
            {context && (
              <span className="block text-[9px] text-terminal-dim mt-1 italic border-t border-terminal-border/50 pt-1.5">
                {context}
              </span>
            )}
          </span>
        </span>
      )}
    </span>
  );
}
