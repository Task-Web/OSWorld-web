#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

SITES=(
  awsconsole_web
  budgetwise_web
  calendar_web
  careerlink_web
  cloudcrm_web
  dinogame_web
  eventix_web
  expenseflow_web
  formcraft_web
  glbviewer_web
  insurance_claim_web
  mailhub_web
  overleaf_collab_web
  reviewsphere_web
  slidepuzzle_web
  streamview_web
  teamchat_web
  travelhub_ad_web
  trippza_web
  vaultbank_web
  visaapplication_web
  wandb_web
)

if (($#)); then
  SITES=("$@")
fi

DIRECT_PATTERN="/api/state(?:/|[?#\"'\\x60[:space:]]|$)"
MANAGE_PATTERN="/state-(?:manage|doc)(?:/|[?#\"'\\x60[:space:]]|$)"
CONSTRUCTED_PATTERN="[\"']/api[\"'][[:space:]]*(?:\\+|\\.concat\\()[[:space:]]*[\"']/state|[\"']/api[\"'][[:space:]]*,[[:space:]]*[\"']/state|\\bAPI_BASE.{0,80}[\"']/state|\\b[[:alnum:]_$]*request[[:space:]]*\\([[:space:]]*[\"']/state(?:/|[?#\"'\\x60[:space:]]|$)|\\bfetch[[:space:]]*\\([[:space:]]*[\"']/state(?:/|[?#\"'\\x60[:space:]]|$)|[\"']/state[\"'][[:space:]]*(?:\\+|\\.concat\\()[[:space:]]*[\"']/developer-tools"
SOURCE_PATTERN="${DIRECT_PATTERN}|${MANAGE_PATTERN}|${CONSTRUCTED_PATTERN}|\\b(useStateApi|StateEditor|StateManage|buildStateUrl|stateEndpoint|STATE_API_(URL|PATH))\\b|\\b(api|apiClient|stateApi|client)\\.(get|put|patch|delete|replace|reset)State[[:space:]]*\\("

scan_site() {
  local site=$1
  local -a source_roots=()
  local -a asset_roots=()
  local candidate

  for candidate in \
    src/app \
    src/components \
    src/client \
    src/hooks \
    src/pages \
    src/lib \
    src/api \
    src/reviewsphere \
    src/store \
    src/views \
    src/wandb \
    src/App.jsx \
    src/StateManage.jsx \
    src/apiClient.js \
    frontend/src \
    frontend/js \
    frontend/index.html \
    frontend/success.html \
    frontend/sw.js; do
    if [[ -e "$ROOT_DIR/$site/$candidate" ]]; then
      source_roots+=("$ROOT_DIR/$site/$candidate")
    fi
  done

  for candidate in public frontend/public frontend/dist dist .next/static; do
    if [[ -e "$ROOT_DIR/$site/$candidate" ]]; then
      asset_roots+=("$ROOT_DIR/$site/$candidate")
    fi
  done

  if ((${#source_roots[@]} == 0 && ${#asset_roots[@]} == 0)); then
    printf 'ERROR %s: no browser source or asset roots found\n' "$site" >&2
    return 1
  fi

  local failed=0
  local -a rg_common=(
    --hidden
    --pcre2
    --ignore-case
    --glob '!**/node_modules/**'
    --glob '!**/.git/**'
    --glob '!**/coverage/**'
    --glob '!**/test-results/**'
    --glob '!**/playwright-report/**'
    --glob '!**/*.test.*'
    --glob '!**/*.spec.*'
    --glob '!**/__tests__/**'
    --glob '!**/tests/**'
    --glob '!**/app/api/state/**'
    --glob '!**/app/**slug**/page.tsx'
    --glob '!**/app/**path**/page.tsx'
    --glob '!**/pages/api/state/**'
    --glob '!**/lib/state-store.*'
    --glob '!**/lib/file-store.*'
    --glob '!**/lib/cookies.*'
    --glob '!**/lib/task052-state-guard.*'
  )

  if ((${#source_roots[@]})) && rg --line-number "${rg_common[@]}" \
    "$SOURCE_PATTERN" "${source_roots[@]}"; then
    failed=1
  fi

  if ((${#asset_roots[@]})) && rg --files-with-matches "${rg_common[@]}" \
    "${DIRECT_PATTERN}|${MANAGE_PATTERN}|${CONSTRUCTED_PATTERN}" "${asset_roots[@]}"; then
    failed=1
  fi

  if ((failed)); then
    printf 'FAIL %s: browser-reachable generic state reference found\n' "$site" >&2
    return 1
  fi

  printf 'PASS %s\n' "$site"
}

failures=0
for site in "${SITES[@]}"; do
  if ! scan_site "$site"; then
    failures=$((failures + 1))
  fi
done

if ((failures)); then
  printf '%d site(s) failed the no-client-state gate\n' "$failures" >&2
  exit 1
fi

printf 'All %d runtime sites passed the no-client-state source and bundle gate.\n' "${#SITES[@]}"
