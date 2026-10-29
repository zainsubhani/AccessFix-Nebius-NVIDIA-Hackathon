import { missions, type MissionId, type PracticeRun } from '../../shared/firststep';
import { exampleCases, type Attempt, type CustomRun } from './evidence';

export interface MissionProgress { source: string; notes: string; viewed: string[]; hints: number; attempts: number; baseline: PracticeRun | null; review: PracticeRun | null; history: Attempt[]; customDraft: string; customRun: CustomRun | null; }
export interface PracticeSession { version: 1; updatedAt: number; current: MissionId; progress: Record<MissionId, MissionProgress>; }
const KEY = 'firststep.practice.v1';
const blank = (id: MissionId): MissionProgress => ({ source: missions[id].starter, notes: '', viewed: [], hints: 0, attempts: 0, baseline: null, review: null, history: [], customDraft: exampleCases(id), customRun: null });
export const newSession = (): PracticeSession => ({ version: 1, updatedAt: Date.now(), current: 'checkout', progress: { checkout: blank('checkout'), reservation: blank('reservation') } });
export function readSession(): { session: PracticeSession; restored: boolean; warning: string } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { session: newSession(), restored: false, warning: '' };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Number.isFinite(data.updatedAt) || Date.now() - data.updatedAt > 86_400_000) throw new Error('Expired draft');
    const session = newSession();
    for (const id of ['checkout', 'reservation'] as const) {
      const value = data.progress?.[id];
      if (!value || typeof value.source !== 'string' || value.source.length > 6000 || typeof value.notes !== 'string' || value.notes.length > 2000) throw new Error('Invalid draft');
      session.progress[id] = {
        ...blank(id), source: value.source, notes: value.notes,
        viewed: Array.isArray(value.viewed) ? missions[id].artifacts.filter(a => value.viewed.includes(a.id)).map(a => a.id) : [],
        hints: Number.isInteger(value.hints) ? Math.max(0, Math.min(missions[id].hints.length, value.hints)) : 0,
        attempts: Number.isInteger(value.attempts) ? Math.max(0, Math.min(9999, value.attempts)) : 0,
        customDraft: typeof value.customDraft === 'string' && value.customDraft.length <= 6000 ? value.customDraft : exampleCases(id),
      };
    }
    // Restore drafts, never trust browser storage as evidence of passing checks.
    session.current = 'checkout';
    return { session, restored: true, warning: '' };
  } catch { return { session: newSession(), restored: false, warning: 'Previous progress could not be restored. This session starts with the original code.' }; }
}
export function saveSession(session: PracticeSession): boolean {
  // Persist drafts only: passing evidence and potentially large history belong to this page.
  const drafts = Object.fromEntries(Object.entries(session.progress).map(([id, progress]) => [id, { ...progress, baseline: null, review: null, history: [], customRun: null }]));
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...session, progress: drafts, updatedAt: Date.now() })); return true; } catch { return false; }
}
