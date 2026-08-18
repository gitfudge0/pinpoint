#!/bin/sh
# Build Chrome Web Store zip: dist/pinpoint-<version>.zip
set -e
cd "$(dirname "$0")"
v=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

rm -rf dist/build
mkdir -p dist/build/fonts dist/build/icons

cp manifest.json dist/build/manifest.json
cp fonts/* dist/build/fonts/
cp icons/*.png dist/build/icons/
cp sidepanel.html dist/build/sidepanel.html

npx --yes esbuild --minify background.js --outfile=dist/build/background.js
npx --yes esbuild --minify content.js --outfile=dist/build/content.js
npx --yes esbuild --minify sidepanel.js --outfile=dist/build/sidepanel.js
npx --yes esbuild --minify content.css --outfile=dist/build/content.css

rm -f "dist/pinpoint-$v.zip"
(cd dist/build && zip -qr "../pinpoint-$v.zip" .)
echo "dist/pinpoint-$v.zip"
