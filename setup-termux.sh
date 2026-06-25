#!/bin/bash
# SDD 后端 Termux 一键安装脚本
# 使用方法：在 Termux 中执行
#   pkg install -y curl && bash -c "$(curl -fsSL https://raw.githubusercontent.com/taskedwork/GZT/main/setup-termux.sh)"

set -e

echo "============================================"
echo "   SDD 后端 Termux 安装脚本"
echo "============================================"
echo ""

# 1. 更新包管理器
echo "[1/6] 更新包管理器..."
pkg update -y

# 2. 安装依赖
echo "[2/6] 安装 Node.js 和 Git..."
pkg install -y nodejs git

# 3. 克隆或更新仓库
if [ -d ~/GZT ]; then
  echo "[3/6] 更新仓库..."
  cd ~/GZT && git pull origin main
else
  echo "[3/6] 克隆仓库..."
  git clone https://github.com/taskedwork/GZT.git ~/GZT
  cd ~/GZT
fi

# 4. 安装后端依赖
echo "[4/6] 安装后端依赖..."
cd ~/GZT/server
npm install --production

# 5. 初始化数据目录
echo "[5/6] 初始化数据..."
mkdir -p data

# 6. 创建启动脚本和快捷命令
echo "[6/7] 配置启动脚本..."

cat > ~/start-sdd.sh << 'SCRIPT'
#!/bin/bash
cd ~/GZT/server

# 检查后端是否已在运行
if [ -f /tmp/sdd-server.pid ] && kill -0 $(cat /tmp/sdd-server.pid) 2>/dev/null; then
  echo "SDD 后端已在运行 (PID: $(cat /tmp/sdd-server.pid))"
  echo "停止服务: kill \$(cat /tmp/sdd-server.pid)"
  exit 1
fi

echo ""
echo "============================================"
echo "   SDD 后端服务"
echo "============================================"
echo "  后端地址: http://localhost:3001"
echo "  PWA 地址: https://taskedwork.github.io/GZT/"
echo "  按 Ctrl+C 停止服务"
echo "============================================"
echo ""

# 记录 PID
echo $$ > /tmp/sdd-server.pid

# 退出时清理 PID
trap "rm -f /tmp/sdd-server.pid; exit" INT TERM EXIT

node index.js
SCRIPT
chmod +x ~/start-sdd.sh

# 添加快捷命令（避免重复添加）
if ! grep -q "alias sdd=" ~/.bashrc 2>/dev/null; then
  echo 'alias sdd="bash ~/start-sdd.sh"' >> ~/.bashrc
fi

# 7. 配置开机自启（需要 Termux:Boot）
echo "[7/7] 配置开机自启..."
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-sdd << 'BOOT'
#!/bin/bash
termux-wake-lock
sleep 5
bash ~/start-sdd.sh &
BOOT
chmod +x ~/.termux/boot/start-sdd

echo ""
echo "============================================"
echo "   安装完成！"
echo "============================================"
echo ""
echo "  启动后端:  输入 sdd"
echo "  或运行:    bash ~/start-sdd.sh"
echo ""
echo "  然后用浏览器打开:"
echo "  https://taskedwork.github.io/GZT/"
echo ""
echo "  开机自启:  安装 Termux:Boot (F-Droid)"
echo "  已自动配置开机启动后端"
echo ""
echo "============================================"
