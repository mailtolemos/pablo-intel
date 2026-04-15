'use client';
import { useEffect, useState, useCallback } from 'react';

interface NewsItem {
  id:          string;
  title:       string;
  summary:     string;
  url:         string;
  source:      string;
  publishedAt: string;
  category:    string;
  relevance:   number;
  minerals:    string[];
}

const CAT_COLOR: Record<string, string> = {
  gold:       'var(--amber)',
  silver:     '#c0c0c0',
  platinum:   '#e8e8ff',
  palladium:  '#b8d0ff',
  copper:     '#f87060',
  lithium:    'var(--green)',
  cobalt:     'var(--blue)',
  nickel:     '#a0c0e0',
  uranium:    '#80ff80',
  rare_earth: 'var(--red)',
  general:    'var(--dim)',
};

const CAT_LABEL: Record<string, string> = {
  gold: 'GOLD', silver: 'SILVER', platinum: 'PLATINUM', palladium: 'PALLADIUM',
  copper: 'COPPER', lithium: 'LITHIUM', cobalt: 'COBALT', nickel: 'NICKEL',
  uranium: 'URANIUM', rare_earth: 'RARE EARTH', general: 'METALS',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FILTER_TABS = ['ALL', 'GOLD', 'SILVER', 'COPPER', 'PGM', 'BATTERY', 'RARE EARTH'] as const;
type FilterTab = typeof FILTER_TABS[number];

const TAB_CATEGORIES: Record<FilterTab, string[]> = {
  ALL:        [],
  GOLD:       ['gold'],
  SILVER:     ['silver'],
  COPPER:     ['copper'],
  PGM:        ['platinum', 'palladium'],
  BATTERY:    ['lithium', 'cobalt', 'nickel'],
  'RARE EARTH': ['rare_earth'],
};

export default function MineralsNewsFeed() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterTab>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      const r = await fetch('/api/minerals-news');
      const d = await r.json();
      setArticles(d.articles ?? []);
      setUpdatedAt(d.updatedAt ?? null);
    } catch { /* stale */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNews();
    const iv = setInterval(fetchNews, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchNews]);

  const filtered = articles.filter(a => {
    const cats = TAB_CATEGORIES[filter];
    if (cats.length === 0) return true;
    return a.minerals.some(m => cats.includes(m)) || cats.includes(a.category);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-terminal-panel">
      {/* Header */}
      <div className="section-header shrink-0">
        <div className="dot" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
        <span>MINERALS INTEL</span>
        <span className="ml-auto text-[8px] text-terminal-dim">
          {updatedAt ? timeAgo(updatedAt) : '—'}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 flex overflow-x-auto scrollbar-hide border-b border-terminal-border bg-terminal-surface">
        {FILTER_TABS.map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className="shrink-0 px-2.5 py-1.5 text-[7px] font-['Orbitron'] tracking-widest uppercase transition-colors whitespace-nowrap"
            style={{
              color:        filter === tab ? 'var(--amber)' : 'var(--dim)',
              borderBottom: filter === tab ? '1px solid var(--amber)' : 'none',
              background:   filter === tab ? 'rgba(255,179,0,0.06)' : 'transparent',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Articles */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse h-14 bg-terminal-muted rounded" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-[9px] text-terminal-dim">
            No articles found for this filter
          </div>
        ) : (
          <div className="divide-y divide-terminal-border">
            {filtered.map(a => {
              const isOpen = expanded === a.id;
              const cat    = a.minerals[0] || a.category;
              const color  = CAT_COLOR[cat] ?? 'var(--dim)';
              const label  = CAT_LABEL[cat] ?? 'METALS';

              return (
                <div key={a.id} className="px-3 py-2.5 hover:bg-terminal-surface/50 transition-colors cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : a.id)}>
                  <div className="flex items-start gap-2">
                    {/* Relevance bar */}
                    <div className="shrink-0 mt-0.5 w-0.5 rounded-full"
                      style={{
                        height: isOpen ? '100%' : '32px',
                        minHeight: '20px',
                        background: color,
                        opacity: 0.4 + a.relevance * 0.06,
                      }} />
                    <div className="flex-1 min-w-0">
                      {/* Category badge + time */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[7px] font-['Orbitron'] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color,
                            background: `${color}15`,
                            border: `1px solid ${color}30`,
                          }}>
                          {label}
                        </span>
                        {a.minerals.slice(1, 3).map(m => (
                          <span key={m} className="text-[7px] font-['Orbitron'] px-1 py-0.5 rounded"
                            style={{ color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            {CAT_LABEL[m] || m.toUpperCase()}
                          </span>
                        ))}
                        <span className="ml-auto text-[7px] text-terminal-dim shrink-0">{timeAgo(a.publishedAt)}</span>
                      </div>
                      {/* Title */}
                      <div className={`text-[9px] font-semibold text-terminal-bright leading-snug ${isOpen ? '' : 'line-clamp-2'}`}>
                        {a.title}
                      </div>
                      {/* Source */}
                      <div className="text-[7px] text-terminal-dim mt-0.5">{a.source}</div>
                      {/* Expanded summary */}
                      {isOpen && (
                        <div className="mt-1.5 space-y-1.5">
                          <p className="text-[8px] text-terminal-dim leading-snug">{a.summary}</p>
                          <a href={a.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[8px] font-['Orbitron']"
                            style={{ color: 'var(--amber)' }}
                            onClick={e => e.stopPropagation()}>
                            READ FULL ARTICLE →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
