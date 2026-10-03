const PLATFORM_LABELS = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
};

function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform;
}

function platformAccent(platform) {
  if (platform === 'win32') return '#2f7df6';
  if (platform === 'darwin') return '#a855f7';
  return '#22c55e';
}

function normalizedSystemInfo({ platform, arch, release, hostname, cpus, totalmem }) {
  return {
    platform,
    platformLabel: platformLabel(platform),
    arch,
    release,
    hostname,
    cpuModel: cpus?.[0]?.model || 'Unknown CPU',
    cpuCount: cpus?.length || 0,
    memoryGiB: Math.round((totalmem / 1024 ** 3) * 10) / 10,
    accent: platformAccent(platform)
  };
}

module.exports = { normalizedSystemInfo, platformAccent, platformLabel };

