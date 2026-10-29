import path from 'node:path';
import { deploymentConfig } from './deployment.js';

export interface JudgeCredentials { username: string; password: string; }
export function judgeEnvironment(origin: string, port: number, credentials: JudgeCredentials, directory: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose an unprivileged port from 1024 to 65535.');
  if (!path.isAbsolute(directory)) throw new Error('Judge storage must be an absolute path.');
  const env: NodeJS.ProcessEnv = { ...inherited,
    ACCESSFIX_MODE: 'hosted', ACCESSFIX_JUDGE_WORKER: 'true', HOST: '127.0.0.1', PORT: String(port),
    ACCESSFIX_PUBLIC_ORIGIN: origin, ACCESSFIX_DATA_DIR: directory, ACCESSFIX_EPHEMERAL: 'false',
    ACCESSFIX_DEMO_USER: credentials.username, ACCESSFIX_DEMO_PASSWORD: credentials.password,
    ACCESSFIX_MODEL_REQUEST_LIMIT: '0', ACCESSFIX_RUNS_PER_HOUR: '20',
    NEBIUS_API_KEY: '', ACCESSFIX_GITHUB_REPO: '', ACCESSFIX_GITHUB_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '',
    ACCESSFIX_JUDGE_WORKER_URL: '',
  };
  deploymentConfig(env); // Validate authentication, binding and exact HTTPS origin before spawning.
  return env;
}
