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
echo "[6/6] 配置启动脚本..."

cat > ~/start-sdd.sh << 'SCRIPT'
#!/bin/bash
cd ~/GZT/server
echo ""
echo "============================================"
echo "   SDD 后端服务"
echo "============================================"
echo "  后端地址: http://localhost:3001"
echo "  PWA 地址: https://taskedwork.github.io/GZT/"
echo "  按 Ctrl+C 停止服务"
echo "============================================"
echo ""
node index.js
SCRIPT
chmod +x ~/start-sdd.sh

# 添加快捷命令（避免重复添加）
if ! grep -q "alias sdd=" ~/.bashrc 2>/dev/null; then
  echo 'alias sdd="bash ~/start-sdd.sh"' >> ~/.bashrc
fi

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
echo "============================================"
