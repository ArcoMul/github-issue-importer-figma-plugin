#!/bin/bash
set -e

if git rev-parse --git-dir > /dev/null 2>&1; then
  VERSION=$(git rev-list --count HEAD)
else
  echo "Warning: not a git repository — using version 0" >&2
  VERSION=0
fi

ZIP="dist/github-issue-importer-v${VERSION}.zip"

mkdir -p "dist"
zip "$ZIP" manifest.json code.js ui.html

echo "Created ${ZIP}"
