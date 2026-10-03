import { Daytona, DaytonaNotFoundError, type Sandbox } from '@daytona/sdk';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptDir, '..', '..');
export const artifactDir = path.join(projectRoot, 'artifacts', 'live');
export const sandboxName = process.env.DAYTONA_SANDBOX_NAME || 'platform-pulse-windows-demo';
export const windowsSnapshot = process.env.DAYTONA_WINDOWS_SNAPSHOT || 'windows-small';

const uploadRoots = ['app', 'lib', 'tests', 'scripts/windows'];
const uploadFiles = ['package.json', 'package-lock.json', 'playwright.config.cjs'];

export type ExperimentResult = {
  approach: string;
  status: 'passed' | 'failed' | 'partial' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  details: Record<string, unknown>;
};

export function requireCredentials() {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error('DAYTONA_API_KEY is required. Export it in the shell; never place it in a project file.');
  }
}

export function createClient() {
  requireCredentials();
  return new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
    apiUrl: process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
    target: process.env.DAYTONA_TARGET || 'us'
  });
}

export const managedLabels = { project: 'daytona-cross-platform-desktop-demo', purpose: 'windows-electron-testing', managedBy: 'demo-script' };

export function assertManagedSandbox(sandbox: Sandbox) {
  if (!Object.entries(managedLabels).every(([key, value]) => sandbox.labels?.[key] === value)) {
    throw new Error('Refusing sandbox operation: expected managed ownership labels are missing.');
  }
}

export async function getOrCreateWindowsSandbox(daytona: Daytona) {
  try {
    const existing = await daytona.get(sandboxName);
    assertManagedSandbox(existing);
    if (existing.snapshot !== windowsSnapshot) {
      throw new Error(`Sandbox ${sandboxName} exists with snapshot ${existing.snapshot}; expected ${windowsSnapshot}.`);
    }
    if (existing.state !== 'started') await existing.start(180);
    console.log(`[sandbox] Reusing ${existing.name} (${existing.id})`);
    return { sandbox: existing, created: false };
  } catch (error) {
    if (!(error instanceof DaytonaNotFoundError)) throw error;
  }

  console.log(`[sandbox] Creating ${windowsSnapshot} as ${sandboxName}`);
  let sandbox: Sandbox | undefined;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      sandbox = await daytona.create({
        name: sandboxName,
        snapshot: windowsSnapshot,
        labels: managedLabels,
        autoStopInterval: 15,
        autoArchiveInterval: 60,
        autoDeleteInterval: 60
      }, { timeout: 180 });
      break;
    } catch (error) {
      if (!/No available runners/i.test(error instanceof Error ? error.message : String(error)) || attempt === 6) throw error;
      console.warn(`[sandbox] No Windows runner available (attempt ${attempt}/6); retrying in 10 seconds`);
      await delay(10_000);
    }
  }
  if (!sandbox) throw new Error('Daytona did not return a sandbox after capacity retries.');
  console.log(`[sandbox] Started ${sandbox.name} (${sandbox.id})`);
  return { sandbox, created: true };
}

export async function safeDelete(daytona: Daytona, sandbox: Sandbox) {
  assertManagedSandbox(sandbox);
  if (process.env.DAYTONA_KEEP_SANDBOX === 'true') {
    console.log(`[cleanup] Keeping ${sandbox.name} because DAYTONA_KEEP_SANDBOX=true`);
    return;
  }
  try {
    console.log(`[cleanup] Deleting ${sandbox.name} (${sandbox.id})`);
    await daytona.delete(sandbox, 180, true);
    console.log('[cleanup] Sandbox deleted');
  } catch (error) {
    throw new Error('Automatic deletion failed. Run npm run daytona:cleanup.', { cause: error });
  }
}

