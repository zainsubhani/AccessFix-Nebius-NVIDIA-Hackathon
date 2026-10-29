import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeEnvironment } from '../server/judge-config.js';
import { deploymentConfig } from '../server/deployment.js';
import { githubConfig } from '../server/github-export.js';

const credentials = { username: 'judge', password: 'private-test-password-at-least-24-characters' };
test('judge worker overrides inherited inference and repository-write settings', () => {
  const env = judgeEnvironment('https://private-worker.example', 3015, credentials, '/tmp/accessfix-judge-test', {
    NEBIUS_API_KEY: 'must-never-reach-worker', ACCESSFIX_MODEL_REQUEST_LIMIT: '100', ACCESSFIX_MODE: 'local',
    HOST: '0.0.0.0', ACCESSFIX_GITHUB_REPO: 'owner/repository', ACCESSFIX_GITHUB_TOKEN: 'must-not-be-shared',
    GH_TOKEN: 'inherited-gh-token', GITHUB_TOKEN: 'inherited-github-token', ACCESSFIX_RUNS_PER_HOUR: '100',
  });
  assert.equal(env.NEBIUS_API_KEY, ''); assert.equal(env.ACCESSFIX_GITHUB_TOKEN, ''); assert.equal(env.GH_TOKEN, ''); assert.equal(env.GITHUB_TOKEN, '');
  const deployment = deploymentConfig(env);
  assert.equal(deployment.hosted, true); assert.equal(deployment.host, '127.0.0.1'); assert.equal(deployment.modelRequestLimit, 0);
  assert.equal(deployment.ephemeral, false); assert.equal(deployment.runsPerHour, 20); assert.equal(deployment.executionProfile, 'local');
  assert.equal(githubConfig(env).enabled, false);
});
test('judge worker rejects invalid public origins, weak credentials and unsafe ports', () => {
  for (const origin of ['http://worker.example', 'https://user:pass@worker.example', 'https://worker.example/path']) assert.throws(() => judgeEnvironment(origin, 3015, credentials, '/tmp/accessfix-judge-test', {}));
  for (const port of [80, 0, 65536, NaN, 3015.5]) assert.throws(() => judgeEnvironment('https://worker.example', port, credentials, '/tmp/accessfix-judge-test', {}));
  assert.throws(() => judgeEnvironment('https://worker.example', 3015, { username: 'judge', password: 'short' }, '/tmp/accessfix-judge-test', {}));
});
