#!/bin/bash

echo ""
echo "🚀 启动 Captcha Demo 项目..."
echo ""

# 检查依赖是否安装
check_and_install() {
  local dir=$1
  local name=$2
  if [ ! -d "$dir/node_modules" ]; then
    echo "📦 正在安装 $name 依赖..."
    cd "$dir" && npm install && cd -
    echo "✅ $name 依赖安装完成"
  fi
}

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

check_and_install "$ROOT_DIR/server" "Captcha 服务端"
check_and_install "$ROOT_DIR/client" "Captcha 登录页"

echo ""
echo "🎯 启动所有服务..."
echo ""

# 启动 Captcha 服务端
cd "$ROOT_DIR/server" && npm run dev &
CAPTCHA_PID=$!
echo "✅ Captcha 服务端启动中... (PID: $CAPTCHA_PID, 端口: 3001)"

sleep 1

# 启动 Captcha 登录页（Vite）
cd "$ROOT_DIR/client" && npm run dev &
LOGIN_PID=$!
echo "✅ Captcha 登录页启动中... (PID: $LOGIN_PID, 端口: 5173)"
echo ""
echo "================================================"
echo "  Captcha Demo 启动完成！"
echo "  🔐 Captcha 服务端:    http://localhost:3001"
echo "  🔑 Captcha 登录页:    http://localhost:5173"
echo "================================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获 Ctrl+C，停止所有子进程
trap "kill $CAPTCHA_PID $LOGIN_PID 2>/dev/null; echo '所有服务已停止'; exit 0" INT

# 等待所有后台进程
wait
