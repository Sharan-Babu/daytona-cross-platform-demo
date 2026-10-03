const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizedSystemInfo, platformAccent, platformLabel } = require('../lib/platform.cjs');

test('maps platform identifiers to readable labels', () => {
  assert.equal(platformLabel('win32'), 'Windows');
  assert.equal(platformLabel('darwin'), 'macOS');
  assert.equal(platformLabel('freebsd'), 'freebsd');
});

test('uses a distinct platform accent', () => {
  assert.equal(platformAccent('win32'), '#2f7df6');
  assert.equal(platformAccent('darwin'), '#a855f7');
  assert.equal(platformAccent('linux'), '#22c55e');
});

test('normalizes system information deterministically', () => {
  const info = normalizedSystemInfo({
    platform: 'win32',
    arch: 'x64',
    release: '10.0.26100',
    hostname: 'daytona-win',
    cpus: [{ model: 'Demo CPU' }, { model: 'Demo CPU' }],
    totalmem: 8 * 1024 ** 3
  });

  assert.deepEqual(info, {
    platform: 'win32',
    platformLabel: 'Windows',
    arch: 'x64',
    release: '10.0.26100',
    hostname: 'daytona-win',
    cpuModel: 'Demo CPU',
    cpuCount: 2,
    memoryGiB: 8,
    accent: '#2f7df6'
  });
});

