# Daytona cross-platform desktop demo

Test a small Electron app, **Platform Pulse**, locally and inside a disposable Windows sandbox. The app reports runtime information, runs filesystem diagnostics, saves a QA note and opens a native dialog. The harness separates terminal tests, Electron assertions and whole-desktop automation so each result has a clear meaning.

## Local setup

Use Node.js 22 and npm. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run test:unit
npm run test:orchestration
npm run typecheck
npm run test:electron
npm start
```

Electron tests require a graphical desktop. On a headless Linux host, configure a display server first. Test mode uses a temporary profile and deletes it after the suite, preserving normal app notes. Test screenshots and traces are local outputs, excluded from Git.

## Windows sandbox run

A Daytona account with Windows sandbox access and an API key is required. Creating a sandbox uses your account's resources and billing. Export `DAYTONA_API_KEY` securely in your shell; `.env.example` documents settings but is not automatically loaded. Never put a real key into a commit.

```sh
npm run daytona:preflight
npm run daytona:terminal
npm run daytona:playwright
# Experimental desktop paths, with their own evidence requirements:
npm run daytona:computer-use
npm run daytona:trycua
# Or run all four:
npm run daytona:all
npm run daytona:cleanup
```

The harness creates `windows-small` by default, uploads an explicit source allowlist, installs portable Node 22.22.2 and the locked dependencies, runs the selected experiment and deletes the sandbox in `finally`. Creation has bounded retries for capacity errors. Existing resources are reused only when all ownership labels and the snapshot match. Reused managed resources are also deleted after the run. Use a unique `DAYTONA_SANDBOX_NAME` for concurrent runs; shared names are not concurrency-safe.

Deletion waits for completion and failures produce a nonzero exit. Experiment commands return 1 for failure and 2 for a partial result, including incomplete native desktop verification. Lifecycle timers are a fallback, not a substitute for checking cleanup. `DAYTONA_KEEP_SANDBOX=true` deliberately retains the sandbox for debugging; run cleanup afterward. If creation fails before returning an ID, inspect the account for the chosen name before retrying. Transport errors do not automatically replay commands because a command might already have executed.

## What was observed

The original July 17, 2026 run used Daytona SDK/CLI 0.198.0. Windows unit tests passed 3/3 and Electron/Playwright tests passed 2/2. A Daytona MCP handshake returned 39 tools. These are historical observations, not a fresh test of current provider capacity or tool counts.

Native desktop automation remained **partial**. Both native-desktop probe scripts now report partial after successful setup/input/capture calls, because they do not assert the complete target workflow. Nonzero Cua doctor or application-enumeration commands report failed. Early Computer Use screenshots showed the desktop instead of the target app; a stricter active-window retry encountered unavailable Windows runners. Cua Driver installation and its doctor check passed, but execution through the Process API landed in Windows Session 0 and could not control the interactive desktop. A passing terminal command or driver setup check does not establish a passing GUI workflow.

The release keeps the tested dependency pins. It does not claim compatibility with every later SDK or Electron version. Current Daytona documentation checked October 3, 2026 lists Linux and Windows Computer Use through Daytona and routes macOS to the separate use.computer service. This repository does not validate that macOS service.

## Layout

- `app/`, `lib/`: Electron demo and deterministic platform helpers.
- `tests/`: unit, lifecycle guard and Electron tests.
- `scripts/daytona/`: sandbox setup and experiment orchestration.
- `scripts/windows/`: portable Node setup, test runners and evidence packaging.
- `scripts/mcp-probe.mjs`: optional Daytona CLI MCP discovery probe.
- `skills/test-windows-apps-with-daytona/`: reusable agent instructions and dated reference notes. Copy this folder into your agent's skills directory to install it.

Runtime results go into `artifacts/live/`. Review traces and screenshots before sharing: they can contain hostnames, paths and application data. Source excludes raw provider artifacts, credentials and editorial drafts. No license file is included.

## References

- [Daytona Windows sandboxes](https://www.daytona.io/docs/en/sandboxes/#windows)
- [Computer Use and macOS routing](https://www.daytona.io/docs/en/computer-use/)
- [TypeScript lifecycle API](https://www.daytona.io/docs/en/typescript-sdk/daytona/)
- [Playwright Electron support](https://playwright.dev/docs/api/class-electron)
