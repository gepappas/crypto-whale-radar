import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)));
    if (!response.ok) throw new Error(`Binance returned ${response.status}`);
    const tickers = await response.json();
    const changes = tickers.map((ticker: { priceChangePercent: string }) => Number(ticker.priceChangePercent)).filter(Number.isFinite);
    const avg = changes.reduce((sum: number, value: number) => sum + value, 0) / Math.max(changes.length, 1);
    const score = Math.max(0, Math.min(100, 50 + avg * 4));
    const regime = score < 25 ? "BEAR" : score < 42 ? "RECOVERY" : score < 58 ? "NEUTRAL" : score < 75 ? "EARLY BULL" : "BULL";
    const { data: previous } = await db.from("regime_state").select("held_snapshots, regime").eq("market", "global").maybeSingle();
    const held = previous?.regime === regime ? (previous.held_snapshots ?? 0) + 1 : 1;
    const tier = held >= 96 ? "confirmed" : held >= 12 ? "developing" : held >= 3 ? "early" : null;
    const reading = { score, regime, tier, heldSnapshots: held, agreeing: changes.filter((v: number) => (score >= 50 ? v >= 0 : v < 0)).length, active: changes.length, changes, timestamp: Date.now() };
    await db.from("regime_state").upsert({ market: "global", score, regime, tier, held_snapshots: held, agreeing: reading.agreeing, active: reading.active, reading, ts: new Date().toISOString(), updated_at: new Date().toISOString() });
    await db.from("regime_history").insert({ market: "global", score, regime, tier, held_snapshots: held, reading, ts: new Date().toISOString() });
    return new Response(JSON.stringify({ reading }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "worker failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
