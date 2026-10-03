import test from 'node:test';
import assert from 'node:assert/strict';
import type { Daytona, Sandbox } from '@daytona/sdk';
import { assertManagedSandbox, getOrCreateWindowsSandbox, managedLabels, runCommand, safeDelete, windowsSnapshot } from '../scripts/daytona/common.js';
const sandbox = (labels = managedLabels) => ({ labels, snapshot: windowsSnapshot, state: 'started', name: 'test', id: 'test' }) as unknown as Sandbox;
test('refuses reusing an unrelated sandbox before starting it', async () => {
  let started = false;
  const other = { ...sandbox({} as typeof managedLabels), start: async () => { started = true; } };
  await assert.rejects(getOrCreateWindowsSandbox({ get: async () => other } as unknown as Daytona), /ownership/);
  assert.equal(started, false);
});
test('accepts owned sandbox and reuses it', async () => {
  const own = sandbox();
  assert.doesNotThrow(() => assertManagedSandbox(own));
  const result = await getOrCreateWindowsSandbox({ get: async () => own } as unknown as Daytona);
  assert.equal(result.sandbox, own);
  assert.equal(result.created, false);
});
test('refuses deleting unrelated resources', async () => {
  let deleted = false;
  await assert.rejects(safeDelete({ delete: async () => { deleted = true; } } as unknown as Daytona, sandbox({} as typeof managedLabels)), /ownership/);
  assert.equal(deleted, false);
});
test('cleanup errors fail the caller', async () => {
  const old = process.env.DAYTONA_KEEP_SANDBOX;
  delete process.env.DAYTONA_KEEP_SANDBOX;
  try { await assert.rejects(safeDelete({ delete: async () => { throw new Error('offline'); } } as unknown as Daytona, sandbox()), /deletion failed/); }
  finally { if (old === undefined) delete process.env.DAYTONA_KEEP_SANDBOX; else process.env.DAYTONA_KEEP_SANDBOX = old; }
});
test('does not replay a possibly executed command on transport error', async () => {
  let calls = 0;
  const fake = { process: { executeCommand: async () => { calls++; throw Object.assign(new Error('unavailable'), { statusCode: 503 }); } } } as unknown as Sandbox;
  await assert.rejects(runCommand(fake, 'side-effect'), /unavailable/);
  assert.equal(calls, 1);
});

import { runTryCuaExperiment } from '../scripts/daytona/experiments.js';
import { timedExperiment } from '../scripts/daytona/common.js';
async function cuaProbe(doctorCode: number, appsCode: number, doctorText = 'healthy') {
  const responses = [
    { exitCode: 0, result: 'installed' }, { exitCode: 0, result: '0.8.3' },
    { exitCode: doctorCode, result: doctorText }, { exitCode: appsCode, result: '[]' }
  ];
  const fake = { process: { executeCommand: async () => responses.shift()! } } as unknown as Sandbox;
  return runTryCuaExperiment(fake, 'C:\\lab');
}
test('Cua setup and enumeration do not prove target-window control', async () => {
  assert.equal((await cuaProbe(0, 0)).status, 'partial');
  assert.equal((await cuaProbe(0, 0, 'Session 0 (services)')).status, 'partial');
});
test('Cua doctor failure is a failed experiment', async () => {
  const result = await cuaProbe(1, 0);
  assert.equal(result.status, 'failed');
  assert.match(String(result.details.error), /doctor failed/);
});
test('Cua enumeration failure is a failed experiment', async () => {
  const result = await cuaProbe(0, 1);
  assert.equal(result.status, 'failed');
  assert.match(String(result.details.error), /list_apps failed/);
});
test('unverified desktop capture stays partial; transport errors still fail', async () => {
  const partial = await timedExperiment('desktop capture', async () => ({ screenshot: 'captured' }), 'partial');
  assert.equal(partial.status, 'partial');
  const failed = await timedExperiment('desktop capture', async () => { throw new Error('capture failed'); }, 'partial');
  assert.equal(failed.status, 'failed');
});
