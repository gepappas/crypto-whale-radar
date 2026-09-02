export type BridgeProtocol = 'ARBITRUM' | 'LAYERZERO' | 'WORMHOLE';

export interface BridgeMatch {
  protocol: BridgeProtocol;
  direction: 'inbound' | 'outbound' | 'unknown';
  confidence: 'known-contract' | 'heuristic';
}

const BRIDGE_PATTERNS: Array<[BridgeProtocol, RegExp]> = [
  ['ARBITRUM', /arbitrum|arb1|l1gateway|l2gateway/i],
  ['LAYERZERO', /layerzero|lzendpoint|stargate/i],
  ['WORMHOLE', /wormhole|portalbridge|tokenbridge/i],
];

/** Classifies bridge labels or known contract metadata without inventing chain events. */
export function classifyBridge(value: string | null | undefined): BridgeMatch | null {
  if (!value) return null;
  const match = BRIDGE_PATTERNS.find(([, pattern]) => pattern.test(value));
  if (!match) return null;
  const direction = /inbound|deposit|receive|mint/i.test(value)
    ? 'inbound'
    : /outbound|withdraw|send|burn/i.test(value)
      ? 'outbound'
      : 'unknown';
  return { protocol: match[0], direction, confidence: 'heuristic' };
}

export function bridgeDisplayName(protocol: BridgeProtocol): string {
  return { ARBITRUM: 'Arbitrum Bridge', LAYERZERO: 'LayerZero', WORMHOLE: 'Wormhole' }[protocol];
}
