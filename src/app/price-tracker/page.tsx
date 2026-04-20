'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PriceTrackerPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const trackedAssets = ['BTC', 'ETH', 'HYPE', 'SOL', 'PYTH', 'FOGO', 'GOLD', 'SP500', 'BRENT', 'WTI'];

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/price-tracker');
      const data = await response.json();
      if (data.alerts) {
        setAlerts(data.alerts || []);
      }
      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-terminal-bg overflow-hidden font-mono">
      {/* Top bar */}
      <div className="shrink-0 h-10 border-b border-terminal-border bg-terminal-panel flex items-center px-5 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-terminal-red animate-pulse" />
          <span className="text-[11px] font-['Orbitron'] font-bold tracking-[0.25em] text-terminal-bright">
            PABLO<span style={{ color: 'var(--red)' }}>TRACKER</span>
          </span>
        </div>
        <div className="h-4 w-px bg-terminal-border" />
        <span className="text-[9px] font-['Orbitron'] text-terminal-dim tracking-widest uppercase">
          Live Price Tracking Bot
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-pulse" />
            <span className="text-[8px] font-['Orbitron'] font-bold text-terminal-red tracking-wider">LIVE</span>
          </div>
          <span className="text-[8px] text-terminal-dim font-['Orbitron']">
            {lastUpdate || 'Loading...'}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-6 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-['Orbitron'] font-bold tracking-widest"
              style={{ color: 'var(--bright)', textShadow: '0 0 30px rgba(255,100,0,0.2)' }}>
              PRICE TRACKER
            </h1>
            <p className="text-xs text-terminal-dim font-['Orbitron'] tracking-widest mt-2">
              Monitoring {trackedAssets.length} assets for &gt;0.75% moves in 5-minute windows
            </p>
          </div>
          <Link href="/"
            className="px-4 py-2 rounded border text-xs font-['Orbitron'] font-bold tracking-widest"
            style={{ background: 'rgba(0,200,240,0.08)', borderColor: 'rgba(0,200,240,0.3)', color: 'var(--blue)' }}>
            ← BACK
          </Link>
        </div>

        {/* Tracked assets */}
        <div className="grid grid-cols-5 gap-2">
          {trackedAssets.map(asset => (
            <div key={asset} className="p-3 rounded border text-center text-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-[9px] text-terminal-dim font-['Orbitron'] tracking-wider">{asset}</div>
              <div className="text-sm font-bold font-['Orbitron'] mt-1" style={{ color: 'var(--blue)' }}>WATCHING</div>
            </div>
          ))}
        </div>

        {/* Alerts section */}
        <div className="mt-4">
          <h2 className="text-sm font-['Orbitron'] font-bold tracking-widest mb-3" style={{ color: 'var(--bright)' }}>
            ACTIVE ALERTS
          </h2>

          {loading ? (
            <div className="text-xs text-terminal-dim font-['Orbitron']">Fetching alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-6 rounded border text-center" style={{ background: 'rgba(0,200,240,0.02)', borderColor: 'rgba(0,200,240,0.15)' }}>
              <div className="text-xs text-terminal-dim font-['Orbitron'] tracking-widest">NO ACTIVE ALERTS</div>
              <div className="text-[10px] text-terminal-dim mt-2">Waiting for price moves &gt;0.75% in 5-minute windows</div>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className="p-4 rounded border"
                  style={{ background: 'rgba(255,100,0,0.08)', borderColor: 'rgba(255,100,0,0.3)' }}>
                  <div className="text-sm font-['Orbitron'] font-bold">{alert}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configuration info */}
        <div className="mt-6 p-4 rounded border text-[9px] space-y-1"
          style={{ background: 'rgba(0,200,240,0.02)', borderColor: 'rgba(0,200,240,0.15)' }}>
          <div className="font-['Orbitron'] font-bold text-terminal-bright">ℹ️ CONFIGURATION</div>
          <div className="text-terminal-dim space-y-0.5">
            <div>Assets: {trackedAssets.join(', ')}</div>
            <div>Threshold: &gt;0.75% movement in 5 minutes</div>
            <div>Update Interval: Every 60 seconds</div>
            <div>Alerts: Sent to Telegram bot in real-time</div>
          </div>
        </div>
      </div>
    </div>
  );
}
