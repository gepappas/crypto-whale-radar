import type { RegimeReading } from '@/lib/regime/types';

interface EarlyWarningBriefProps {
  reading: RegimeReading | null;
  loading: boolean;
  lastAlert?: string;
  whaleCount: number;
  dataSource: string;
  lastScanTs: number | null;
}

function ageLabel(ts: number | null) {
  if (!ts) return 'WAITING FOR FIRST READING';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s AGO`;
  return `${Math.round(seconds / 60)}m AGO`;
}

export function EarlyWarningBrief({ reading, loading, lastAlert, whaleCount, dataSource, lastScanTs }: EarlyWarningBriefProps) {
  const direction = reading?.score == null ? 'STANDBY' : reading.score >= 58 ? 'RISK-ON' : reading.score <= 42 ? 'RISK-OFF' : 'MIXED';
  const directionClass = direction === 'RISK-ON' ? 'text-wr-green' : direction === 'RISK-OFF' ? 'text-wr-red' : 'text-wr-amber';

  return (
    <section aria-label="Early warning brief" className="border-b border-wr-border bg-wr-bg2 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[8px] tracking-[0.28em] text-wr-muted">EARLY-WARNING COMMAND CENTER</p>
          <h1 className="font-head text-base tracking-widest text-wr-white">WHAT CHANGED</h1>
        </div>
        <span className={`text-[9px] tracking-widest border border-wr-border px-2 py-1 ${directionClass}`}>
          {loading ? 'READING…' : direction}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="border border-wr-border/70 bg-wr-bg3 p-2">
          <div className="text-[8px] tracking-widest text-wr-muted">REGIME</div>
          <div className="mt-1 text-[11px] text-wr-white truncate">{reading?.regime ?? '—'}</div>
        </div>
        <div className="border border-wr-border/70 bg-wr-bg3 p-2">
          <div className="text-[8px] tracking-widest text-wr-muted">CONFIDENCE</div>
          <div className="mt-1 text-[11px] text-wr-cyan">{reading ? `${reading.score}/100` : '—'}</div>
        </div>
        <div className="border border-wr-border/70 bg-wr-bg3 p-2">
          <div className="text-[8px] tracking-widest text-wr-muted">BREADTH</div>
          <div className="mt-1 text-[11px] text-wr-cyan">{reading ? `${reading.agreeing}/${reading.active}` : '—'}</div>
        </div>
        <div className="border border-wr-border/70 bg-wr-bg3 p-2">
          <div className="text-[8px] tracking-widest text-wr-muted">WHALE EVENTS</div>
          <div className="mt-1 text-[11px] text-wr-white">{whaleCount}</div>
        </div>
        <div className="border border-wr-border/70 bg-wr-bg3 p-2 col-span-2 md:col-span-1">
          <div className="text-[8px] tracking-widest text-wr-muted">FRESHNESS</div>
          <div className="mt-1 text-[11px] text-wr-white">{ageLabel(reading?.ts ?? lastScanTs)}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] tracking-widest text-wr-muted">
        <span>LAST ALERT: <b className="font-normal text-wr-amber">{lastAlert ?? 'NONE RECORDED'}</b></span>
        <span>SOURCE: <b className="font-normal text-wr-cyan">{dataSource.toUpperCase()}</b></span>
        <span className="text-wr-muted/70">DECISION SUPPORT ONLY · NO AUTO-EXECUTION</span>
      </div>
    </section>
  );
}
