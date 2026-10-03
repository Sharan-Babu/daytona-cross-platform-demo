import { createClient, getOrCreateWindowsSandbox, resolveRemoteRoot, safeDelete, uploadProject, writeExperiment } from './common.js';
import { installAndPrepare, runComputerUseExperiment, runPlaywrightExperiment, runTerminalExperiment, runTryCuaExperiment } from './experiments.js';

export type ExperimentName = 'terminal' | 'playwright' | 'computer-use' | 'trycua';

export async function runOne(name: ExperimentName) {
  const daytona = createClient();
  const { sandbox } = await getOrCreateWindowsSandbox(daytona);
  try {
    const remoteRoot = await resolveRemoteRoot(sandbox);
    await uploadProject(sandbox, remoteRoot);
    await installAndPrepare(sandbox, remoteRoot);
    const result = name === 'terminal'
      ? await runTerminalExperiment(sandbox, remoteRoot)
      : name === 'playwright'
        ? await runPlaywrightExperiment(sandbox, remoteRoot)
        : name === 'computer-use'
          ? await runComputerUseExperiment(sandbox, remoteRoot)
          : await runTryCuaExperiment(sandbox, remoteRoot);
    await writeExperiment(`${name}-result.json`, result);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'failed') process.exitCode = 1;
    else if (result.status === 'partial') process.exitCode = 2;
  } finally {
    await safeDelete(daytona, sandbox);
  }
}

