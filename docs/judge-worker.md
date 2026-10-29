# Private Mac judge worker

The Mac worker runs fresh Chromium audits and verification exercises on a developer machine while the free Render demo remains the stable entry point. It uses the same six fixed public fixtures, shared password authentication and one-run concurrency limit. **Inference and GitHub writes are always disabled by this launcher**, even if the developer's shell or `.env` contains credentials.

## Start the worker

Install dependencies, Chromium and the production UI:

```sh
npm ci
npm run browsers
npm run build
```

Install the official [Cloudflare tunnel binary](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). Put `cloudflared` on your PATH, pass `--cloudflared /absolute/path/to/cloudflared`, or store it in the ignored `.accessfix/tools/` directory. Verify a downloaded release against the digest published by the official Cloudflare GitHub release.

```sh
npm run judge -- --tunnel --keep-awake
```

The launcher reserves loopback port 3015, starts a Cloudflare Quick Tunnel, then starts the authenticated worker. It checks that the application has no provider key and a zero model budget before reporting readiness. `--keep-awake` uses macOS `caffeinate` to prevent idle system sleep only while the launcher is running; it does not change system settings or prevent sleep caused by closing the laptop lid.

A private `.accessfix/judge/access.json` file contains the current HTTPS URL, username and password. Share these only through private judge testing instructions. The file and its parent directory have restrictive local permissions and are ignored by Git. The terminal prints the URL and the credential-file location, never the password.

For an existing tunnel with a stable hostname:

```sh
npm run judge -- --origin https://your-worker.example --keep-awake
```

Configure that external tunnel to forward only `http://127.0.0.1:3015`. A different unprivileged port can be selected with `--port`. The launcher always binds the application to loopback; it does not expose the Mac's development server, filesystem or arbitrary component uploads.

## Judge workflow

1. Open the worker HTTPS URL and enter the privately supplied credentials.
2. Select a fixture and run an audit. Actual Chromium checks run on the Mac.
3. Use the verification lab to inspect good and regressing prepared candidates, or replay the original NVIDIA/Nebius candidate with fresh keyboard traces.
4. Review before/candidate checks, keyboard replay, diff and downloadable artifacts.

The UI identifies the private worker and disabled inference. Live repair remains unavailable. The launcher deliberately has no flag that enables spending; enabling live inference later requires a separately reviewed persistent-host configuration and an explicit budget.

## Availability and stopping

Keep the Mac powered, connected to the internet, awake and with this process running. Ctrl+C stops the worker, its tunnel and its keep-awake process. Quick Tunnels have no uptime guarantee and change hostname after each restart; they are for temporary testing, not permanent production hosting. See [Cloudflare's Quick Tunnel limits](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

The public Render URL remains the fallback when the Mac is offline. Do not promise continuous availability through the judging period from this temporary worker. Recheck the private credentials and current URL before sharing them.

Worker artifacts and the model-budget ledger persist under `.accessfix/judge/data`. Logs are local in `.accessfix/judge/worker.log` and `tunnel.log`. All judges share this workspace, a 20-runs-per-hour cap and the ability to cancel the active run. Runs are retained according to the same hosted cleanup policy.

Only one launcher may use this directory. If a crash leaves `worker.lock`, inspect the recorded PID and confirm that the process and its child server/tunnel have stopped before removing the stale lock. Do not remove an active lock or start a second worker against the same directory.
