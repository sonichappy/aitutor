#!/bin/bash
# 一键流水线：批跑结构化 → 配图裁剪 → 缺图补全 → 复核/修复闭环 → 导出浏览器 → 存疑清单
# 所有步骤均为缓存续跑设计：中断后直接重新执行本脚本即可，已完成的部分自动跳过。
set -euo pipefail
cd "$(dirname "$0")"

# 加载模型供应商配置（pipeline.env 存在时；含 API Key，文件权限应为 600）
if [ -f pipeline.env ]; then
  set -a
  source pipeline.env
  set +a
  echo "供应商配置: PIPELINE_PROVIDER=${PIPELINE_PROVIDER:-deepseek} (pipeline.env)"
fi

export PIPELINE_PROVIDER="${PIPELINE_PROVIDER:-deepseek}"
if [ "$PIPELINE_PROVIDER" != "deepseek" ]; then
  echo "错误：物理题库仅允许 DeepSeek" >&2
  exit 1
fi
if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "错误：缺少 DEEPSEEK_API_KEY" >&2
  exit 1
fi

PYTHON="${PIPELINE_PYTHON:-python3}"
"$PYTHON" - <<'PYPREFLIGHT'
import importlib.util
missing = [name for name in ('requests', 'PIL', 'docx', 'pdfplumber', 'numpy')
           if importlib.util.find_spec(name) is None]
if missing:
    raise SystemExit('缺少依赖: ' + ', '.join(missing) +
                     '；请在所用 Python 环境安装 _scripts/requirements.txt')
PYPREFLIGHT

echo "================================================================"
echo " 题库一键流水线启动 $(date '+%F %T')"
echo "================================================================"

echo; echo ">>> [1/5] 批跑：OCR + 结构化 + 入库 $(date '+%T')"
"$PYTHON" kimi_pipeline.py batch --workers 3
echo ">>> [1/5] 批跑结束 $(date '+%T')"

echo; echo ">>> [2/5] 配图检测与裁剪 $(date '+%T')"
"$PYTHON" figure_slots.py normalize --output ../_state/figure_gaps_before.json
"$PYTHON" fig_backfill.py
echo ">>> [2/5] 配图裁剪结束 $(date '+%T')"

echo; echo ">>> [3/5] 缺图槽位补全 $(date '+%T')"
"$PYTHON" fig_verify.py fill --workers 6
echo ">>> [3/5] 缺图补全结束 $(date '+%T')"

echo; echo ">>> [4/5] 配图复核 + 自动修复闭环（最多 3 轮，收敛即停） $(date '+%T')"
prev=-1
for i in 1 2 3; do
  "$PYTHON" fig_verify.py detect --workers 6 --recheck
  n=$("$PYTHON" - <<'PYCOUNT'
import sqlite3
with sqlite3.connect('../question-bank/physics.db') as db:
    print(db.execute("SELECT COUNT(*) FROM figures WHERE matchStatus='suspect'").fetchone()[0])
PYCOUNT
  )
  echo "--- 第 $i 轮复核后存疑 $n 张 $(date '+%T')"
  if [ "$n" = "0" ] || [ "$n" = "$prev" ]; then
    echo "--- 已收敛，退出闭环"
    break
  fi
  prev=$n
  "$PYTHON" fig_verify.py fix2 --workers 6
done
"$PYTHON" fig_verify.py detect --workers 6   # 最终复核
"$PYTHON" fig_verify.py report | tee ../_state/final_fig_report.txt

echo; echo ">>> [5/5] 导出题库浏览器 $(date '+%T')"
"$PYTHON" figure_slots.py audit --output ../_state/figure_gaps_after.json
"$PYTHON" acceptance_report.py
"$PYTHON" export_viewer.py

echo; echo "================================================================"
echo " 流水线执行结束（缺图与存疑请查报告） $(date '+%F %T')"
echo " 存疑清单见 _state/final_fig_report.txt"
echo "================================================================"
