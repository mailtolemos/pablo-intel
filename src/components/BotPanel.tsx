'use client';
import { useEffect, useState, useCallback } from 'react';

interface AlertRecord {
  type:      'flash' | 'analysis' | 'price' | 'event';
  title:     string;
  source:    string;
  score:     number;
  direction: string;
  sentAt:    string;
  url?:      string;
}

interface UpcomingEvent {
  name:         string;
  icon:         string;
  detail:       string;
  fireTime:     string;
  minutesUntil: number;
}

interface BotStatus {
  startedAt:         string;
  lastTickAt:        string | null;
  lastNewsAt:        string | null;
  tickCount:         number;
  articlesScanned:   number;
  flashSent:         number;
  analysisSent:      number;
  priceSent:         number;
  eventSent:         number;
  recentAlerts:      AlertRecord[];
  telegramConnected: boolean;
  chatCount:         number;
  feedCount:         number;
  upcomingEvents:    UpcomingEvent[];
  errors:            string[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)  return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff/60)}m ago`;
  return `${Math.round(diff/3600)}h ago`;
}
function fmtMinutes(min: number): string {
  if (min < 60)  return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toUTCString().slice(17, 22) + ' UTC';
}

const DIR_ICON: Record<string, string> = {
  bullish: '🟢', bearish: '🔴', mixed: '🟡', neutral: '⚪',
};
const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  flash:    { label: '⚡ FLASH',    color: '#ff2844' },
  analysis: { label: '📊 ANALYSIS', color: '#00c8f0' },
  price:    { label: '💹 PRICE',    color: '#ffb300' },
  event:    { label: '📅 EVENT',    color: '#00e87a' },
};

export default function BotPanel() {
  const [status,  setStatus]  = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'alerts' | 'events' | 'stats'>('alerts');
  const [tick,    setTick]    = useState(0);   // for relative time refresh

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/bot/status');
      const d = await r.json();
      if (d.ok) setStatus(d);
    } catch { /* stale */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const si = setInterval(fetchStatus, 30_000);
    const ti = setInterval(() => setTick(t => t + 1), 15_000);
    return () => { clearInterval(si); clearInterval(ti); };
  }, [fetchStatus]);

  const isLive = status?.lastTickAt
    ? (Date.now() - new Date(status.lastTickAt).getTime()) < 20 * 60 * 1000   // active in last 20 min
    : false;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel transition-colors duration-300">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="section-header shrink-0">
        <div className="dot" style={{ background: isLive ? '#00e87a' : '#ff3355' }} />
        <span>SIGNAL INTEL</span>
        <span className="ml-auto text-[9px] font-['Orbitron'] flex items-center gap-2">
          <span style={{ color: isLive ? '#00e87a' : '#ff5555' }}>
            {isLive ? '● LIVE' : '○ IDLE'}
          </span>
          {status && (
            <span className="text-terminal-dim">
              tick {timeAgo(status.lastTickAt)}
            </span>
          )}
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col gap-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-2.5 bg-terminal-muted rounded w-3/4" />
              <div className="h-2 bg-terminal-muted/50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !status ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-terminal-dim text-[10px]">Bot offline — no data</div>
        </div>
      ) : (
        <>
          {/* ── Status strip ────────────────────────────────── */}
          <div className="shrink-0 px-3 py-2 flex items-center gap-3 border-b border-terminal-border/50"
               style={{ background: 'rgba(0,0,0,0.2)' }}>
            {/* Telegram */}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${status.telegramConnected ? 'bg-terminal-green animate-pulse' : 'bg-terminal-red'}`} />
              <span className="text-[9px]" style={{ color: status.telegramConnected ? '#00e87a' : '#ff5555' }}>
                TG {status.telegramConnected ? `✓ ${status.chatCount} chat${status.chatCount !== 1 ? 's' : ''}` : '✗ disconnected'}
              </span>
            </div>
            <span className="text-terminal-border">|</span>
            {/* Feeds */}
            <span className="text-[9px] text-terminal-dim">
              📡 <span className="text-terminal-text">{status.feedCount}</span> feeds
            </span>
            <span className="text-terminal-border">|</span>
            {/* Articles */}
            <span className="text-[9px] text-terminal-dim">
              📰 <span className="text-terminal-text">{status.articlesScanned.toLocaleString()}</span> scanned
            </span>
          </div>

          {/* ── Tabs ────────────────────────────────────────── */}
          <div className="shrink-0 flex border-b border-terminal-border">
            {(['alerts', 'events', 'stats'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-[9px] font-['Orbitron'] tracking-wider uppercase transition-colors ${
                  tab === t
                    ? 'text-terminal-blue border-b border-terminal-blue'
                    : 'text-terminal-dim hover:text-terminal-text'
                }`}
              >
                {t === 'alerts' ? `⚡ Signals (${status.recentAlerts.length})`
                 : t === 'events' ? `📅 Events`
                 : '📊 Stats'}
              </button>
            ))}
          </div>

          {/* ── Tab content ─────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ALERTS tab */}
            {tab === 'alerts' && (
              <div className="p-2 flex flex-col gap-1.5">
                {status.recentAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-[28px] mb-2">📡</div>
                    <div className="text-terminal-dim text-[10px]">No alerts sent yet</div>
                    <div className="text-terminal-dim/60 text-[9px] mt-1">
                      Bot runs every 15 min via Vercel cron
                    </div>
                  </div>
                ) : status.recentAlerts.map((alert, i) => {
                  const badge = TYPE_BADGE[alert.type] ?? TYPE_BADGE.analysis;
                  return (
                    <div key={i} className="panel px-2.5 py-2">
                      {/* Top row: type badge + direction + time */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                          style={{ color: badge.color, background: badge.color + '18', border: `1px solid ${badge.color}44` }}>
                          {badge.label}
                        </span>
                        {alert.score > 0 && (
                          <span className="text-[8px] text-terminal-dim">
                            {DIR_ICON[alert.direction] ?? '⚪'} {alert.score}
                          </span>
                        )}
                        <span className="ml-auto text-[8px] text-terminal-dim/60">
                          {timeAgo(alert.sentAt)}
                        </span>
                      </div>
                      {/* Title */}
                      <div className="text-[10px] text-terminal-text leading-snug line-clamp-2">
                        {alert.url
                          ? <a href={alert.url} target="_blank" rel="noopener noreferrer"
                               className="hover:text-terminal-blue transition-colors">
                              {alert.title}
                            </a>
                          : alert.title
                        }
                      </div>
                      {/* Source */}
                      <div className="text-[8px] text-terminal-dim mt-0.5">{alert.source}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* EVENTS tab */}
            {tab === 'events' && (
              <div className="p-2 flex flex-col gap-1.5">
                <div className="text-[8px] text-terminal-dim font-['Orbitron'] tracking-widest text-center py-1">
                  NEXT 7 DAYS · REMINDERS 30 MIN BEFORE
                </div>
                {status.upcomingEvents.length === 0 ? (
                  <div className="text-terminal-dim text-[10px] text-center py-6">No events in next 7 days</div>
                ) : status.upcomingEvents.map((evt, i) => {
                  const urgent = evt.minutesUntil <= 60;
                  const soon   = evt.minutesUntil <= 360;
                  return (
                    <div key={i} className={`panel px-2.5 py-2.5 ${urgent ? 'border-terminal-amber/40' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-[14px] shrink-0">{evt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-terminal-bright font-semibold leading-tight">
                            {evt.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px]" style={{ color: urgent ? '#ffb300' : soon ? '#c0d8ec' : '#6b9db8' }}>
                              ⏰ {fmtTime(evt.fireTime)}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                              style={{
                                color: urgent ? '#ffb300' : soon ? '#00c8f0' : '#6b9db8',
                                background: (urgent ? '#ffb300' : soon ? '#00c8f0' : '#6b9db8') + '15',
                                border: `1px solid ${(urgent ? '#ffb300' : soon ? '#00c8f0' : '#6b9db8')}33`,
                              }}>
                              in {fmtMinutes(evt.minutesUntil)}
                            </span>
                          </div>
                          <div className="text-[8px] text-terminal-dim mt-1 leading-snug line-clamp-2">
                            {evt.detail}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STATS tab */}
            {tab === 'stats' && (
              <div className="p-2 space-y-2">
                {/* Alert totals */}
                <div className="grid grid-cols-2 gap-1.5">
                  <StatTile label="FLASH SENT"    value={status.flashSent}    color="text-[#ff2844]" />
                  <StatTile label="ANALYSIS SENT" value={status.analysisSent} color="text-terminal-blue" />
                  <StatTile label="EVENT ALERTS"  value={status.eventSent}    color="text-terminal-green" />
                  <StatTile label="TICKS RUN"     value={status.tickCount}    color="text-terminal-amber" />
                </div>
                {/* Activity */}
                <div className="panel px-3 py-2.5 space-y-2">
                  <div className="text-[8px] text-terminal-dim font-['Orbitron'] tracking-widest mb-1">ACTIVITY</div>
                  <InfoRow label="Articles scanned" value={status.articlesScanned.toLocaleString()} />
                  <InfoRow label="Feeds monitored"  value={String(status.feedCount)} />
                  <InfoRow label="Last tick"         value={timeAgo(status.lastTickAt)} />
                  <InfoRow label="Last news run"     value={timeAgo(status.lastNewsAt)} />
                  <InfoRow label="Bot started"       value={timeAgo(status.startedAt)} />
                </div>
                {/* Telegram */}
                <div className="panel px-3 py-2.5 space-y-2">
                  <div className="text-[8px] text-terminal-dim font-['Orbitron'] tracking-widest mb-1">TELEGRAM</div>
                  <InfoRow
                    label="Status"
                    value={status.telegramConnected ? `Connected (${status.chatCount} chat${status.chatCount !== 1 ? 's' : ''})` : 'Disconnected'}
                    valueColor={status.telegramConnected ? 'text-terminal-green' : 'text-terminal-red'}
                  />
                  <InfoRow label="Total sent" value={String(status.flashSent + status.analysisSent + status.eventSent)} />
                </div>
                {/* Errors */}
                {status.errors.length > 0 && (
                  <div className="panel px-3 py-2 border-red-900/40">
                    <div className="text-[8px] text-terminal-red font-['Orbitron'] tracking-widest mb-1.5">RECENT ERRORS</div>
                    {status.errors.map((e, i) => (
                      <div key={i} className="text-[8px] text-terminal-red/70 leading-snug">{e}</div>
                    ))}
                  </div>
                )}
                {/* Schedule note */}
                <div className="panel px-3 py-2 opacity-70">
                  <div className="text-[8px] text-terminal-dim leading-snug">
                    ⚡ Bot runs every 15 min via Vercel Cron.<br/>
                    Telegram alerts sent on Flash (≥75) and Analysis (≥52) scores.<br/>
                    30-min reminders fire before each market data release.
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="panel px-2.5 py-2 text-center">
      <div className={`text-[22px] font-bold leading-none tabular-nums ${color}`}>{value}</div>
      <div className="text-[7px] text-terminal-dim mt-1.5 font-['Orbitron'] tracking-wide">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, valueColor = 'text-terminal-bright' }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-terminal-dim">{label}</span>
      <span className={`text-[9px] font-semibold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}
