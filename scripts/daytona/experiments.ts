import type { Sandbox } from '@daytona/sdk';
import path from 'node:path';
import { artifactDir, assertCommand, delay, ensureDependencies, ensureWindowsNode, retryTransient, runCommand, saveScreenshot, timedExperiment } from './common.js';

export async function runTerminalExperiment(sandbox: Sandbox, remoteRoot: string) {
  return timedExperiment('Daytona Process API (terminal)', async () => {
    const platform = await runCommand(
      sandbox,
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\run-node-action.ps1 -ProjectRoot . -Action platform',
      remoteRoot,
      undefined,
      30
    );
    const platformInfo = JSON.parse(platform.result.trim().split(/\r?\n/).at(-1) || '{}');
    if (platformInfo.platform !== 'win32') throw new Error(`Expected win32, received ${platformInfo.platform}`);

    const tests = await runCommand(
      sandbox,
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\run-node-action.ps1 -ProjectRoot . -Action unit',
      remoteRoot,
      { CI: '1' },
      120
    );
    return {
      platformInfo,
      unitTests: tests.result.includes('# pass 3') ? 3 : 'see log',
      transport: 'Mac TypeScript process -> Daytona SDK -> Windows PowerShell/Node'
    };
  });
}

export async function runPlaywrightExperiment(sandbox: Sandbox, remoteRoot: string) {
  return timedExperiment('Playwright Electron (in-sandbox)', async () => {
    const response = await runCommand(
      sandbox,
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\run-node-action.ps1 -ProjectRoot . -Action playwright',
      remoteRoot,
      { CI: '1', EXPECTED_PLATFORM: 'win32', FORCE_COLOR: '0' },
      300
    );

    await runCommand(
      sandbox,
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\package-evidence.ps1',
      remoteRoot,
      undefined,
      120
    );
    const localZip = path.join(artifactDir, 'windows-playwright-evidence.zip');
    await retryTransient(
      () => sandbox.fs.downloadFile(`${remoteRoot.replaceAll('\\', '/')}/windows-playwright-evidence.zip`, localZip, 300),
      'Playwright evidence download'
    );

    return {
      testsPassed: /2 passed/.test(response.result) ? 2 : 'see evidence',
      expectedPlatform: 'win32',
      evidence: localZip,
      controlBoundary: 'Playwright and Electron execute inside Windows; the Mac agent receives logs and artifacts through Daytona.'
    };
  });
}

async function launchElectron(sandbox: Sandbox, remoteRoot: string) {
  const executable = `${remoteRoot}\\node_modules\\electron\\dist\\electron.exe`;
  const display = await sandbox.computerUse.display.getInfo();
  const activeDisplay = display.displays?.find((candidate) => candidate.isActive) || display.displays?.[0];
  const width = activeDisplay?.width || 1024;
  const height = activeDisplay?.height || 768;
  await sandbox.computerUse.mouse.click(Math.round(width * 0.45), height - 24);
  await delay(500);
  await sandbox.computerUse.keyboard.hotkey('ctrl+a');
  await sandbox.computerUse.keyboard.type('run', 60);
  await delay(800);
  await sandbox.computerUse.keyboard.press('enter');
  await delay(800);
  await sandbox.computerUse.keyboard.type(`${executable} ${remoteRoot}`, 2);
  await sandbox.computerUse.keyboard.press('enter');
  return { method: 'Computer Use via Windows Search -> Run', executable, display: { width, height } };
}

async function waitForPlatformPulseWindow(sandbox: Sandbox) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await sandbox.computerUse.display.getWindows();
    const window = response.windows?.find((candidate) => candidate.title?.includes('Platform Pulse') && candidate.isActive);
    if (window) return window;
    await delay(1_000);
  }
  throw new Error('Platform Pulse window did not appear within 30 seconds.');
}

async function invokeByName(sandbox: Sandbox, name: string) {
  const response = await sandbox.computerUse.accessibility.findNodes({
    scope: 'all',
    name,
    nameMatch: 'substring',
    limit: 10
  });
  const node = response.matches?.find((candidate) => candidate.id && candidate.actions?.length);
  if (!node?.id) return false;
  await sandbox.computerUse.accessibility.invokeNode(node.id, node.actions?.includes('click') ? 'click' : undefined);
  return true;
}

