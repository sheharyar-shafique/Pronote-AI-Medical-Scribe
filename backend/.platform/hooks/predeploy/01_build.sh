#!/bin/bash
###############################################################################
# Predeploy hook: compile TypeScript to JavaScript.
#
# Runs AFTER the EB platform engine has executed `npm install` (so devDeps like
# typescript are present), but BEFORE the app is moved from /var/app/staging
# to /var/app/current. The compiled dist/ directory is included in the move.
#
# We must use the predeploy phase — prebuild fires before npm install, so tsc
# would not yet exist there.
###############################################################################
set -euo pipefail
echo "[predeploy] Compiling TypeScript -> dist/"
cd /var/app/staging
npx tsc
echo "[predeploy] Build complete. dist/ contents:"
ls -la dist/ || true
