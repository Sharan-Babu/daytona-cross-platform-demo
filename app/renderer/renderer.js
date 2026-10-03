const $ = (selector) => document.querySelector(selector);

function setAccent(hex) {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)).join(', ');
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-rgb', rgb);
}

function showSection(id) {
  document.querySelectorAll('.panel-section').forEach((section) => section.classList.toggle('active-section', section.id === id));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.target === id));
}

async function bootstrap() {
  const [info, note] = await Promise.all([
    window.platformPulse.getSystemInfo(),
    window.platformPulse.loadNote()
  ]);

  setAccent(info.accent);
  $('#platform-name').textContent = `${info.platformLabel} ${info.arch}`;
  $('#platform-monogram').textContent = info.platformLabel === 'Windows' ? '⊞' : info.platformLabel === 'macOS' ? '⌘' : '◆';
  $('#platform-summary').textContent = `${info.platformLabel} build ${info.release} is running this Electron process natively.`;
  $('#arch-value').textContent = info.arch;
  $('#release-value').textContent = info.release;
  $('#memory-value').textContent = `${info.memoryGiB} GiB`;
  $('#electron-value').textContent = `v${info.electron}`;
  $('#route-platform').textContent = info.platformLabel;
  $('#sandbox-detail').textContent = `${info.platformLabel} · ${info.arch}`;
  $('#host-name').textContent = `Host: ${info.hostname}`;
  $('#runtime-versions').textContent = `Node ${info.node} · Chrome ${info.chrome}`;
  $('#readiness-score').textContent = '100';
  $('#qa-note').value = note;
  $('#note-count').textContent = note.length;
  document.body.dataset.platform = info.platform;
}

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => showSection(item.dataset.target)));

$('#run-diagnostics').addEventListener('click', async () => {
  const button = $('#run-diagnostics');
  button.disabled = true;
  button.textContent = 'Running…';
  const results = await window.platformPulse.runDiagnostics();
  $('#diagnostic-list').innerHTML = results.map((result) => `
    <div class="diagnostic-row" data-status="${result.status}">
      <span>✓</span><div><strong>${result.name}</strong><small>${result.detail}</small></div><b>${result.status}</b>
    </div>`).join('');
  $('#diagnostic-state').textContent = `${results.filter((item) => item.status === 'pass').length}/${results.length} passed`;
  $('#diagnostic-state').classList.add('pass');
  button.disabled = false;
  button.innerHTML = '<span>↻</span> Run again';
  showSection('diagnostics');
});

$('#native-proof').addEventListener('click', () => window.platformPulse.showNativeProof());

$('#qa-note').addEventListener('input', (event) => {
  $('#note-count').textContent = event.target.value.length;
  $('#save-state').textContent = 'Unsaved';
  $('#save-state').classList.remove('pass');
});

$('#save-note').addEventListener('click', async () => {
  const result = await window.platformPulse.saveNote($('#qa-note').value);
  $('#save-state').textContent = result.saved ? `Saved · ${result.bytes} bytes` : 'Save failed';
  $('#save-state').classList.toggle('pass', result.saved);
});

bootstrap().catch((error) => {
  $('#platform-name').textContent = 'Unable to read platform';
  $('#platform-summary').textContent = error.message;
});

