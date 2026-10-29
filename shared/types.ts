export type ComponentContract = 'signup' | 'login' | 'dialog' | 'navigation';
export type FixtureId = 'signup' | 'team' | 'healthy' | 'login' | 'dialog' | 'navigation';
export type RunMode = 'audit' | 'repair' | 'verify-good' | 'verify-regression' | 'verify-recorded';
export type ExecutionProfile = 'local' | 'free-demo';
export type RunState = 'queued' | 'auditing' | 'proposing' | 'verifying' | 'audited' | 'accepted' | 'rejected' | 'unresolved' | 'clean' | 'error' | 'cancelled';
export const ACTIVE_STATES: RunState[] = ['queued', 'auditing', 'proposing', 'verifying'];
export interface Fixture { id: FixtureId; name: string; description: string; file: string; contract: ComponentContract; }
export interface Check { id: string; name: string; passed: boolean; detail: string; category: 'accessibility' | 'regression'; }
export interface Violation { id: string; impact: string; description: string; helpUrl: string; nodes: string[]; }
export interface FocusStep { action: string; target: string; screenshot: string; rect?: { x: number; y: number; width: number; height: number }; }
export interface FocusTrace { width: number; height: number; steps: FocusStep[]; complete: boolean; }
export interface Evidence { checks: Check[]; violations: Violation[]; screenshot: string; durationMs: number; consoleErrors: string[]; focusTrace?: FocusTrace; }
export interface RunEvent { at: string; stage: RunState; message: string; }
export interface RepairDiagnostic { code: 'changed-validation-regex' | 'unattached-ref' | 'render-state-focus'; message: string; line?: number; }
export interface Attempt { number: number; rationale: string; source: string; patch: string; evidence?: Evidence; error?: string; accepted: boolean; regressions: string[]; diagnostics?: RepairDiagnostic[]; }
export interface Usage { inputTokens: number; outputTokens: number; requests: number; latencyMs: number; }
export interface Run {
  id: string; fixture: string; fixtureName: string; file: string; mode: RunMode; state: RunState;
  createdAt: string; finishedAt?: string; events: RunEvent[];
  baseline?: Evidence; attempts: Attempt[]; summary: string; error?: string;
  source: string; sourceHash: string; contractHash: string; model?: string; usage: Usage;
  humanChecks: string[];
  recordedDemo?: boolean;
  executionProfile?: ExecutionProfile;
  contract?: ComponentContract;
  replayedFrom?: string;
}
export interface Config { providerConfigured: boolean; model: string; fixtures: Fixture[]; maxAttempts: number; activeRunId?: string; hostedDemo?: boolean; ephemeralStorage?: boolean; repairAvailable?: boolean; repairUnavailableReason?: string; modelRequestsRemaining?: number; }
export interface SignupPayload { email: string; password: string; terms: boolean; }
