# Strategy matrix

| Approach | Best use | Main strength | Important boundary | Default? |
|---|---|---|---|---|
| Daytona Process API / terminal | Install, build, unit/CLI/registry tests | Deterministic and easy to log | Noninteractive Windows session; not visual proof | Yes |
| Playwright/Electron inside VM | DOM, IPC, persistence, screenshots, traces | Strong app-level assertions | Runs inside Windows; remote Mac only orchestrates | Yes |
| Daytona Computer Use | Native dialogs, OS chrome, visual workflow | Controls Daytona interactive desktop directly | Validate active window; coordinates are fallback | Yes |
| Daytona MCP | Coding-agent access to all above | No custom transport glue; 39 verified tools | Requires CLI login/MCP connection | Yes for agents |
| Cua Driver / TryCUA | Cross-platform UIA/AX, background desktop control | Rich semantic native driver, Electron coverage | Through Daytona Process API it lands in Session 0 | Optional |
| Manual VNC | Demo, debugging, human inspection | Immediate visual feedback | Not repeatable automation | Support only |

## Recommendation

Use a hybrid pipeline:

1. Process API for provisioning, upload, bootstrap, build, and unit checks.
2. Playwright inside Windows for repeatable Electron/application assertions and traces.
3. Daytona Computer Use for native dialogs and whole-desktop evidence.
4. MCP as the agent-facing interface when available; SDK scripts for CI/reproducibility.
5. Cua only with a verified interactive-session bridge or outside Daytona where its driver owns the actual desktop session.

## macOS reverse path

Daytona documentation checked on 2026-10-03 directs macOS sandbox and Computer Use requests to https://use.computer. This is a separate service/API and has not been validated by this harness.

Source: https://www.daytona.io/docs/en/computer-use/.
