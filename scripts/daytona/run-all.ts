import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { artifactDir, createClient, getOrCreateWindowsSandbox, resolveRemoteRoot, safeDelete, uploadProject, writeExperiment } from './common.js';
import { installAndPrepare, runComputerUseExperiment, runPlaywrightExperiment, runTerminalExperiment, runTryCuaExperiment } from './experiments.js';

async function main() {
  const daytona = createClient();
  const { sandbox, created } = await getOrCreateWindowsSandbox(daytona);
  const results = [];
  try {
    const remoteRoot = await resolveRemoteRoot(sandbox);
    await uploadProject(sandbox, remoteRoot);
    await installAndPrepare(sandbox, remoteRoot);

    for (const [fileName, run] of [
      ['terminal-result.json', () => runTerminalExperiment(sandbox, remoteRoot)],
      ['playwright-result.json', () => runPlaywrightExperiment(sandbox, remoteRoot)],
      ['computer-use-result.json', () => runComputerUseExperiment(sandbox, remoteRoot)],
      ['trycua-result.json', () => runTryCuaExperiment(sandbox, remoteRoot)]
    ] as const) {
      const result = await run();
      results.push(result);
      await writeExperiment(fileName, result);
      console.log(`[result] ${result.approach}: ${result.status}`);
    }

    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, 'run-summary.json'), `${JSON.stringify({
      sandbox: { id: sandbox.id, name: sandbox.name, snapshot: sandbox.snapshot, created },
      generatedAt: new Date().toISOString(),
      results
    }, null, 2)}\n`, 'utf8');
  } finally {
    await safeDelete(daytona, sandbox);
  }

  if (results.some((result) => result.status === 'failed')) process.exitCode = 1;
  else if (results.some((result) => result.status === 'partial')) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

