import SignalsTerminal from '@/components/SignalsTerminal';

export const revalidate = 30;

export default function SignalsV2Page() {
  return (
    <div className="h-screen flex flex-col bg-terminal-bg overflow-hidden font-mono">
      {/* Header */}
      <div className="shrink-0 h-12 border-b border-terminal-border bg-terminal-panel flex items-center px-6 gap-4">
        <h1 className="text-[13px] font-['Orbitron'] font-bold tracking-wider text-terminal-bright">
          TRADING SIGNALS TERMINAL
        </h1>
        <div className="ml-auto text-[9px] text-terminal-dim">
          <span>Live • Real-time Analysis • 200+ Assets</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <SignalsTerminal />
      </div>

      {/* Footer */}
      <div className="shrink-0 h-7 border-t border-terminal-border bg-terminal-panel flex items-center px-6 gap-4 text-[8px] text-terminal-dim">
        <span>BUY = Bullish • SELL = Bearish • HOLD = Neutral</span>
        <div className="h-3 w-px bg-terminal-border" />
        <span>Confidence Score: 50-100%</span>
        <div className="h-3 w-px bg-terminal-border" />
        <a href="/" className="hover:text-terminal-blue transition-colors">← HOME</a>
      </div>
    </div>
  );
}
