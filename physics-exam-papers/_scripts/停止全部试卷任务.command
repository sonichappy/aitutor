#!/bin/zsh
cd "$(dirname "$0")"
../../.venv/bin/python recurring_paper_tasks.py stop
../../.venv/bin/python recurring_figure_tasks.py stop
