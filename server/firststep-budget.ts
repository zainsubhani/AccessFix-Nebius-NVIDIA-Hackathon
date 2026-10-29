import { neon } from '@neondatabase/serverless';

export const COACH_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
export const COACH_RESERVATION_CENTS = 5;
export const COACH_BUDGET_ID = 'firststep-2026';
export interface CoachBudget {
  remaining(): Promise<number>;
  reserve(): Promise<number | null>;
}
type Query = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

// One conditional UPDATE is the cross-process lock. Missing rows and failed reads
// deny inference; neither a restart nor an uncertain response refunds a reservation.
export function createPostgresCoachBudget(query: Query): CoachBudget {
  return {
    async remaining() {
      const rows = await query('SELECT FLOOR((limit_cents - reserved_cents) / $1)::int AS remaining FROM firststep_coach_budget WHERE id = $2 AND model = $3 AND expires_at > NOW()', [COACH_RESERVATION_CENTS, COACH_BUDGET_ID, COACH_MODEL]);
      return Number(rows[0]?.remaining || 0);
    },
    async reserve() {
      const rows = await query('UPDATE firststep_coach_budget SET reserved_cents = reserved_cents + $1, updated_at = NOW() WHERE id = $2 AND model = $3 AND expires_at > NOW() AND reserved_cents + $1 <= limit_cents RETURNING FLOOR((limit_cents - reserved_cents) / $1)::int AS remaining', [COACH_RESERVATION_CENTS, COACH_BUDGET_ID, COACH_MODEL]);
      return rows.length ? Number(rows[0].remaining) : null;
    },
  };
}

export function neonCoachBudget(connectionString: string) {
  const sql = neon(connectionString);
  return createPostgresCoachBudget((text, params) => sql.query(text, params, { fetchOptions: { signal: AbortSignal.timeout(10_000) } }));
}
