#!/bin/sh
# Build the unpacked extension into dist/build.
#
#   sh scripts/build.sh          minified production build
#   sh scripts/build.sh --dev    unminified watch build with sourcemaps
#
# Load dist/build in chrome://extensions while developing. The extension
# survives a reload without a page refresh, so the loop is build, reload,
# keep testing.
#
# Two modes, picked by whether src/ exists. Post-migration builds TypeScript
# bundles from src/. Pre-migration builds the root-level .js files, matching
# what package.sh did before the build moved in here, so a release cut today
# ships the same output as the last one. The mode is always printed.
set -e
cd "$(dirname "$0")/.."

out=dist/build
esbuild=./node_modules/.bin/esbuild

if [ ! -x "$esbuild" ]; then
  echo "build: $esbuild not found. Run npm install first." >&2
  exit 1
fi

dev=0
[ "$1" = "--dev" ] && dev=1

# Chrome 114 is the floor for the popover API, which the content script uses
# to promote its overlay, popup, and pins into the browser top layer.
target=chrome114

rm -rf "$out"
mkdir -p "$out/fonts" "$out/icons"

cp manifest.json "$out/manifest.json"
cp sidepanel.html "$out/sidepanel.html"
cp fonts/* "$out/fonts/"
cp icons/*.png "$out/icons/"

if [ -d src ]; then
  # Post-migration. One bundle per surface. The content script especially has
  # to stay a single file, because chrome.scripting.executeScript injects it as
  # a classic script with no module loading. iife format keeps stray exports
  # out of the output. tokens.css reaches the output through @import.
  echo "build: bundling TypeScript sources from src/"

  if [ "$dev" -eq 1 ]; then
    flags="--sourcemap --watch"
  else
    flags="--minify"
  fi

  bundle() {
    outfile=$1
    entry=$2
    case "$outfile" in
      *.css) fmt="" ;;
      *) fmt="--format=iife" ;;
    esac
    # shellcheck disable=SC2086
    "$esbuild" "$entry" --bundle --target="$target" --outfile="$out/$outfile" $fmt $flags
  }

  if [ "$dev" -eq 1 ]; then
    pids=""
    bundle background.js src/background/index.ts & pids="$pids $!"
    bundle content.js src/content/index.ts & pids="$pids $!"
    bundle sidepanel.js src/sidepanel/index.ts & pids="$pids $!"
    bundle content.css src/styles/content.css & pids="$pids $!"
    bundle sidepanel.css src/styles/sidepanel.css & pids="$pids $!"
    # shellcheck disable=SC2086
    trap 'kill $pids 2>/dev/null' INT TERM
    echo "watching. ctrl-c to stop."
    wait
  else
    bundle background.js src/background/index.ts
    bundle content.js src/content/index.ts
    bundle sidepanel.js src/sidepanel/index.ts
    bundle content.css src/styles/content.css
    bundle sidepanel.css src/styles/sidepanel.css
    echo "$out"
  fi
else
  # Pre-migration. Minify the root-level files and nothing else. No --bundle,
  # no --target, no --format, because that is exactly what the last working
  # release did and this path exists to keep releases reproducible, not to
  # improve them. The migration is where the bundling starts.
  echo "build: src/ not found, building pre-migration root sources"

  if [ "$dev" -eq 1 ]; then
    flags="--sourcemap --watch"
  else
    flags="--minify"
  fi

  plain() {
    # shellcheck disable=SC2086
    "$esbuild" "$1" --outfile="$out/$1" $flags
  }

  if [ "$dev" -eq 1 ]; then
    pids=""
    plain background.js & pids="$pids $!"
    plain content.js & pids="$pids $!"
    plain sidepanel.js & pids="$pids $!"
    plain content.css & pids="$pids $!"
    # shellcheck disable=SC2086
    trap 'kill $pids 2>/dev/null' INT TERM
    echo "watching. ctrl-c to stop."
    wait
  else
    plain background.js
    plain content.js
    plain sidepanel.js
    plain content.css
    echo "$out"
  fi
fi
