import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Fixture, FixtureId } from '../shared/types.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.ACCESSFIX_DATA_DIR || path.join(ROOT, '.accessfix'));
export const RUNS_DIR = path.join(DATA_DIR, 'runs');
export const fixtures: Fixture[] = [
  { id: 'signup', name: 'React signup', description: 'Keyboard and form-label barriers', file: 'examples/signup/Signup.tsx' },
  { id: 'team', name: 'Team invitation', description: 'Validation feedback and focus barriers', file: 'examples/team/Signup.tsx' },
  { id: 'healthy', name: 'Working signup', description: 'A passing baseline; no patch needed', file: 'examples/healthy/Signup.tsx' },
];
export function getFixture(id: string) { return fixtures.find(item => item.id === id); }
export function fixtureSource(id: FixtureId) { return readFileSync(path.join(ROOT, getFixture(id)!.file), 'utf8'); }
export function providerConfig() {
  // Read on each request so saving .env is enough. Process env takes precedence.
  let local: Record<string, string> = {};
  try { local = dotenv.parse(readFileSync(path.join(ROOT, '.env'))); } catch { /* Optional local configuration. */ }
  const value = (key: string) => process.env[key] ?? local[key];
  const baseUrl = value('NEBIUS_BASE_URL') || 'https://api.tokenfactory.us-central1.nebius.com/v1';
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' || !(parsed.hostname === 'nebius.com' || parsed.hostname.endsWith('.nebius.com'))) {
    throw new Error('NEBIUS_BASE_URL must be an HTTPS endpoint on nebius.com.');
  }
  const model = value('NEBIUS_MODEL') || 'nvidia/nemotron-3-super-120b-a12b';
  if (!model.toLowerCase().startsWith('nvidia/')) throw new Error('Choose an NVIDIA model for this hackathon build.');
  return { apiKey: value('NEBIUS_API_KEY')?.trim() || '', baseUrl: baseUrl.replace(/\/$/, ''), model };
}