export async function runComputerUseExperiment(sandbox: Sandbox, remoteRoot: string) {
  return timedExperiment('Daytona Computer Use API', async () => {
    const start = await sandbox.computerUse.start();
    await sandbox.process.executeCommand('taskkill /IM electron.exe /F', undefined, undefined, 30).catch(() => undefined);
    const launch = await launchElectron(sandbox, remoteRoot);
    const window = await waitForPlatformPulseWindow(sandbox);
    const recording = await sandbox.computerUse.recording.start('platform-pulse-windows-demo').catch(() => undefined);

    const overview = await saveScreenshot(sandbox, 'windows-computer-use-overview.png');
    const runInvoked = await invokeByName(sandbox, 'Run full check');
    if (!runInvoked) {
      const x = (window.x || 0) + (window.width || 1000) - 95;
      const y = (window.y || 0) + 62;
      await sandbox.computerUse.mouse.click(x, y);
    }
    await delay(2_000);
    const diagnostics = await saveScreenshot(sandbox, 'windows-computer-use-diagnostics.png');

    const noteInvoked = await invokeByName(sandbox, 'QA note');
    if (!noteInvoked) await sandbox.computerUse.mouse.click((window.x || 0) + 95, (window.y || 0) + 184);
    await delay(800);

    const textFields = await sandbox.computerUse.accessibility.findNodes({ scope: 'all', role: 'textbox', limit: 10 });
    const noteField = textFields.matches?.find((candidate) => candidate.id);
    if (noteField?.id) {
      await sandbox.computerUse.accessibility.setNodeValue(noteField.id, 'Daytona Computer Use probe: verify this note persists before claiming success.');
    } else {
      await sandbox.computerUse.mouse.click((window.x || 0) + 570, (window.y || 0) + 300);
      await sandbox.computerUse.keyboard.hotkey('ctrl+a');
      await sandbox.computerUse.keyboard.type('Daytona Computer Use probe: verify this note persists before claiming success.', 3);
    }

    const saved = await invokeByName(sandbox, 'Save to this OS');
    if (!saved) await sandbox.computerUse.mouse.click((window.x || 0) + (window.width || 1000) - 105, (window.y || 0) + 460);
    await delay(1_000);
    const note = await saveScreenshot(sandbox, 'windows-computer-use-saved-note.png');

    const overviewInvoked = await invokeByName(sandbox, 'Overview');
    if (!overviewInvoked) await sandbox.computerUse.mouse.click((window.x || 0) + 95, (window.y || 0) + 104);
    await delay(500);
    const dialogInvoked = await invokeByName(sandbox, 'Open dialog');
    if (!dialogInvoked) await sandbox.computerUse.mouse.click((window.x || 0) + (window.width || 1000) - 150, (window.y || 0) + 475);
    await delay(1_000);
    const dialog = await saveScreenshot(sandbox, 'windows-computer-use-native-dialog.png');
    await sandbox.computerUse.keyboard.press('enter');

    const video = path.join(artifactDir, 'windows-computer-use-demo.mp4');
    let recordingResult: Record<string, unknown> = { status: 'not-started' };
    if (recording) {
      try {
        const stoppedRecording = await sandbox.computerUse.recording.stop(recording.id);
        await sandbox.computerUse.recording.download(recording.id, video);
        recordingResult = { status: 'downloaded', path: video, durationSeconds: stoppedRecording.durationSeconds };
      } catch (error) {
        recordingResult = { status: 'unavailable', error: error instanceof Error ? error.message : String(error) };
      } finally {
        await sandbox.computerUse.recording.delete(recording.id).catch(() => undefined);
      }
    }

    const windows = await sandbox.computerUse.display.getWindows();
    return {
      startMessage: start.message,
      window,
      launch,
      openWindows: windows.windows?.map(({ title, isActive }) => ({ title, isActive })),
      accessibilityUsed: { runInvoked, noteInvoked, saved, overviewInvoked, dialogInvoked },
      screenshots: { overview, diagnostics, note, dialog },
      recording: recordingResult,
      limitation: 'Active app window and input/capture calls completed. Diagnostics outcome, saved-note persistence and native-dialog appearance have not been asserted; screenshots require review.' 
    };
  }, 'partial');
}

export async function runTryCuaExperiment(sandbox: Sandbox, remoteRoot: string) {
  return timedExperiment('TryCUA / Cua Driver through Daytona terminal', async () => {
    const install = await sandbox.process.executeCommand(
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\\windows\\install-cua.ps1 -ProjectRoot .',
      remoteRoot,
      { CUA_TELEMETRY_DISABLED: '1' },
      300
    );
    assertCommand(install, 'install Cua Driver');

    const driver = `${remoteRoot}\\.tools\\cua-driver\\cua-driver.exe`;
    const version = await runCommand(sandbox, `${driver} --version`, remoteRoot, undefined, 30);
    const doctor = await sandbox.process.executeCommand(
      `${driver} doctor --json`,
      remoteRoot,
      { CUA_TELEMETRY_DISABLED: '1' },
      90
    );
    assertCommand(doctor, 'Cua Driver doctor');
    const apps = await sandbox.process.executeCommand(
      `${driver} call list_apps`,
      remoteRoot,
      { CUA_TELEMETRY_DISABLED: '1' },
      90
    );

    assertCommand(apps, 'Cua Driver list_apps');

    return {
      version: version.result.trim(),
      doctorExitCode: doctor.exitCode,
      doctor: doctor.result.trim().slice(0, 12_000),
      listAppsExitCode: apps.exitCode,
      listApps: apps.result.trim().slice(0, 12_000),
      conclusion: /Session 0 \(services\)/.test(doctor.result)
        ? 'Cua Driver installed and enumerated applications, but the Daytona Process API runs it in Session 0, so GUI tools cannot attach to the interactive desktop. Use Daytona Computer Use unless an interactive-session bridge is added.'
        : apps.exitCode === 0
          ? 'Cua Driver setup and application enumeration completed; target-window interaction has not been verified.'
          : 'Cua Driver installed, but could not enumerate applications.'
    };
  }, 'partial');
}

export async function installAndPrepare(sandbox: Sandbox, remoteRoot: string) {
  await ensureWindowsNode(sandbox, remoteRoot);
  await ensureDependencies(sandbox, remoteRoot);
}
