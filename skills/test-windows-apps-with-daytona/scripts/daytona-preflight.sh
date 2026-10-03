#!/usr/bin/env bash
set -euo pipefail

: "${DAYTONA_API_KEY:?Export DAYTONA_API_KEY before running this preflight}"

for dependency in curl jq; do
  if ! command -v "${dependency}" >/dev/null 2>&1; then
    echo "Missing required command: ${dependency}" >&2
    exit 2
  fi
done

api_url="${DAYTONA_API_URL:-https://app.daytona.io/api}"
project_label="${DAYTONA_PROJECT_LABEL:-}"
auth_header="Authorization: Bearer ${DAYTONA_API_KEY}"

echo "Daytona API: ${api_url}"
echo "Available Windows snapshots:"
curl -fsS "${api_url}/snapshots?limit=100" -H "${auth_header}" |
  jq '[.items[]? | select(.general == true and .sandboxClass == "windows") | {name, cpu, memory: .mem, disk, state, regions: .regionIds}]'

echo "Managed sandboxes:"
curl -fsS "${api_url}/sandbox?limit=100" -H "${auth_header}" |
  jq --arg project "${project_label}" '[
    (.items // .data // .)[]?
    | select($project == "" or .labels.project == $project)
    | {id, name, state, snapshot, labels}
  ]'

