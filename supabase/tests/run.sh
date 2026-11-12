#!/usr/bin/env bash
# Runs migrations + RLS tests against a throwaway local PostgreSQL 16. No Supabase account needed.
set -euo pipefail
BIN=/usr/lib/postgresql/16/bin; D=/var/lib/postgresql/vistoon_test; HERE="$(cd "$(dirname "$0")/.." && pwd)"; PORT=54329
su postgres -c "rm -rf $D && $BIN/initdb -D $D -A trust >/dev/null && $BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -w -l $D/log start >/dev/null"
trap 'su postgres -c "$BIN/pg_ctl -D $D -m immediate stop >/dev/null"' EXIT
P="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
su postgres -c "$P -c 'create database t'"
for f in "$HERE/tests/00_supabase_shim.sql" "$HERE"/migrations/*.sql "$HERE/seed.sql" "$HERE/tests/rls_test.sql"; do
  echo "--- $(basename "$f")"; cat "$f" | su postgres -c "$P -d t -t -A"
done
