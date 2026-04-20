import type { CommodityPrice } from '@/lib/types';
import PriceStrip from '@/components/PriceStrip';
import SignalsDetailPanel from '@/components/SignalsDetailPanel';
import AssetSelector from '@/components/AssetSelector';
import SignalAnalysisPanel from '@/components/SignalAnalysisPanel';
import DecisionMatrix from '@/components/DecisionMatrix';

export const revalidate = 30;

async function getInitialPrices(): Promise<CommodityPrice[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const r = await fetch(`${baseUrl}/api/prices`, { cache: 'no-store' });
    const d = await r.json();
    return d.prices ?? [];
  } catch {
    return [];
  }
}

async function getSignals() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const r = await fetch(`${baseUrl}/api/signals`, { cache: 'no-store' });
    const d = await r.json();
    return d.signals ?? {};
  } catch {
    return {};
  }
}

const TICKER_ITEMS = [
  '⚡ LIVE SIGNALS ENGINE — Real-time trading analysis',
  '📊 RSI · MACD · Trend Analysis — Multi-indicator consensus',
  '🎯 BUY/SELL/HOLD · Confidence 50-100% — Data-driven decisions',
  '💰 Entry Zones · Target Prices · Stop Loss — Risk management built-in',
  '🔔 Updates every 60 seconds — Automated signal generation',
  '📈 Technical Analysis — Momentum · Trend · Volatility metrics',
  '⚠️ Disclaimer: Signals for informational purposes only · Not financial advice',
  '🌍 Supported: Crude Oil · Precious Metals · Cryptocurrencies · Indices',
];

const TICKER_STRING = TICKER_ITEMS.join('     ·     ');

export default async function SignalsPage() {
  const initialPrices = await getInitialPrices();
  const signals = await getSignals();

  return (
    <>
      {/* ── Mobile (< md) ───────────────────────────────── */}
      <div className="md:hidden p-4 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-[24px] font-['Orbitron'] font-bold text-terminal-bright">LIVE SIGNALS</h1>
          <p className="text-[11px] text-terminal-dim">Trading Analysis Terminal</p>
        </div>
        <SignalsDetailPanel signals={signals} isMobile />
      </div>

      {/* ── Desktop (≥ md) ──────────────────────────────── */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-terminal-bg transition-colors duration-300">

        {/* Price strip */}
        <div className="shrink-0 h-[62px] border-b border-terminal-border">
          <PriceStrip initialPrices={initialPrices} />
        </div>

        {/* Main 3-column grid */}
        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr_380px] overflow-hidden">

          {/* Left: Asset Selector */}
          <div className="panel border-r border-terminal-border overflow-hidden flex flex-col">
            <AssetSelector signals={signals} prices={initialPrices} />
          </div>

          {/* Center: Signal Analysis */}
          <div className="flex flex-col overflow-hidden border-r border-terminal-border">
            <div className="flex-[60] min-h-0 panel border-b border-terminal-border overflow-hidden">
              <SignalAnalysisPanel signals={signals} />
            </div>
            <div className="flex-[40] min-h-0 panel overflow-hidden">
              <SignalsDetailPanel signals={signals} />
            </div>
          </div>

          {/* Right: Decision Matrix & Info */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex-[50] min-h-0 panel border-b border-terminal-border overflow-hidden">
              <DecisionMatrix signals={signals} />
            </div>
            <div className="flex-[50] min-h-0 panel overflow-hidden">
              <div className="h-full flex flex-col p-3 text-[9px] text-terminal-dim space-y-2 overflow-y-auto">
                <div className="text-terminal-bright font-['Orbitron'] font-bold tracking-wider mb-2">INFO</div>
                <div className="space-y-1.5 text-[8px] leading-relaxed">
                  <div>
                    <strong className="text-terminal-blue">Signal Generation:</strong> Automated technical analysis from live market prices
                  </div>
                  <div>
                    <strong className="text-terminal-green">Confidence:</strong> 50-100% based on indicator consensus
                  </div>
                  <div>
                    <strong className="text-terminal-amber">Indicators:</strong> RSI, MACD, Moving Averages, Trend Analysis
                  </div>
                  <div>
                    <strong className="text-terminal-red">Timeframe:</strong> 1D (daily) — suitable for swing trading
                  </div>
                  <div className="pt-2 border-t border-terminal-border/50">
                    <strong className="text-terminal-red">⚠️ Disclaimer:</strong> These signals are for informational purposes only and do not constitute financial advice. Trading carries risk of loss.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom ticker */}
        <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-surface flex items-center overflow-hidden">
          <div className="shrink-0 px-3 border-r border-terminal-border h-full flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
            <span className="text-[9px] font-['Orbitron'] text-terminal-green font-bold tracking-wider">LIVE</span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div className="ticker-text text-[10px] text-terminal-text font-medium">
              {TICKER_STRING}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{TICKER_STRING}
            </div>
          </div>
          <div className="shrink-0 px-3 border-l border-terminal-border h-full flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
              <span className="text-[7px] font-['Orbitron'] font-bold" style={{ color: 'var(--green)' }}>PYTH</span>
              <span className="text-[7px] text-terminal-dim font-['Orbitron']">LIVE DATA</span>
            </div>
            <div className="h-3 w-px bg-terminal-border" />
            <a href="/" className="text-[8px] font-['Orbitron'] text-terminal-dim hover:text-terminal-blue transition-colors tracking-wider">
              ← HOME
            </a>
            <span className="text-[9px] text-terminal-dim font-['Orbitron'] tracking-wider">LIVE SIGNALS</span>
          </div>
        </div>
      </div>
    </>
  );
}
