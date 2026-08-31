export type AiExecutionMode = "disabled" | "shadow" | "live";
export type AiAuditAction = "requested" | "approved" | "rejected" | "blocked" | "executed";

export interface AiExecutionIntent {
  source: string;
  pair?: string;
  side?: string;
  quantity?: number;
  rationale?: string;
  riskSnapshot?: Record<string, unknown>;
}

export interface AiSafetyConfig {
  mode: AiExecutionMode;
  humanApprovalRequired: boolean;
  maxNotionalUsd: number;
  cooldownSeconds: number;
}

export interface PendingAiIntent extends AiExecutionIntent {
  id: string;
  createdAt: number;
  status: "pending";
}

const CONFIG_KEY = "nexus_ai_safety_v1";
const AUDIT_KEY = "nexus_ai_audit_v1";
export const DEFAULT_AI_SAFETY_CONFIG: AiSafetyConfig = {
  mode: "disabled",
  humanApprovalRequired: true,
  maxNotionalUsd: 250,
  cooldownSeconds: 60,
};

function readConfig(): AiSafetyConfig {
  if (typeof window === "undefined") return DEFAULT_AI_SAFETY_CONFIG;
  try {
    return { ...DEFAULT_AI_SAFETY_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") };
  } catch { return DEFAULT_AI_SAFETY_CONFIG; }
}

export function getAiSafetyConfig(): AiSafetyConfig { return readConfig(); }
export function setAiSafetyConfig(config: AiSafetyConfig): void {
  if (typeof window === "undefined") return;
  const safeConfig: AiSafetyConfig = {
    ...DEFAULT_AI_SAFETY_CONFIG,
    ...config,
    maxNotionalUsd: Math.max(0, Number(config.maxNotionalUsd) || 0),
    cooldownSeconds: Math.max(0, Number(config.cooldownSeconds) || 0),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
  window.dispatchEvent(new CustomEvent("nexus:ai-safety:changed"));
}

export function auditAiExecution(action: AiAuditAction, intent: AiExecutionIntent, reason?: string): void {
  if (typeof window === "undefined") return;
  try {
    const rows = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]") as unknown[];
    rows.push({ id: crypto.randomUUID(), action, mode: readConfig().mode, ...intent, reason, createdAt: Date.now() });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(rows.slice(-200)));
  } catch { /* fail closed without breaking the caller */ }
}

export function getAiExecutionAudit(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); } catch { return []; }
}

const PENDING_KEY = "nexus_ai_pending_v1";

function readPending(): PendingAiIntent[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}
function writePending(items: PendingAiIntent[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(-50)));
  window.dispatchEvent(new CustomEvent("nexus:ai-safety:changed"));
}
export function getPendingAiIntents(): PendingAiIntent[] { return readPending(); }

export function requestAiExecution(intent: AiExecutionIntent): { allowed: boolean; requiresApproval: boolean; reason?: string; intentId?: string } {
  const config = readConfig();
  auditAiExecution("requested", intent);
  if (config.mode === "disabled") {
    auditAiExecution("blocked", intent, "AI execution is disabled");
    return { allowed: false, requiresApproval: false, reason: "AI execution is disabled" };
  }
  if (typeof intent.quantity === "number" && intent.quantity > config.maxNotionalUsd) {
    auditAiExecution("blocked", intent, `Notional exceeds $${config.maxNotionalUsd} AI cap`);
    return { allowed: false, requiresApproval: false, reason: `Notional exceeds $${config.maxNotionalUsd} AI cap` };
  }
  if (config.mode === "shadow") {
    auditAiExecution("blocked", intent, "Shadow mode records intent but never places orders");
    return { allowed: false, requiresApproval: false, reason: "Shadow mode: intent recorded, no order placed" };
  }
  const lastRequest = getAiExecutionAudit().reverse().find((row) =>
    row.action === "executed" && row.source === intent.source && row.pair === intent.pair,
  );
  if (lastRequest && config.cooldownSeconds > 0 && Date.now() - Number(lastRequest.createdAt) < config.cooldownSeconds * 1000) {
    const reason = `AI cooldown active for ${config.cooldownSeconds}s`;
    auditAiExecution("blocked", intent, reason);
    return { allowed: false, requiresApproval: false, reason };
  }
  if (!config.humanApprovalRequired) return { allowed: true, requiresApproval: false };
  const queued: PendingAiIntent = { ...intent, id: crypto.randomUUID(), createdAt: Date.now(), status: "pending" };
  writePending([...readPending(), queued]);
  return { allowed: false, requiresApproval: true, reason: "Awaiting human approval", intentId: queued.id };
}

export function approveAiExecution(id: string): AiExecutionIntent | null {
  if (readConfig().mode !== "live") return null;
  const pending = readPending();
  const item = pending.find((entry) => entry.id === id);
  if (!item) return null;
  writePending(pending.filter((entry) => entry.id !== id));
  auditAiExecution("approved", item);
  return item;
}

export function markAiExecutionExecuted(intent: AiExecutionIntent): void {
  auditAiExecution("executed", intent);
}

export function rejectAiExecution(id: string, reason = "Rejected by operator"): boolean {
  const pending = readPending();
  const item = pending.find((entry) => entry.id === id);
  if (!item) return false;
  writePending(pending.filter((entry) => entry.id !== id));
  auditAiExecution("rejected", item, reason);
  return true;
}
