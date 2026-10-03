# Daytona Windows reference

Verified against Daytona SDK/CLI `0.198.0` on 2026-07-17.

## Sandbox profiles

| Snapshot | vCPU | RAM | Storage |
|---|---:|---:|---:|
| `windows-small` | 1 | 4 GiB | 30 GiB |
| `windows-medium` | 2 | 8 GiB | 50 GiB |
| `windows-large` | 4 | 16 GiB | 50 GiB |

Create with TypeScript:

```ts
const sandbox = await daytona.create({
  name: 'my-windows-test',
  snapshot: 'windows-small',
  labels: { project: 'my-project', managedBy: 'coding-agent' },
  autoStopInterval: 15,
  autoArchiveInterval: 60,
  autoDeleteInterval: 60
}, { timeout: 180 });
```

Use `try/finally` and `await daytona.delete(sandbox, 180, true)` even with lifecycle timers.

## Verified interfaces

The CLI command is `daytona mcp start`. A live MCP `tools/list` returned 39 tools, including:

- lifecycle/files: `create_sandbox`, `destroy_sandbox`, `file_upload`, `file_download`, `list_files`;
- execution: `execute_command`;
- desktop: `computer_use_start`, `computer_use_status`, `computer_use_windows`;
- input: `computer_use_mouse_click`, `computer_use_keyboard_type`, `computer_use_keyboard_press`, `computer_use_keyboard_hotkey`;
- observation: `computer_use_screenshot`, `computer_use_screenshot_compressed`, `computer_use_display_info`;
- semantic GUI: `computer_use_accessibility_find`, `computer_use_accessibility_invoke`, `computer_use_accessibility_set_value`, `computer_use_accessibility_tree`;
- recording: start, stop, get, list, and delete.

The TypeScript SDK provides the same surfaces through `sandbox.process`, `sandbox.fs`, and `sandbox.computerUse`.

## Windows-specific observations

- The tested snapshot was Windows Server 2025, `win32/x64`.
- The base snapshot did not include Node/npm. A portable Node runtime under the project worked.
- Upload `.ps1` scripts for runtime bootstrap. Invoke them with `powershell.exe ... -File`; avoid inline variable-heavy PowerShell.
- Process API execution and Cua Driver ran in Session 0. Daytona Computer Use operated the interactive desktop. Treat them as distinct sessions.
- A locked Electron 39 release installed and passed Playwright; Electron 43.1.1 hit a Windows extractor native-binding failure in this environment.
- Daytona capacity can return `No available runners`. Retry with bounded backoff and never classify it as an app regression.

## Official sources

- Windows profiles and creation: https://www.daytona.io/docs/en/sandboxes/#windows
- Windows announcement/use cases: https://www.daytona.io/dotfiles/windows-sandboxes
- Computer Use and current macOS routing: https://www.daytona.io/docs/en/computer-use/
- TypeScript SDK: https://www.daytona.io/docs/en/typescript-sdk/
- Daytona MCP: https://www.daytona.io/docs/en/mcp/
- VNC/interactive desktop: https://www.daytona.io/docs/en/vnc-access/

