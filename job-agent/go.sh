#!/bin/bash
# 最短启动入口（无需 chmod，直接 bash go.sh）
set -e
cd "$(cd "$(dirname "$0")" && pwd)"
bash fix-and-start.sh