export async function resolveRemoteRoot(sandbox: Sandbox) {
  const response = await sandbox.process.executeCommand(
    'cd',
    undefined,
    undefined,
    30
  );
  assertCommand(response, 'resolve Windows user profile');
  const home = response.result.trim().split(/\r?\n/).at(-1)?.trim();
  if (!home || !/^[A-Za-z]:\\/.test(home)) throw new Error(`Unexpected Windows user profile: ${response.result}`);
  return `${home}\\platform-pulse`;
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

export async function uploadProject(sandbox: Sandbox, remoteRoot: string) {
  const localPaths = [...uploadFiles.map((item) => path.join(projectRoot, item))];
  for (const root of uploadRoots) localPaths.push(...await walkFiles(path.join(projectRoot, root)));

  const relativePaths = localPaths.map((file) => path.relative(projectRoot, file).replaceAll(path.sep, '/'));
  const directories = new Set(relativePaths.map((file) => path.posix.dirname(file)).filter((dir) => dir !== '.'));

  await sandbox.fs.createFolder(remoteRoot.replaceAll('\\', '/'), '755');
  for (const dir of [...directories].sort((a, b) => a.split('/').length - b.split('/').length)) {
    await sandbox.fs.createFolder(`${remoteRoot.replaceAll('\\', '/')}/${dir}`, '755');
  }

  await sandbox.fs.uploadFiles(localPaths.map((source, index) => ({
    source,
    destination: `${remoteRoot.replaceAll('\\', '/')}/${relativePaths[index]}`
  })), 300);
  console.log(`[upload] Uploaded ${localPaths.length} source files to ${remoteRoot}`);
}

export function assertCommand(response: { exitCode: number; result: string }, label: string) {
  if (response.exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${response.exitCode}:\n${response.result}`);
  }
}

export async function runCommand(
  sandbox: Sandbox,
  command: string,
  cwd?: string,
  env?: Record<string, string>,
  timeout = 120
) {
  console.log(`[command] ${command}`);
  // A transport failure does not prove a command was never executed.
  const response = await sandbox.process.executeCommand(command, cwd, env, timeout);
  if (response.result.trim()) console.log(response.result.trim());
  assertCommand(response, command);
  return response;
}

function isTransient(error: unknown) {
  const candidate = error as { statusCode?: number; response?: { status?: number }; message?: string };
  const status = candidate?.statusCode || candidate?.response?.status;
  return [429, 502, 503, 504].includes(status || 0) || /status code (429|502|503|504)/i.test(candidate?.message || '');
}

export async function retryTransient<T>(work: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (!isTransient(error) || attempt === 3) throw error;
      console.warn(`[retry] Transient Daytona error during ${label}; attempt ${attempt}`);
      await delay(1_500 * attempt);
    }
  }
  throw new Error('Unreachable retry state');
}

export async function ensureDependencies(sandbox: Sandbox, remoteRoot: string) {
  const marker = `${remoteRoot.replaceAll('\\', '/')}/node_modules/electron/package.json`;
  try {
    await sandbox.fs.getFileDetails(marker);
    console.log('[setup] Dependencies already installed');
    return;
  } catch {
    // Install below.
  }
  await runCommand(
    sandbox,
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\run-node-action.ps1 -ProjectRoot . -Action install',
    remoteRoot,
    { CI: '1' },
    900
  );
}

export async function ensureWindowsNode(sandbox: Sandbox, remoteRoot: string) {
  const nodeDir = `${remoteRoot}\\.tools\\node`;
  const existing = await sandbox.process.executeCommand(
    `if exist "${nodeDir}\\node.exe" (echo ${nodeDir}\\node.exe) else (exit /b 1)`,
    remoteRoot,
    undefined,
    30
  );
  if (existing.exitCode === 0) {
    console.log(`[setup] Using Node at ${existing.result.trim().split(/\r?\n/)[0]}`);
    return;
  }

  await runCommand(
    sandbox,
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\bootstrap-node.ps1 -ProjectRoot .',
    remoteRoot,
    undefined,
    300
  );

  await runCommand(sandbox, `${remoteNodeExe(remoteRoot)} --version`, remoteRoot, undefined, 30);
  await runCommand(sandbox, `${remoteNpmCmd(remoteRoot)} --version`, remoteRoot, undefined, 30);
}

export const remoteNodeExe = (remoteRoot: string) => `${remoteRoot}\\.tools\\node\\node.exe`;
export const remoteNpmCmd = (remoteRoot: string) => `${remoteRoot}\\.tools\\node\\npm.cmd`;

export async function saveScreenshot(sandbox: Sandbox, fileName: string) {
  const screenshot = await sandbox.computerUse.screenshot.takeCompressed({ format: 'png', quality: 90, showCursor: true });
  if (!screenshot.screenshot) throw new Error('Daytona Computer Use returned no screenshot payload.');
  await mkdir(artifactDir, { recursive: true });
  const output = path.join(artifactDir, fileName);
  await writeFile(output, Buffer.from(screenshot.screenshot, 'base64'));
  console.log(`[evidence] Saved ${output}`);
  return output;
}

export async function writeExperiment(fileName: string, result: ExperimentResult) {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, fileName), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

export async function timedExperiment(
  approach: string,
  work: () => Promise<Record<string, unknown>>,
  completedStatus: 'passed' | 'partial' = 'passed'
): Promise<ExperimentResult> {
  const startedAt = new Date();
  try {
    const details = await work();
    const finishedAt = new Date();
    return {
      approach,
      status: completedStatus,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      details
    };
  } catch (error) {
    const finishedAt = new Date();
    return {
      approach,
      status: 'failed',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

export const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
