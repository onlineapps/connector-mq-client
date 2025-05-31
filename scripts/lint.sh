#!/usr/bin/env bash
#
# lint.sh
#
# Runs ESLint and Prettier checks on source and test files.
# Exits with non-zero kódem, pokud lintování nebo formátování selže.

set -e

echo "[lint.sh] Running ESLint..."
npx eslint "src/**/*.js" "tests/**/*.js"

echo "[lint.sh] Running Prettier check..."
npx prettier --check "src/**/*.js" "tests/**/*.js"

echo "[lint.sh] All linting and format checks passed."
