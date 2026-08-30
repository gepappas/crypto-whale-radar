import { useCallback, useEffect, useRef, useState } from 'react';
import { collectSignals, type LocalInputs } from '@/lib/regime/signals';
import { evaluate, rescore, getHistory } from '@/lib/regime/engine';
import { loadWeights, saveWeights, resetWeights } from '@/lib/regime/weights';
import { supabase } from '@/integrations/supabase/client';
import type { RegimeReading, RegimeSnapshot, RegimeWeights } from '@/lib/regime/types';

async function loadLearnedAdjustments(): Promise<Record<string, number>> {
  const { data } = await supabase.from('signal_weight_performance').select('signal_family, learned_adjustment');
  return Object.fromEntries((data ?? []).map((row) => [row.signal_family, Number(row.learned_adjustment) || 0]));
}

async function loadPersistedRegime(): Promise<RegimeReading | null> {
  const { data, error } = await supabase
    .from('regime_state')
    .select('score, regime, tier, held_snapshots, agreeing, active, reading, ts')
    .eq('market', 'global')
    .maybeSingle();
  if (error || !data) return null;
  const payload = (data.reading ?? {}) as Record<string, unknown>;
  return {
    ...payload,
    ts: Date.parse(data.ts),
    score: Number(data.score),
    regime: data.regime,
    tier: data.tier,
    confirmedRegime: data.tier === 'confirmed' ? data.regime : null,
    heldSnapshots: Number(data.held_snapshots),
    agreeing: Number(data.agreeing),
    active: Number(data.active),
    reasons: ['Server-side regime worker reading.'],
  } as unknown as RegimeReading;
}

const POLL_MS = 5 * 60_000; // one tick per 5 minutes — the shortest persistence horizon

export function useRegimeEngine(local: LocalInputs, enabled = true) {
  const [reading, setReading] = useState<RegimeReading | null>(null);
  const [history, setHistory] = useState<RegimeSnapshot[]>(() => getHistory());
  const [weights, setWeightsState] = useState<RegimeWeights>(() => loadWeights());
  const [loading, setLoading] = useState(false);

  // Latest local inputs without re-triggering the poll loop on every tick of
  // the whale feed (it updates several times per second).
  const localRef = useRef(local);
  localRef.current = local;
  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      // Refresh the durable server-side reading first. If the worker or its
      // upstream provider is temporarily unavailable, keep the local engine
      // as a graceful fallback for the current browser session.
      const { error: workerError } = await supabase.functions.invoke('regime-worker');
      if (workerError) console.warn('[v0] regime worker unavailable; using local fallback', workerError);
      const learned = await loadLearnedAdjustments();
      const persisted = await loadPersistedRegime();
      if (persisted) {
        setReading(persisted);
        const { data } = await supabase.from('regime_history').select('ts, score, regime, reading').eq('market', 'global').order('ts', { ascending: true }).limit(400);
        if (data?.length) setHistory(data.map((row) => {
          const reading = (row.reading ?? {}) as Record<string, unknown>;
          return { ts: Date.parse(row.ts), score: Number(row.score), regime: row.regime, agreeing: Number(reading.agreeing ?? 0), active: Number(reading.active ?? 0), signals: [] };
        }));
      } else {
        const signals = await collectSignals(localRef.current);
        const adjusted = { ...weightsRef.current };
        for (const signal of signals) {
          const family = signal.id.includes('trend') || signal.id.includes('momentum') ? 'trend' : signal.id.includes('funding') || signal.id.includes('oi') ? 'derivatives' : signal.id.includes('flow') || signal.id.includes('whale') ? 'flow' : signal.id.includes('fng') || signal.id.includes('sentiment') ? 'sentiment' : 'breadth';
          adjusted[signal.id] = Math.max(0, Math.min(30, adjusted[signal.id] * (1 + (learned[family] ?? 0))));
        }
        setReading(evaluate(signals, adjusted));
        setHistory(getHistory());
      }
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void run();
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, run]);

  /** Weight changes rescore the current signals immediately — no refetch, so
   *  tuning stays interactive and doesn't hammer upstream APIs. Uses
   *  rescore(), not evaluate(): a slider fires onChange per pixel dragged,
   *  and evaluate() persists every call it's given — that would flood the
   *  history with entries sharing stale signal data on every drag, which
   *  corrupts the persistence/confirmation count these readings feed. Only
   *  the real polling tick in run() above should ever persist a reading. */
  const setWeights = useCallback((next: RegimeWeights) => {
    setWeightsState(next);
    saveWeights(next);
    weightsRef.current = next;
    setReading((prev) => (prev ? rescore(prev.signals, next) : prev));
  }, []);

  const restoreDefaults = useCallback(() => {
    const defaults = resetWeights();
    setWeights(defaults);
  }, [setWeights]);

  return { reading, history, weights, setWeights, restoreDefaults, loading, refresh: run };
}
