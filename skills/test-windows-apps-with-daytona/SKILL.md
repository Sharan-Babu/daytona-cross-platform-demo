---
name: test-windows-apps-with-daytona
description: Test, debug, and validate desktop or Windows-specific applications in disposable Daytona Windows sandboxes from a macOS or Linux coding-agent host. Use when asked to run Electron, Tauri, .NET, native Windows, installer, CLI, registry, or GUI workflows on real Windows; compare terminal, Playwright, Daytona MCP/Computer Use, or Cua/TryCUA control; collect cross-platform evidence; or assess the reverse macOS-testing path.
---

# Test Windows Apps With Daytona

Run the smallest reproducible test ladder on a real Daytona Windows VM, return verifiable artifacts, and always clean up managed resources.

## Start safely

1. Inspect the repository, test commands, package manager, expected target OS, and required artifacts.
2. Require `DAYTONA_API_KEY` through the process environment. Never print it, pass it on a command line, write it to project files, or include it in screenshots/logs.
3. Run `scripts/daytona-preflight.sh` when `curl` and `jq` are available. Treat capacity and tier-limit errors as provider state, not application failures.
4. Create at most one labeled sandbox for a sequential test run. Default to `windows-small`; larger snapshots may exceed organization disk limits.
5. Set `autoStopInterval`, `autoArchiveInterval`, and `autoDeleteInterval`, then also delete the sandbox in a `finally`/defer block. Honor an explicit keep flag only when the user asks to inspect the live VM.

Read [references/daytona-windows.md](references/daytona-windows.md) before writing integration code or when SDK/MCP details matter. Read [references/strategy-matrix.md](references/strategy-matrix.md) before recommending an approach or adding Cua.

## Prepare Windows reproducibly

1. Run the app's existing local tests before provisioning Windows.
2. Upload source and lockfiles only. Exclude `.env*`, credentials, `node_modules`, caches, and unrelated artifacts.
3. Probe the target with `cd`, `whoami`, and a platform-specific command before assuming paths or installed tools.
4. Expect a bare Windows snapshot. Bootstrap required runtimes under the project or user directory without administrator changes.
5. Upload non-trivial PowerShell as `.ps1` files and invoke them with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`. Avoid inline PowerShell containing `$variables`; cross-shell quoting through the remote command endpoint is fragile.
6. On Node projects, ensure the portable Node directory is in `PATH` inside the PowerShell process that runs `npm`, so lifecycle child processes can find `node`.
7. Pin application/runtime versions through the lockfile. If a latest Electron installer fails only on Windows, validate and document a compatible maintained release rather than bypassing install checks.

## Run the test ladder

Run each applicable layer against the same scenario and record its boundary.

### 1. Terminal and native runtime

- Assert `process.platform === "win32"` or an equivalent OS probe.
- Run unit tests, build checks, Windows-only filesystem/registry/PowerShell behavior, and installer smoke tests.
- Capture command, exit code, duration, runtime versions, and relevant output.

### 2. Playwright inside Windows

- Run Playwright/Electron in the sandbox, not from macOS against a hidden local process.
- Assert `EXPECTED_PLATFORM=win32` in the renderer or main process.
- Capture screenshots, traces, structured reporter output, and packaged artifacts; download them before cleanup.
- Retry provider `429/502/503/504` responses only for safe idempotent operations.

### 3. Daytona Computer Use

- Start Computer Use and inspect display/window state before clicking.
- Remember the session boundary: Process API commands may execute in Windows Session 0, while Computer Use controls the interactive VNC desktop. A GUI process launched by terminal may not be visible.
- Launch GUI apps through the interactive desktop (Windows Search/Run, a verified interactive task, or an exposed Daytona GUI launch mechanism).
- Require an active target window before accepting evidence. Do not count a tool success or stale window title as visual success.
- Prefer accessibility lookup/invoke/set-value. Fall back to coordinates only after measuring the current display/window geometry.
- Capture before/after screenshots. Treat video recording as optional if recording retrieval is unavailable.

### 4. MCP interface

- Prefer Daytona MCP when the agent already has it connected. It exposes the same lifecycle, terminal, filesystem, and Computer Use capabilities without custom SDK glue.
- Verify tool availability rather than assuming names. Use the tools listed in `references/daytona-windows.md` as current examples, not a permanent contract.
- Use the TypeScript/Python SDK for repeatable CI scripts and MCP for agent-driven exploratory work.

### 5. Cua / TryCUA

- Probe Cua Driver only when it adds value beyond Daytona Computer Use, such as background UIA/AX actions or a cross-provider driver contract.
- Run `cua-driver doctor` and require an attached interactive session before GUI claims.
- If invoked through Daytona Process API in Session 0, Cua may enumerate installed apps but cannot drive the interactive VNC desktop. Record this as a session-boundary result; do not call it a GUI pass.
- Prefer Daytona Computer Use for Daytona Windows sandboxes unless an explicit interactive-session bridge is installed and verified.

## Judge and report

Use application-owned state and visible artifacts as the success criterion. Return:

- target snapshot, native OS/architecture, tool/runtime versions;
- commands and test counts;
- screenshots/traces/logs with local paths;
- per-approach pass, partial, fail, or not-applicable status;
- session/capacity/provider limitations separated from app defects;
- a cleanup result and a final read-only list proving no managed sandbox remains.

Recommend the hybrid by default: terminal for setup and deterministic checks, in-sandbox Playwright for app semantics and traces, Daytona Computer Use for native desktop surfaces, and Daytona MCP as the agent-facing transport.

## Handle macOS reverse testing

Daytona documentation checked on 2026-10-03 routes macOS sandboxes and Computer Use to use.computer. This harness validates the Windows path only. Recheck that separate service's access, API and permissions before planning macOS delivery. Do not treat it as a Windows snapshot-name swap.
