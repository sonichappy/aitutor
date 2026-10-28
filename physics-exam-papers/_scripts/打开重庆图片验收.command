#!/bin/zsh
cd "$(dirname "$0")"
mkdir -p ../_state/recurring_figures/workbench
if ! /usr/bin/curl --connect-timeout 1 --max-time 2 -fsS http://127.0.0.1:3012/api/records >/dev/null 2>&1; then
  nohup ../../.venv/bin/python review_workbench.py >../_state/recurring_figures/workbench/server.log 2>&1 &
  for i in {1..20}; do
    /usr/bin/curl --connect-timeout 1 --max-time 2 -fsS http://127.0.0.1:3012/api/records >/dev/null 2>&1 && break
    sleep 0.3
  done
fi
open http://127.0.0.1:3012
