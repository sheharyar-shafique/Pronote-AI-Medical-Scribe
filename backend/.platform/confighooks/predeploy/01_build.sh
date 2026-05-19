#!/bin/bash
###############################################################################
# Config-change predeploy hook: compile TypeScript to JavaScript.
#
# Mirror of .platform/hooks/predeploy/01_build.sh. Both copies are required
# because EB has two separate hook trees:
#
#   .platform/hooks/        runs on application deploys (ZIP upload)
#   .platform/confighooks/  runs on config-only changes (env var edit,
#                           ALB listener change, scaling change, etc.)
#
# Config-only changes still re-extract the app bundle from S3 — which
# excludes dist/ via .ebignore — but they only fire confighooks/, not
# hooks/. Without this duplicate, every env var edit would leave the app
# with no compiled dist/ and crash on /var/app/current/dist/index.js with
# MODULE_NOT_FOUND.
#
# Runs AFTER the platform engine has executed npm install (so devDeps
# including typescript are available), but before the app is moved from
# /var/app/staging to /var/app/current. The compiled dist/ is included in
# the move.
###############################################################################
set -euo pipefail
echo "[confighooks/predeploy] Compiling TypeScript -> dist/"
cd /var/app/staging
npx tsc
echo "[confighooks/predeploy] Build complete. dist/ contents:"
ls -la dist/ || true
