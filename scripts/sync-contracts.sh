#!/usr/bin/env bash
# Copy the Smarter backend's api contracts that the console reads, then regenerate their TypeScript types.
#
# The backend (smarter-sh/smarter) owns these JSON Schemas: it generates them from its Pydantic models, and its
# tests fail when a committed schema is out of date. Each package that reads one keeps a copy in its contract/
# folder, from which `npm run contract:types` generates its TypeScript types:
#
# - the console's session (GET /api/web/session/)              -> packages/smarter-console
# - Smarter Chat's api                                          -> packages/smarter.sh-chat
# - the Extensions console's api                                -> packages/smarter-extension-console
# - the LLM tool list's Extensions tab                          -> packages/smarter-llmtool-list
# - a deployed LLMClient's page                                 -> packages/smarter-llmclient-deployment
# - the workbench's Architecture tab                            -> packages/smarter-llmclient-architecture
#
# Run it after the backend's contracts change (make contracts), then run the tests.
#
# usage, from the repository root:
#   scripts/sync-contracts.sh [path of a smarter checkout, default ../smarter] [git ref]
#
# With a git ref (e.g. origin/main, or a release tag), the files are read at that ref with git show, without
# changing the checkout. Without one, they are copied from the checkout's working tree.
set -euo pipefail

SMARTER="${1:-../smarter}"
REF="${2:-}"

# "<path in the smarter repository> <package folder> <file name in its contract/ folder>"
CONTRACTS=(
  "smarter/smarter/apps/api/web/session/console-session.schema.json smarter-console console-session.schema.json"
  "smarter/smarter/apps/prompt/contract/chat-contract.schema.json smarter.sh-chat chat-contract.schema.json"
  "smarter/smarter/apps/llmtool/extension/extension-console.schema.json smarter-extension-console extension-console.schema.json"
  "smarter/smarter/apps/llmtool/views/listview/extension-list.schema.json smarter-llmtool-list extension-list.schema.json"
  "smarter/smarter/apps/llmclient/views/llmclient-deployment.schema.json smarter-llmclient-deployment llmclient-deployment.schema.json"
  "smarter/smarter/apps/prompt/views/detailviews/llmclient-architecture.schema.json smarter-llmclient-architecture llmclient-architecture.schema.json"
)

if [ ! -d "$SMARTER/smarter/smarter/apps" ]; then
  echo "No smarter checkout at $SMARTER" >&2
  exit 1
fi

copied=()
for contract in "${CONTRACTS[@]}"; do
  read -r source package name <<< "$contract"
  target="packages/$package/contract/$name"
  if [ -n "$REF" ]; then
    git -C "$SMARTER" show "$REF:$source" > "$target"
  else
    cp "$SMARTER/$source" "$target"
  fi
  copied+=("$target")
  echo "$source -> $target"
done

# The copies are formatted as the repository's other files are, except those that .prettierignore keeps
# byte for byte as the backend writes them.
npx --no-install prettier --write --log-level warn "${copied[@]}"

for contract in "${CONTRACTS[@]}"; do
  read -r _ package _ <<< "$contract"
  (cd "packages/$package" && npm run --silent contract:types)
done
