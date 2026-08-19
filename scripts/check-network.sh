#!/bin/sh
# Fail the build if a network call or dynamically constructed code appears
# under src/. Pinpoint's whole claim is that nothing leaves the machine, so
# this is a gate rather than a suggestion.
#
# Only src/ is scanned. e2e/ is left alone because Playwright's page.evaluate
# matches the eval pattern, and a gate that false-positives on the test suite
# gets switched off within a week.
#
# A comment that writes fetch( or eval( literally will trip this. Reword the
# comment rather than weakening the pattern.
set -e
cd "$(dirname "$0")/.."

if [ ! -d src ]; then
  echo "check-network: no src/ directory, nothing to scan."
  exit 0
fi

pattern='\bfetch[[:space:]]*\(|\bXMLHttpRequest\b|\bWebSocket\b|\beval[[:space:]]*\(|\bnew[[:space:]]+Function\b'

if grep -rnE "$pattern" src; then
  echo "" >&2
  echo "check-network: banned API found at the lines above." >&2
  echo "Pinpoint makes no network calls and runs no constructed code." >&2
  echo "See .claude/skills/pinpoint-conventions/references/security.md" >&2
  exit 1
fi

echo "check-network: clean."
