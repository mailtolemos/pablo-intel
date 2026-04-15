'use client';
import { useEffect, useState } from 'react';

interface Props {
  variant?: 'strip' | 'bar'; // strip = inline in price strip, bar = standalone bottom bar
  pythCount?: number;         // how many feeds are from Pyth (optional)
}

export default function PythBadge({ variant = 'strip', pythCount }: Props) {
  const [pulse, setPulse] = useState(true);

  // Toggle pulse every 2s for emphasis
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(id);
  }, []);

  if (variant === 'bar') {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full transition-opacity duration-500"
          style={{
            background: 'var(--green)',
            boxShadow: pulse ? '0 0 8px var(--green)' : 'none',
            opacity: pulse ? 1 : 0.5,
          }}
        />
        <span className="text-[8px] font-['Orbitron'] font-bold tracking-widest" style={{ color: 'var(--green)' }}>
          PYTH NETWORK
        </span>
        <span className="text-[7px] text-terminal-dim font-['Orbitron'] tracking-wider">
          LIVE PRICE FEED{pythCount ? ` · ${pythCount} FEEDS` : ''}
        </span>
      </div>
    );
  }

  // strip variant — compact, sits inside the price strip
  return (
    <div
      className="flex items-center gap-1.5 px-3 border-r border-terminal-border shrink-0"
      style={{ background: 'rgba(0,232,122,0.04)' }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full transition-all duration-500 shrink-0"
        style={{
          background: 'var(--green)',
          boxShadow: pulse ? '0 0 6px var(--green)' : 'none',
        }}
      />
      <div className="flex flex-col">
        <span className="text-[8px] font-['Orbitron'] font-bold leading-none" style={{ color: 'var(--green)' }}>
          PYTH
        </span>
        <span className="text-[6px] text-terminal-dim font-['Orbitron'] tracking-wider leading-none mt-0.5">
          LIVE
        </span>
      </div>
    </div>
  );
}
