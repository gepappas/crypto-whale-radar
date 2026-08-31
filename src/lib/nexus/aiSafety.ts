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
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
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

export function requestAiExecution(intent: AiExecutionIntent): { allowed: boolean; requiresApproval: boolean; reason?: string } {
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
  return { allowed: true, requiresApproval: config.humanApprovalRequired };
}

export function approveAiExecution(intent: AiExecutionIntent): boolean {
  if (readConfig().mode !== "live") return false;
  auditAiExecution("approved", intent);
  return true;
}
