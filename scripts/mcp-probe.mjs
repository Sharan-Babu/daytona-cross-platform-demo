import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'artifacts', 'live', 'daytona-mcp-tools.json');
let cliVersion = 'unverified';
try { cliVersion = execFileSync('daytona', ['--version'], { encoding: 'utf8', timeout: 5000 }).trim(); } catch {}
const child = spawn('daytona', ['mcp', 'start'], { stdio: ['pipe', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
let initialized = false;
let settled = false;

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function settle(error, result) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  child.kill('SIGTERM');
  if (error) {
    console.error(error.message);
    if (stderr.trim()) console.error(stderr.trim());
    process.exitCode = 1;
    return;
  }
  mkdir(path.dirname(outputPath), { recursive: true })
    .then(() => writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8'))
    .then(() => console.log(`MCP handshake passed; saved ${result.tools.length} tools to ${outputPath}`))
    .catch((writeError) => {
      console.error(writeError);
      process.exitCode = 1;
    });
}

function handle(message) {
  if (message.id === 1 && message.result && !initialized) {
    initialized = true;
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    return;
  }
  if (message.id === 2) {
    if (message.error) settle(new Error(`tools/list failed: ${JSON.stringify(message.error)}`));
    else settle(undefined, {
      probedAt: new Date().toISOString(),
      cliVersion,
      protocol: 'MCP stdio JSON-RPC',
      server: 'daytona mcp start',
      tools: (message.result?.tools || []).map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    });
  }
}

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
  const lines = stdout.split(/\r?\n/);
  stdout = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try { handle(JSON.parse(line)); } catch { stderr += `[non-json stdout] ${line}\n`; }
  }
});

child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
child.on('error', (error) => settle(error));
child.on('exit', (code) => {
  if (!settled) settle(new Error(`Daytona MCP server exited before tools/list (code ${code}).`));
});

const timer = setTimeout(() => settle(new Error('Timed out waiting for Daytona MCP tools/list.')), 20_000);

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'platform-pulse-demo-probe', version: '1.0.0' }
  }
});

