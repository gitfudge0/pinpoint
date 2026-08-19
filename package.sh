#!/bin/sh
# Build Chrome Web Store zip: dist/pinpoint-<version>.zip
set -e
cd "$(dirname "$0")"
v=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

npm run build

rm -f "dist/pinpoint-$v.zip"
(cd dist/build && zip -qr "../pinpoint-$v.zip" .)
echo "dist/pinpoint-$v.zip"
