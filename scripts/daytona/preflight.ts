import { createClient, windowsSnapshot } from './common.js';

async function main() {
  const daytona = createClient();
  const sandboxes = [];
  for await (const sandbox of daytona.list({ labels: { project: 'daytona-cross-platform-desktop-demo' } })) {
    sandboxes.push({ id: sandbox.id, name: sandbox.name, state: sandbox.state, snapshot: sandbox.snapshot });
  }
  console.log(JSON.stringify({
    ok: true,
    apiUrl: process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
    target: process.env.DAYTONA_TARGET || 'us',
    requestedSnapshot: windowsSnapshot,
    managedSandboxes: sandboxes
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

