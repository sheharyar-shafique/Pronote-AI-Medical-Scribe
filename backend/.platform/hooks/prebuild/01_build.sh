#!/bin/bash
###############################################################################
# Pre-build hook: compile TypeScript to JavaScript.
#
# EB's Node platform expects the app to be runnable as-is. Our package.json
# "start" script runs `node dist/index.js`, but `dist/` is gitignored — so we
# build it on the instance before EB tries to start the app.
#
# Runs as root, before the application is staged. We must `cd` into the app
# staging dir which EB exposes via $EB_APP_STAGING_DIR (Amazon Linux 2/2023).
###############################################################################
set -euo pipefail
echo "[prebuild] Compiling TypeScript -> dist/"
cd /var/app/staging
npm run build
echo "[prebuild] Build complete. dist/ contents:"
ls -la dist/ || true
